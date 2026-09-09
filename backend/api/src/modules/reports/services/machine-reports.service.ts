import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ErrorCode } from 'src/common/constants/error-codes';
import { CustodyGroupBy, ReportKey } from 'src/common/enums/report.enum';
import { AppException } from 'src/common/errors';
import { ExportColumn } from 'src/common/export';
import { NotificationsConfig } from 'src/config/notifications.config';
import { dateOnly, epochMs, money, num, toDateOnly } from '../report-filters';
import { ReportContext, ReportResult, ReportRunQuery, SqlTemporal } from '../report.types';

/** A machine in one of these is not part of the fleet any more and skews every count. */
const RETIRED = "('DECOMMISSIONED', 'REPLACED')";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The six machine reports of `17`.
 *
 * All of them are one statement. Where a report needs a per-row "when did this last move", it is
 * a lateral against `idx_transfer_items_machine_created` — one indexed probe per machine rather
 * than a scan of every hand-off the company has ever recorded.
 */
@Injectable()
export class MachineReportsService {
  private readonly notifications: NotificationsConfig;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.notifications = config.getOrThrow<NotificationsConfig>('notifications');
  }

  /** Every machine, where it is and who holds it. */
  async inventory(context: ReportContext): Promise<ReportResult> {
    const rows = await this.dataSource.query<InventoryRow[]>(
      `SELECT m.id, m.serial, m.status,
              COALESCE(b.name, '—') AS branch_name,
              COALESCE(mmt.name, mm.code) AS model_name,
              COALESCE(m.current_holder_type, '—') AS holder_type,
              COALESCE(u.full_name, mer.shop_name, w.name, '—') AS holder_name,
              m.warranty_end, m.purchase_price, m.total_repair_cost, m.repair_count
         FROM machines m
         JOIN machine_models mm ON mm.id = m.machine_model_id
         LEFT JOIN machine_model_translations mmt
                ON mmt.machine_model_id = mm.id AND mmt.locale = $1
         LEFT JOIN branches b ON b.id = m.current_branch_id
         LEFT JOIN users u ON u.id = m.current_holder_id
         LEFT JOIN merchants mer ON mer.id = m.current_holder_id
         LEFT JOIN warehouses w ON w.id = m.current_holder_id
        WHERE m.deleted_at IS NULL
          AND ($2::uuid IS NULL OR m.current_branch_id = $2::uuid)
        ORDER BY m.serial ASC
        LIMIT $3`,
      [context.locale, context.branchId, context.maxRows],
    );

    return {
      key: ReportKey.MACHINE_INVENTORY,
      generatedAt: new Date().toISOString(),
      filters: { branchId: context.branchId },
      columns: INVENTORY_COLUMNS,
      rows: rows.map((row) => ({
        id: row.id,
        serial: row.serial,
        status: row.status,
        branch: row.branch_name,
        model: row.model_name,
        holderType: row.holder_type,
        holderName: row.holder_name,
        warrantyEnd: dateOnly(row.warranty_end),
        purchasePrice: money(row.purchase_price),
        repairCost: money(row.total_repair_cost),
        repairCount: row.repair_count,
      })),
      totals: {
        machines: rows.length,
        purchaseValue: money(rows.reduce((sum, row) => sum + num(row.purchase_price), 0)),
        repairCost: money(rows.reduce((sum, row) => sum + num(row.total_repair_cost), 0)),
      },
      truncated: rows.length >= context.maxRows,
    };
  }

  /**
   * "Who has what" (`17`), grouped on whichever dimension was asked for.
   *
   * The grouping happens after the query rather than inside it because the response carries both
   * the per-group counts *and* every machine underneath — a `GROUP BY` would have to be run twice
   * to produce that, once for the counts and once for the members.
   */
  async custody(context: ReportContext, query: ReportRunQuery): Promise<ReportResult> {
    const groupBy = query.groupBy ?? CustodyGroupBy.REPRESENTATIVE;

    const rows = await this.dataSource.query<CustodyRow[]>(
      `SELECT m.id, m.serial, m.status,
              m.current_holder_type AS holder_type,
              m.current_holder_id AS holder_id,
              COALESCE(u.full_name, mer.shop_name, w.name, '—') AS holder_name,
              m.current_branch_id AS branch_id,
              COALESCE(b.name, '—') AS branch_name,
              COALESCE(mmt.name, mm.code) AS model_name,
              mer.shop_name AS merchant_name,
              movement.last_at AS since
         FROM machines m
         JOIN machine_models mm ON mm.id = m.machine_model_id
         LEFT JOIN machine_model_translations mmt
                ON mmt.machine_model_id = mm.id AND mmt.locale = $1
         LEFT JOIN branches b ON b.id = m.current_branch_id
         LEFT JOIN users u ON u.id = m.current_holder_id
         LEFT JOIN merchants mer ON mer.id = m.current_holder_id
         LEFT JOIN warehouses w ON w.id = m.current_holder_id
         LEFT JOIN LATERAL (
              SELECT MAX(ti.created_at) AS last_at
                FROM transfer_items ti
               WHERE ti.machine_id = m.id
         ) movement ON true
        WHERE m.deleted_at IS NULL
          AND m.status NOT IN ${RETIRED}
          AND ($2::uuid IS NULL OR m.current_branch_id = $2::uuid)
        ORDER BY m.serial ASC
        LIMIT $3`,
      [context.locale, context.branchId, context.maxRows],
    );

    const openViolations = await this.openViolationsByUser(context.branchId);
    const now = Date.now();
    const groups = new Map<string, CustodyGroup>();

    for (const row of rows) {
      const key = custodyKeyOf(row, groupBy);
      const group = groups.get(key.id) ?? {
        holder: { type: key.type, id: key.entityId, name: key.name },
        branch: row.branch_name,
        counts: { total: 0, inHand: 0, withMerchants: 0 },
        oldestHeldDays: 0,
        openViolations: key.entityId ? (openViolations.get(key.entityId) ?? 0) : 0,
        machines: [],
      };

      group.counts.total += 1;
      if (row.status === 'WITH_MERCHANT') group.counts.withMerchants += 1;
      else group.counts.inHand += 1;

      const since = epochMs(row.since);
      group.oldestHeldDays = Math.max(
        group.oldestHeldDays,
        since === null ? 0 : Math.floor((now - since) / DAY_MS),
      );

      group.machines.push({
        id: row.id,
        serial: row.serial,
        status: row.status,
        merchantName: row.merchant_name,
        since: dateOnly(row.since),
      });

      groups.set(key.id, group);
    }

    const ordered = [...groups.values()].sort((a, b) => b.counts.total - a.counts.total);

    return {
      key: ReportKey.MACHINE_CUSTODY,
      generatedAt: new Date().toISOString(),
      filters: { branchId: context.branchId, groupBy },
      columns: CUSTODY_COLUMNS,
      rows: ordered.flatMap((group) =>
        group.machines.map((machine) => ({
          group: group.holder.name,
          holderType: group.holder.type,
          branch: group.branch,
          serial: machine.serial,
          status: machine.status,
          merchantName: machine.merchantName,
          since: machine.since,
        })),
      ),
      totals: { machines: rows.length, holders: ordered.length },
      // One worksheet per holder is exactly what a supervisor prints and hands out (`17`).
      sheetKey: 'group',
      extra: { groups: ordered },
      truncated: rows.length >= context.maxRows,
    };
  }

  /** Machines nobody has moved in N days — the report behind the `MACHINE_IDLE` alert. */
  async idle(context: ReportContext, query: ReportRunQuery): Promise<ReportResult> {
    const days = query.days ?? this.notifications.idleAlertDays;
    const cutoff = new Date(Date.now() - days * DAY_MS);

    const rows = await this.dataSource.query<IdleRow[]>(
      `SELECT m.id, m.serial, m.status,
              COALESCE(b.name, '—') AS branch_name,
              COALESCE(u.full_name, mer.shop_name, w.name, '—') AS holder_name,
              COALESCE(movement.last_at, m.created_at) AS last_movement
         FROM machines m
         LEFT JOIN branches b ON b.id = m.current_branch_id
         LEFT JOIN users u ON u.id = m.current_holder_id
         LEFT JOIN merchants mer ON mer.id = m.current_holder_id
         LEFT JOIN warehouses w ON w.id = m.current_holder_id
         LEFT JOIN LATERAL (
              SELECT MAX(ti.created_at) AS last_at
                FROM transfer_items ti
               WHERE ti.machine_id = m.id
         ) movement ON true
        WHERE m.deleted_at IS NULL
          AND m.status NOT IN ${RETIRED}
          AND ($1::uuid IS NULL OR m.current_branch_id = $1::uuid)
          AND COALESCE(movement.last_at, m.created_at) < $2
        ORDER BY COALESCE(movement.last_at, m.created_at) ASC
        LIMIT $3`,
      [context.branchId, cutoff, context.maxRows],
    );

    const now = Date.now();

    return {
      key: ReportKey.MACHINE_IDLE,
      generatedAt: new Date().toISOString(),
      filters: { branchId: context.branchId, days },
      columns: IDLE_COLUMNS,
      rows: rows.map((row) => ({
        id: row.id,
        serial: row.serial,
        status: row.status,
        branch: row.branch_name,
        holderName: row.holder_name,
        lastMovement: dateOnly(row.last_movement),
        idleDays: Math.floor((now - (epochMs(row.last_movement) ?? now)) / DAY_MS),
      })),
      totals: { machines: rows.length, thresholdDays: days },
      truncated: rows.length >= context.maxRows,
    };
  }

  /**
   * One machine's whole life on one page (`17`).
   *
   * A `UNION ALL` over the five tables that can move or change a machine, ordered as one
   * timeline. Assembling it in the application instead would mean five round trips and a sort
   * that the database does for free.
   */
  async lifecycle(context: ReportContext, machineId: string): Promise<ReportResult> {
    const [machine] = await this.dataSource.query<LifecycleMachineRow[]>(
      `SELECT m.id, m.serial, m.status, m.purchase_date, m.purchase_price,
              m.total_repair_cost, m.repair_count, m.current_branch_id,
              COALESCE(b.name, '—') AS branch_name
         FROM machines m
         LEFT JOIN branches b ON b.id = m.current_branch_id
        WHERE m.id = $1 AND m.deleted_at IS NULL`,
      [machineId],
    );

    if (!machine) throw AppException.notFound(ErrorCode.MACHINE_NOT_FOUND);

    // The scope guard pinned the caller to a branch; a machine outside it is not his to read,
    // and answering 404 keeps the two indistinguishable from outside.
    if (context.branchId && machine.current_branch_id !== context.branchId) {
      throw AppException.notFound(ErrorCode.MACHINE_NOT_FOUND);
    }

    const rows = await this.dataSource.query<LifecycleEventRow[]>(
      `SELECT t.occurred_at AS at, 'TRANSFER' AS event, t.type AS detail,
              t.reference_no AS reference, t.status AS outcome, NULL::numeric AS amount
         FROM transfer_items ti
         JOIN transfers t ON t.id = ti.transfer_id
        WHERE ti.machine_id = $1 AND t.deleted_at IS NULL
        UNION ALL
       SELECT mo.sent_at, 'MAINTENANCE', COALESCE(mlt.name, ml.code),
              mo.reference_no, COALESCE(mo.result, mo.status), mo.cost
         FROM maintenance_orders mo
         JOIN maintenance_locations ml ON ml.id = mo.maintenance_location_id
         LEFT JOIN maintenance_location_translations mlt
                ON mlt.maintenance_location_id = ml.id AND mlt.locale = $2
        WHERE mo.machine_id = $1 AND mo.deleted_at IS NULL
        UNION ALL
       SELECT v.created_at, 'VIOLATION', COALESCE(vtt.name, vt.code),
              v.severity, v.status, v.charged_amount
         FROM violations v
         JOIN violation_types vt ON vt.id = v.violation_type_id
         LEFT JOIN violation_type_translations vtt
                ON vtt.violation_type_id = vt.id AND vtt.locale = $2
        WHERE v.machine_id = $1 AND v.deleted_at IS NULL
        UNION ALL
       SELECT r.replaced_at, 'REPLACEMENT', r.reason,
              old.serial || ' → ' || new.serial, 'REPLACED', NULL::numeric
         FROM machine_replacements r
         JOIN machines old ON old.id = r.old_machine_id
         JOIN machines new ON new.id = r.new_machine_id
        WHERE (r.old_machine_id = $1 OR r.new_machine_id = $1) AND r.deleted_at IS NULL
        UNION ALL
       SELECT d.decommissioned_at, 'DECOMMISSION', d.notes,
              COALESCE(drt.name, dr.code), 'DECOMMISSIONED', NULL::numeric
         FROM decommissions d
         JOIN decommission_reasons dr ON dr.id = d.decommission_reason_id
         LEFT JOIN decommission_reason_translations drt
                ON drt.decommission_reason_id = dr.id AND drt.locale = $2
        WHERE d.machine_id = $1 AND d.deleted_at IS NULL AND d.reverted_at IS NULL
        ORDER BY 1 ASC
        LIMIT $3`,
      [machineId, context.locale, context.maxRows],
    );

    return {
      key: ReportKey.MACHINE_LIFECYCLE,
      generatedAt: new Date().toISOString(),
      filters: { machineId, serial: machine.serial },
      columns: LIFECYCLE_COLUMNS,
      rows: rows.map((row) => ({
        at: dateOnly(row.at),
        event: row.event,
        detail: row.detail,
        reference: row.reference,
        outcome: row.outcome,
        amount: row.amount === null ? null : money(row.amount),
      })),
      totals: {
        events: rows.length,
        purchasePrice: money(machine.purchase_price),
        repairCost: money(machine.total_repair_cost),
        repairCount: machine.repair_count,
      },
      extra: {
        machine: {
          id: machine.id,
          serial: machine.serial,
          status: machine.status,
          branch: machine.branch_name,
          purchaseDate: dateOnly(machine.purchase_date),
        },
      },
      truncated: rows.length >= context.maxRows,
    };
  }

  /**
   * Purchase against cumulative repair, along the whole replacement chain (`17`).
   *
   * Chain-aware is the point: a unit swapped twice at the factory has three serials and one cost
   * story, and reading the last serial's own `total_repair_cost` would say the asset is nearly
   * new. The recursive CTE walks each chain from the serial that was actually bought.
   */
  async costs(context: ReportContext): Promise<ReportResult> {
    const rows = await this.dataSource.query<CostRow[]>(
      `WITH RECURSIVE chain AS (
         SELECT m.id AS machine_id, m.id AS root_id, 1 AS depth
           FROM machines m
          WHERE m.deleted_at IS NULL AND m.replaces_machine_id IS NULL
          UNION ALL
         SELECT nxt.id, chain.root_id, chain.depth + 1
           FROM machines nxt
           JOIN chain ON nxt.replaces_machine_id = chain.machine_id
          WHERE nxt.deleted_at IS NULL
       ),
       rolled AS (
         SELECT c.root_id,
                COUNT(*)::int AS chain_length,
                SUM(m.total_repair_cost) AS repair_cost,
                SUM(m.repair_count)::int AS repair_count,
                MAX(c.depth) AS max_depth
           FROM chain c
           JOIN machines m ON m.id = c.machine_id
          GROUP BY c.root_id
       )
       SELECT root.id AS root_id, root.serial AS original_serial, root.purchase_price,
              root.purchase_date, current_machine.serial AS current_serial,
              current_machine.status, COALESCE(b.name, '—') AS branch_name,
              rolled.chain_length, rolled.repair_cost, rolled.repair_count
         FROM rolled
         JOIN machines root ON root.id = rolled.root_id
         JOIN chain tip ON tip.root_id = rolled.root_id AND tip.depth = rolled.max_depth
         JOIN machines current_machine ON current_machine.id = tip.machine_id
         LEFT JOIN branches b ON b.id = current_machine.current_branch_id
        WHERE ($1::uuid IS NULL OR current_machine.current_branch_id = $1::uuid)
        ORDER BY rolled.repair_cost DESC
        LIMIT $2`,
      [context.branchId, context.maxRows],
    );

    return {
      key: ReportKey.MACHINE_COSTS,
      generatedAt: new Date().toISOString(),
      filters: { branchId: context.branchId },
      columns: COST_COLUMNS,
      rows: rows.map((row) => {
        const purchasePrice = num(row.purchase_price);
        const repairCost = num(row.repair_cost);

        return {
          originalSerial: row.original_serial,
          currentSerial: row.current_serial,
          status: row.status,
          branch: row.branch_name,
          purchaseDate: dateOnly(row.purchase_date),
          purchasePrice: money(purchasePrice),
          repairCost: money(repairCost),
          repairCount: row.repair_count,
          chainLength: row.chain_length,
          // Null rather than zero when nothing was paid for the unit: a ratio against an unknown
          // purchase price is not "0%", it is a question the data cannot answer.
          costRatioPercent:
            purchasePrice > 0 ? Math.round((repairCost / purchasePrice) * 1000) / 10 : null,
        };
      }),
      totals: {
        assets: rows.length,
        purchaseValue: money(rows.reduce((sum, row) => sum + num(row.purchase_price), 0)),
        repairCost: money(rows.reduce((sum, row) => sum + num(row.repair_cost), 0)),
      },
      truncated: rows.length >= context.maxRows,
    };
  }

  /** Warranties lapsing inside the window (`17`). */
  async warranty(context: ReportContext, query: ReportRunQuery): Promise<ReportResult> {
    const days = query.days ?? 30;
    const today = toDateOnly(new Date());
    const until = toDateOnly(new Date(Date.now() + days * DAY_MS));

    const rows = await this.dataSource.query<WarrantyRow[]>(
      `SELECT m.id, m.serial, m.warranty_start, m.warranty_end, m.status,
              COALESCE(b.name, '—') AS branch_name,
              COALESCE(u.full_name, mer.shop_name, w.name, '—') AS holder_name,
              (m.warranty_end - $1::date) AS days_remaining
         FROM machines m
         LEFT JOIN branches b ON b.id = m.current_branch_id
         LEFT JOIN users u ON u.id = m.current_holder_id
         LEFT JOIN merchants mer ON mer.id = m.current_holder_id
         LEFT JOIN warehouses w ON w.id = m.current_holder_id
        WHERE m.deleted_at IS NULL
          AND m.status NOT IN ${RETIRED}
          AND m.warranty_end IS NOT NULL
          AND m.warranty_end BETWEEN $1::date AND $2::date
          AND ($3::uuid IS NULL OR m.current_branch_id = $3::uuid)
        ORDER BY m.warranty_end ASC
        LIMIT $4`,
      [today, until, context.branchId, context.maxRows],
    );

    return {
      key: ReportKey.WARRANTY_EXPIRY,
      generatedAt: new Date().toISOString(),
      filters: { branchId: context.branchId, days, from: today, to: until },
      columns: WARRANTY_COLUMNS,
      rows: rows.map((row) => ({
        id: row.id,
        serial: row.serial,
        status: row.status,
        branch: row.branch_name,
        holderName: row.holder_name,
        warrantyStart: dateOnly(row.warranty_start),
        warrantyEnd: dateOnly(row.warranty_end),
        daysRemaining: row.days_remaining,
      })),
      totals: { machines: rows.length, windowDays: days },
      truncated: rows.length >= context.maxRows,
    };
  }

  /**
   * Open violations per person, for the custody report's `openViolations` column.
   *
   * One grouped query for the whole page rather than a count per holder: the custody report's
   * whole point is showing forty-odd holders at once.
   */
  private async openViolationsByUser(branchId: string | null): Promise<Map<string, number>> {
    const rows = await this.dataSource.query<{ user_id: string; total: number }[]>(
      `SELECT v.user_id, COUNT(*)::int AS total
         FROM violations v
        WHERE v.deleted_at IS NULL
          AND v.status IN ('OPEN', 'ACKNOWLEDGED')
          AND ($1::uuid IS NULL OR v.branch_id = $1::uuid)
        GROUP BY v.user_id`,
      [branchId],
    );

    return new Map(rows.map((row) => [row.user_id, row.total]));
  }
}

interface CustodyGroup {
  holder: { type: string; id: string | null; name: string };
  branch: string;
  counts: { total: number; inHand: number; withMerchants: number };
  oldestHeldDays: number;
  openViolations: number;
  machines: {
    id: string;
    serial: string;
    status: string;
    merchantName: string | null;
    since: string | null;
  }[];
}

/**
 * Which column a custody row is bucketed on.
 *
 * `id` is the map key and `entityId` is the real record behind it — they differ for the
 * dimensions that are not a party at all, where "status" or "model" is the group and there is no
 * holder to count violations against.
 */
function custodyKeyOf(
  row: CustodyRow,
  groupBy: CustodyGroupBy,
): { id: string; type: string; entityId: string | null; name: string } {
  switch (groupBy) {
    case CustodyGroupBy.BRANCH:
      return {
        id: row.branch_id ?? 'company',
        type: 'BRANCH',
        entityId: row.branch_id,
        name: row.branch_name,
      };
    case CustodyGroupBy.STATUS:
      return { id: row.status, type: 'STATUS', entityId: null, name: row.status };
    case CustodyGroupBy.MODEL:
      return { id: row.model_name, type: 'MODEL', entityId: null, name: row.model_name };
    case CustodyGroupBy.MERCHANT:
    case CustodyGroupBy.REPRESENTATIVE:
    case CustodyGroupBy.SUPERVISOR:
    default: {
      // The party dimensions all group on the holder; they differ in which holders are of
      // interest, and a row held by somebody else is its own group rather than being dropped —
      // a custody report that silently omits machines is worse than one with an extra heading.
      const expected = PARTY_FOR_GROUP[groupBy];
      const matches = !expected || row.holder_type === expected;

      return {
        id: matches ? (row.holder_id ?? `unheld:${row.status}`) : `other:${row.holder_type ?? '—'}`,
        type: matches ? (row.holder_type ?? 'UNASSIGNED') : (row.holder_type ?? 'UNASSIGNED'),
        entityId: matches ? row.holder_id : null,
        name: matches ? row.holder_name : row.holder_name,
      };
    }
  }
}

const PARTY_FOR_GROUP: Partial<Record<CustodyGroupBy, string>> = {
  [CustodyGroupBy.REPRESENTATIVE]: 'REPRESENTATIVE',
  [CustodyGroupBy.SUPERVISOR]: 'SUPERVISOR',
  [CustodyGroupBy.MERCHANT]: 'MERCHANT',
};

const INVENTORY_COLUMNS: ExportColumn[] = [
  { key: 'serial', header: 'الرقم التسلسلي', type: 'text' },
  { key: 'model', header: 'الموديل', type: 'text' },
  { key: 'status', header: 'الحالة', type: 'text' },
  { key: 'branch', header: 'الفرع', type: 'text' },
  { key: 'holderType', header: 'نوع الحائز', type: 'text' },
  { key: 'holderName', header: 'الحائز', type: 'text' },
  { key: 'warrantyEnd', header: 'نهاية الضمان', type: 'date' },
  { key: 'purchasePrice', header: 'سعر الشراء', type: 'number' },
  { key: 'repairCost', header: 'تكلفة الإصلاح', type: 'number' },
  { key: 'repairCount', header: 'عدد الإصلاحات', type: 'number' },
];

const CUSTODY_COLUMNS: ExportColumn[] = [
  { key: 'group', header: 'الحائز', type: 'text' },
  { key: 'holderType', header: 'نوع الحائز', type: 'text' },
  { key: 'branch', header: 'الفرع', type: 'text' },
  { key: 'serial', header: 'الرقم التسلسلي', type: 'text' },
  { key: 'status', header: 'الحالة', type: 'text' },
  { key: 'merchantName', header: 'التاجر', type: 'text' },
  { key: 'since', header: 'منذ', type: 'date' },
];

const IDLE_COLUMNS: ExportColumn[] = [
  { key: 'serial', header: 'الرقم التسلسلي', type: 'text' },
  { key: 'status', header: 'الحالة', type: 'text' },
  { key: 'branch', header: 'الفرع', type: 'text' },
  { key: 'holderName', header: 'الحائز', type: 'text' },
  { key: 'lastMovement', header: 'آخر حركة', type: 'date' },
  { key: 'idleDays', header: 'أيام بدون حركة', type: 'number' },
];

const LIFECYCLE_COLUMNS: ExportColumn[] = [
  { key: 'at', header: 'التاريخ', type: 'date' },
  { key: 'event', header: 'الحدث', type: 'text' },
  { key: 'detail', header: 'التفاصيل', type: 'text' },
  { key: 'reference', header: 'المرجع', type: 'text' },
  { key: 'outcome', header: 'النتيجة', type: 'text' },
  { key: 'amount', header: 'المبلغ', type: 'number' },
];

const COST_COLUMNS: ExportColumn[] = [
  { key: 'originalSerial', header: 'الرقم الأصلي', type: 'text' },
  { key: 'currentSerial', header: 'الرقم الحالي', type: 'text' },
  { key: 'status', header: 'الحالة', type: 'text' },
  { key: 'branch', header: 'الفرع', type: 'text' },
  { key: 'purchaseDate', header: 'تاريخ الشراء', type: 'date' },
  { key: 'purchasePrice', header: 'سعر الشراء', type: 'number' },
  { key: 'repairCost', header: 'إجمالي الإصلاح', type: 'number' },
  { key: 'repairCount', header: 'عدد الإصلاحات', type: 'number' },
  { key: 'chainLength', header: 'طول السلسلة', type: 'number' },
  { key: 'costRatioPercent', header: 'نسبة التكلفة %', type: 'number' },
];

const WARRANTY_COLUMNS: ExportColumn[] = [
  { key: 'serial', header: 'الرقم التسلسلي', type: 'text' },
  { key: 'status', header: 'الحالة', type: 'text' },
  { key: 'branch', header: 'الفرع', type: 'text' },
  { key: 'holderName', header: 'الحائز', type: 'text' },
  { key: 'warrantyStart', header: 'بداية الضمان', type: 'date' },
  { key: 'warrantyEnd', header: 'نهاية الضمان', type: 'date' },
  { key: 'daysRemaining', header: 'الأيام المتبقية', type: 'number' },
];

interface InventoryRow {
  id: string;
  serial: string;
  status: string;
  branch_name: string;
  model_name: string;
  holder_type: string;
  holder_name: string;
  warranty_end: SqlTemporal | null;
  purchase_price: string | null;
  total_repair_cost: string;
  repair_count: number;
}

interface CustodyRow {
  id: string;
  serial: string;
  status: string;
  holder_type: string | null;
  holder_id: string | null;
  holder_name: string;
  branch_id: string | null;
  branch_name: string;
  model_name: string;
  merchant_name: string | null;
  since: SqlTemporal | null;
}

interface IdleRow {
  id: string;
  serial: string;
  status: string;
  branch_name: string;
  holder_name: string;
  last_movement: SqlTemporal;
}

interface LifecycleMachineRow {
  id: string;
  serial: string;
  status: string;
  purchase_date: SqlTemporal | null;
  purchase_price: string | null;
  total_repair_cost: string;
  repair_count: number;
  current_branch_id: string | null;
  branch_name: string;
}

interface LifecycleEventRow {
  at: SqlTemporal;
  event: string;
  detail: string;
  reference: string;
  outcome: string;
  amount: string | null;
}

interface CostRow {
  root_id: string;
  original_serial: string;
  purchase_price: string | null;
  purchase_date: SqlTemporal | null;
  current_serial: string;
  status: string;
  branch_name: string;
  chain_length: number;
  repair_cost: string;
  repair_count: number;
}

interface WarrantyRow {
  id: string;
  serial: string;
  warranty_start: SqlTemporal | null;
  warranty_end: SqlTemporal;
  status: string;
  branch_name: string;
  holder_name: string;
  days_remaining: number;
}
