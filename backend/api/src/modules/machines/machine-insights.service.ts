import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Locale } from 'src/common/constants/locales';
import { decodeCursor, encodeCursor } from 'src/common/dto/cursor.util';
import { CursorResult, PaginatedResult } from 'src/common/dto/paginated-result';
import { MachineStatus, TERMINAL_MACHINE_STATUSES } from 'src/common/enums/machine-status.enum';
import { ResponsibleParty } from 'src/common/enums/operations.enum';
import { BranchScope } from 'src/common/types/request.types';
import { SettingsService } from 'src/modules/settings/settings.service';
import {
  QueryDecommissionCandidatesDto,
  QueryMachineTimelineDto,
} from './dto/machine-insights.dto';
import {
  ChainLinkResponse,
  DecommissionCandidateResponse,
  MachineCostSummaryResponse,
  MachineTimelineEventResponse,
  ReplacementChainResponse,
  TimelineEventType,
} from './dto/responses/machine-insights.response';
import { costToValueRatio, recommendFor } from './machine-economics';
import {
  ChainMember,
  chainLinks,
  chainTotals,
  ChainTotals,
  monthsBetween,
} from './replacement-chain';
import { MachinesService } from './machines.service';

interface ChainRow {
  id: string;
  serial: string;
  status: MachineStatus;
  purchase_price: string | null;
  purchase_date: string | null;
  repair_count: number;
  total_repair_cost: string;
  replaces_machine_id: string | null;
  created_at: Date;
  replaced_at: Date | null;
  replaced_reason: string | null;
}

interface TimelineRow {
  at: Date;
  type: TimelineEventType;
  ref_id: string;
  ref_no: string | null;
  details: Record<string, unknown>;
}

interface MaintenanceBreakdownRow {
  responsible_party: ResponsibleParty | null;
  is_free_under_warranty: boolean;
  total: string;
}

interface CandidateRow {
  id: string;
  serial: string;
  status: MachineStatus;
  model: string | null;
  purchase_price: string | null;
  purchase_date: string | null;
  chain_repair_cost: string;
  chain_repair_count: string;
  chain_length: string;
  last_maintenance_at: Date | null;
  total_rows: string;
}

/**
 * The read side of a machine's history: the replacement chain, the merged timeline, the cost
 * story, and the proactive "which of these should I scrap?" list.
 *
 * All four are assembled in SQL rather than in memory (`07`). They cross module boundaries —
 * transfers, maintenance, violations, replacements, decommission — and doing it here, in raw
 * queries against the tables, is what keeps `MachinesModule` free of a dependency on four modules
 * that all already depend on it.
 */
@Injectable()
export class MachineInsightsService {
  constructor(
    private readonly machines: MachinesService,
    private readonly settings: SettingsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * The whole chain from any link, oldest first (`12`). Walking both directions in one recursive
   * query rather than looping in the service: a three-link chain is three round trips otherwise,
   * and the loop has to carry its own cycle guard.
   */
  async replacementChain(
    id: string,
    scope: BranchScope,
    locale: Locale,
  ): Promise<ReplacementChainResponse> {
    const machine = await this.machines.findById(id, scope, locale);
    const members = await this.chainMembers(machine.id);
    const links = chainLinks(members);
    const totals = chainTotals(members);

    return {
      requestedMachineId: machine.id,
      chainLength: links.length,
      chain: links.map((link): ChainLinkResponse => ({
        position: link.position,
        id: link.id,
        serial: link.serial,
        status: link.status,
        activeFrom: link.activeFrom.toISOString(),
        activeTo: link.activeTo?.toISOString() ?? null,
        repairCount: link.repairCount,
        repairCost: link.repairCost,
        replacedReason: link.replacedReason,
        isCurrent: link.isCurrent,
      })),
      chainTotals: {
        purchasePrice: totals.purchasePrice,
        cumulativeRepairCost: totals.cumulativeRepairCost,
        cumulativeRepairCount: totals.cumulativeRepairCount,
        costToValueRatio: totals.costToValueRatio,
        ageMonths: totals.ageMonths,
      },
    };
  }

  /**
   * Every hand-off, repair, violation, swap and scrapping this unit has been through, newest
   * first. One `UNION ALL` over the source tables, keyset-paginated on `(at, ref_id)`.
   */
  async timeline(
    id: string,
    query: QueryMachineTimelineDto,
    scope: BranchScope,
    locale: Locale,
  ): Promise<CursorResult<MachineTimelineEventResponse>> {
    const machine = await this.machines.findById(id, scope, locale);
    const cursor = decodeCursor(query.cursor);

    const rows = await this.dataSource.query<TimelineRow[]>(
      `${TIMELINE_SQL}
       ORDER BY at DESC, ref_id DESC
       LIMIT $4`,
      [machine.id, cursor?.occurredAt ?? null, cursor?.id ?? null, query.limit + 1],
    );

    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];

    return new CursorResult(
      page.map((row) => ({
        at: row.at.toISOString(),
        type: row.type,
        refId: row.ref_id,
        refNo: row.ref_no,
        details: row.details,
      })),
      query.limit,
      rows.length > query.limit && last ? encodeCursor(last.at, last.ref_id) : null,
    );
  }

  /**
   * "Is this machine still worth keeping?" (`07`). Chain totals when the unit has been swapped,
   * its own row when it has not (`12`, rule 4) — the chain query returns the single row in that
   * case, so there is one path rather than two.
   */
  async costSummary(
    id: string,
    scope: BranchScope,
    locale: Locale,
  ): Promise<MachineCostSummaryResponse> {
    const machine = await this.machines.findById(id, scope, locale);
    const members = await this.chainMembers(machine.id);
    const totals = chainTotals(members);
    const thresholds = await this.settings.decommissionThresholds();

    const breakdown = await this.dataSource.query<MaintenanceBreakdownRow[]>(
      `SELECT mo.responsible_party, mo.is_free_under_warranty, COALESCE(SUM(mo.cost), 0) AS total
         FROM maintenance_orders mo
        WHERE mo.machine_id = ANY($1::uuid[])
          AND mo.status = 'CLOSED'
          AND mo.deleted_at IS NULL
        GROUP BY mo.responsible_party, mo.is_free_under_warranty`,
      [members.map((member) => member.id)],
    );

    const chargedTo = (party: ResponsibleParty): number =>
      breakdown
        .filter((row) => row.responsible_party === party && !row.is_free_under_warranty)
        .reduce((sum, row) => sum + Number(row.total), 0);

    return {
      purchasePrice: totals.purchasePrice,
      totalRepairCost: totals.cumulativeRepairCost,
      repairCount: totals.cumulativeRepairCount,
      costToValueRatio: totals.costToValueRatio,
      chargedToCompany: chargedTo(ResponsibleParty.COMPANY),
      chargedToRepresentatives: chargedTo(ResponsibleParty.REPRESENTATIVE),
      chargedToMerchants: chargedTo(ResponsibleParty.MERCHANT),
      // What the warranty absorbed. A free close records a zero cost (`11`, step 3), so this only
      // carries a figure where one was written on afterwards as a correction.
      freeUnderWarranty: breakdown
        .filter((row) => row.is_free_under_warranty)
        .reduce((sum, row) => sum + Number(row.total), 0),
      ageMonths: totals.ageMonths,
      isInChain: totals.chainLength > 1,
      chainLength: totals.chainLength,
      recommendation: recommendFor(
        {
          costToValueRatio: totals.costToValueRatio,
          repairCount: totals.cumulativeRepairCount,
        },
        thresholds,
      ),
    };
  }

  /**
   * The proactive list (`13`): machines whose repair bill, measured against the *chain's* purchase
   * price, has passed the configured line — or which have simply been repaired too many times.
   *
   * The two criteria are `OR`ed because they are the two independent reasons the recommendation
   * fires; a cheap unit repaired six times is unreliable whatever the money says. Age and branch
   * narrow the result rather than widening it, so they are `AND`ed.
   */
  async decommissionCandidates(
    query: QueryDecommissionCandidatesDto,
    scope: BranchScope,
  ): Promise<PaginatedResult<DecommissionCandidateResponse>> {
    const thresholds = await this.settings.decommissionThresholds();

    const minCostRatio = query.minCostRatio ?? thresholds.considerRatio;
    const minRepairCount = query.minRepairCount ?? thresholds.considerRepairCount;
    const branchId = scope.unrestricted ? (query.branchId ?? null) : scope.branchId;

    const rows = await this.dataSource.query<CandidateRow[]>(
      `${CHAIN_ROOTS_SQL}
       SELECT m.id, m.serial, m.status, model_t.name AS model,
              root.purchase_price,
              to_char(root.purchase_date, 'YYYY-MM-DD') AS purchase_date,
              totals.chain_repair_cost, totals.chain_repair_count, totals.chain_length,
              history.last_maintenance_at,
              COUNT(*) OVER () AS total_rows
         FROM machines m
         JOIN chain_root cr ON cr.machine_id = m.id
         JOIN machines root ON root.id = cr.root_id
         JOIN chain_totals totals ON totals.root_id = cr.root_id
         LEFT JOIN machine_model_translations model_t
                ON model_t.machine_model_id = m.machine_model_id AND model_t.locale = $6
         LEFT JOIN (
                SELECT machine_id, MAX(COALESCE(returned_at, sent_at)) AS last_maintenance_at
                  FROM maintenance_orders
                 WHERE deleted_at IS NULL
                 GROUP BY machine_id
              ) history ON history.machine_id = m.id
        WHERE m.deleted_at IS NULL
          AND m.status <> ALL($1::varchar[])
          AND ($2::uuid IS NULL OR m.current_branch_id = $2::uuid)
          AND (
                totals.chain_repair_count >= $3::int
                OR (
                     root.purchase_price IS NOT NULL AND root.purchase_price > 0
                     AND totals.chain_repair_cost / root.purchase_price >= $4::numeric
                   )
              )
          AND (
                $5::int IS NULL
                OR (
                     root.purchase_date IS NOT NULL
                     AND root.purchase_date <= CURRENT_DATE - ($5::int * INTERVAL '1 month')
                   )
              )
        ORDER BY
          CASE WHEN root.purchase_price > 0
               THEN totals.chain_repair_cost / root.purchase_price
               ELSE NULL END DESC NULLS LAST,
          totals.chain_repair_count DESC,
          m.serial ASC
        LIMIT $7 OFFSET $8`,
      [
        TERMINAL_MACHINE_STATUSES,
        branchId,
        minRepairCount,
        minCostRatio,
        query.minAgeMonths ?? null,
        // The model name is read straight from the translation table: this query is already raw,
        // and routing it through the entity mapper would mean a second pass over the page.
        DEFAULT_MODEL_LOCALE,
        query.take,
        query.skip,
      ],
    );

    const total = rows.length > 0 ? Number(rows[0].total_rows) : 0;
    const now = new Date();

    const items = rows.map((row): DecommissionCandidateResponse => {
      const repairCost = Number(row.chain_repair_cost);
      const repairCount = Number(row.chain_repair_count);
      const purchasePrice = row.purchase_price === null ? null : Number(row.purchase_price);
      const ratio = costToValueRatio(repairCost, purchasePrice);

      return {
        id: row.id,
        serial: row.serial,
        status: row.status,
        model: row.model,
        purchasePrice,
        cumulativeRepairCost: repairCost,
        costRatio: ratio,
        repairCount,
        ageMonths: row.purchase_date
          ? monthsBetween(new Date(`${row.purchase_date}T00:00:00.000Z`), now)
          : 0,
        isInChain: Number(row.chain_length) > 1,
        chainLength: Number(row.chain_length),
        recommendation: recommendFor({ costToValueRatio: ratio, repairCount }, thresholds),
        lastMaintenanceAt: row.last_maintenance_at?.toISOString() ?? null,
      };
    });

    return withCriteria(new PaginatedResult(items, total, query.page, query.limit), {
      minCostRatio,
      minRepairCount,
      minAgeMonths: query.minAgeMonths ?? null,
    });
  }

  /**
   * The numbers a decommission freezes into its row (`13`, step 4). Read through the chain so a
   * unit that has already been swapped once is judged on what the whole asset has cost.
   */
  async chainSnapshot(machineId: string): Promise<ChainTotals> {
    return chainTotals(await this.chainMembers(machineId));
  }

  /**
   * Every machine in this one's chain, in no particular order — `chainLinks` puts them in
   * sequence. Both directions are walked because the caller may have asked about any link.
   */
  private async chainMembers(machineId: string): Promise<ChainMember[]> {
    const rows = await this.dataSource.query<ChainRow[]>(
      `WITH RECURSIVE back AS (
         SELECT m.id, m.replaces_machine_id
           FROM machines m
          WHERE m.id = $1 AND m.deleted_at IS NULL
         UNION ALL
         SELECT p.id, p.replaces_machine_id
           FROM machines p
           JOIN back b ON p.id = b.replaces_machine_id
          WHERE p.deleted_at IS NULL
       ),
       fwd AS (
         SELECT m.id, m.replaced_by_machine_id
           FROM machines m
          WHERE m.id = $1 AND m.deleted_at IS NULL
         UNION ALL
         SELECT c.id, c.replaced_by_machine_id
           FROM machines c
           JOIN fwd f ON c.id = f.replaced_by_machine_id
          WHERE c.deleted_at IS NULL
       ),
       members AS (
         SELECT id FROM back
         UNION
         SELECT id FROM fwd
       )
       -- The purchase day is rendered as text: a date column comes back from the driver as a JS
       -- Date at local midnight, which shifts the day the asset was bought by the server offset.
       SELECT m.id, m.serial, m.status, m.purchase_price,
              to_char(m.purchase_date, 'YYYY-MM-DD') AS purchase_date,
              m.repair_count,
              m.total_repair_cost, m.replaces_machine_id, m.created_at,
              r.replaced_at, r.reason AS replaced_reason
         FROM members mem
         JOIN machines m ON m.id = mem.id
         LEFT JOIN machine_replacements r
                ON r.old_machine_id = m.id AND r.deleted_at IS NULL
        ORDER BY m.created_at ASC`,
      [machineId],
    );

    return rows.map((row) => ({
      id: row.id,
      serial: row.serial,
      status: row.status,
      purchasePrice: row.purchase_price === null ? null : Number(row.purchase_price),
      purchaseDate: row.purchase_date,
      repairCount: Number(row.repair_count),
      repairCost: Number(row.total_repair_cost),
      replacesMachineId: row.replaces_machine_id,
      createdAt: row.created_at,
      replacedAt: row.replaced_at,
      replacedReason: row.replaced_reason,
    }));
  }
}

/** Model names are read in the default locale; the candidates list is an internal report. */
const DEFAULT_MODEL_LOCALE = 'ar';

/**
 * Groups every machine with the root of its chain, then totals the chain once. Written as one
 * upward walk over the whole table rather than per machine: the candidates list is a fleet-wide
 * sweep, and a correlated subquery would re-walk the chain for every row.
 */
const CHAIN_ROOTS_SQL = `
  WITH RECURSIVE up AS (
    SELECT m.id AS machine_id, m.id AS node_id, m.replaces_machine_id AS parent_id
      FROM machines m
     WHERE m.deleted_at IS NULL
    UNION ALL
    SELECT u.machine_id, p.id, p.replaces_machine_id
      FROM up u
      JOIN machines p ON p.id = u.parent_id AND p.deleted_at IS NULL
  ),
  chain_root AS (
    SELECT machine_id, node_id AS root_id
      FROM up
     WHERE parent_id IS NULL
  ),
  chain_totals AS (
    SELECT cr.root_id,
           SUM(m.total_repair_cost) AS chain_repair_cost,
           SUM(m.repair_count) AS chain_repair_count,
           COUNT(*) AS chain_length
      FROM chain_root cr
      JOIN machines m ON m.id = cr.machine_id
     GROUP BY cr.root_id
  )
`;

/**
 * The merged event stream. `$2`/`$3` carry the keyset cursor and are null on the first page;
 * the row comparison is what makes "everything strictly older than the last row I showed"
 * expressible without an offset.
 */
const TIMELINE_SQL = `
  WITH events AS (
    SELECT COALESCE(t.confirmed_at, t.occurred_at) AS at,
           'TRANSFER_' || t.status AS type,
           t.id AS ref_id,
           t.reference_no AS ref_no,
           jsonb_build_object(
             'transferType', t.type,
             'direction', t.direction,
             'from', t.from_party_type,
             'to', t.to_party_type,
             'hasCharger', ti.has_charger,
             'hasBox', ti.has_box,
             'batteryMatches', ti.battery_matches
           ) AS details
      FROM transfers t
      JOIN transfer_items ti ON ti.transfer_id = t.id
     WHERE ti.machine_id = $1 AND t.deleted_at IS NULL
    UNION ALL
    SELECT mo.sent_at, 'MAINTENANCE_OPENED', mo.id, mo.reference_no,
           jsonb_build_object(
             'location', ml.code,
             'reportedFault', mo.reported_fault,
             'status', mo.status
           )
      FROM maintenance_orders mo
      JOIN maintenance_locations ml ON ml.id = mo.maintenance_location_id
     WHERE mo.machine_id = $1 AND mo.deleted_at IS NULL
    UNION ALL
    SELECT mo.closed_at, 'MAINTENANCE_CLOSED', mo.id, mo.reference_no,
           jsonb_build_object(
             'result', mo.result,
             'cost', mo.cost,
             'free', mo.is_free_under_warranty,
             'responsibleParty', mo.responsible_party
           )
      FROM maintenance_orders mo
     WHERE mo.machine_id = $1 AND mo.closed_at IS NOT NULL AND mo.deleted_at IS NULL
    UNION ALL
    SELECT v.created_at, 'VIOLATION_CREATED', v.id, NULL,
           jsonb_build_object(
             'type', vt.code,
             'severity', v.severity,
             'againstUserId', v.user_id,
             'status', v.status
           )
      FROM violations v
      JOIN violation_types vt ON vt.id = v.violation_type_id
     WHERE v.machine_id = $1 AND v.deleted_at IS NULL
    UNION ALL
    SELECT r.replaced_at, 'MACHINE_REPLACED', r.id, NULL,
           jsonb_build_object(
             'oldSerial', old_machine.serial,
             'newSerial', new_machine.serial,
             'reason', r.reason
           )
      FROM machine_replacements r
      JOIN machines old_machine ON old_machine.id = r.old_machine_id
      JOIN machines new_machine ON new_machine.id = r.new_machine_id
     WHERE (r.old_machine_id = $1 OR r.new_machine_id = $1) AND r.deleted_at IS NULL
    UNION ALL
    SELECT d.decommissioned_at, 'DECOMMISSIONED', d.id, NULL,
           jsonb_build_object(
             'reason', dr.code,
             'notes', d.notes,
             'repairCost', d.cumulative_repair_cost_at_decision
           )
      FROM decommissions d
      JOIN decommission_reasons dr ON dr.id = d.decommission_reason_id
     WHERE d.machine_id = $1 AND d.deleted_at IS NULL
    UNION ALL
    SELECT d.reverted_at, 'DECOMMISSION_REVERTED', d.id, NULL,
           jsonb_build_object('reason', d.revert_reason)
      FROM decommissions d
     WHERE d.machine_id = $1 AND d.reverted_at IS NOT NULL AND d.deleted_at IS NULL
  )
  SELECT at, type, ref_id, ref_no, details
    FROM events
   WHERE at IS NOT NULL
     AND ($2::timestamptz IS NULL OR (at, ref_id) < ($2::timestamptz, $3::uuid))
`;

/**
 * Echoes the thresholds the list was built with (`13`), which the caller cannot otherwise know:
 * the defaults come from settings, not from the request. Attached to the pagination meta so the
 * response keeps the standard `{ data, meta }` envelope.
 */
function withCriteria<T>(
  page: PaginatedResult<T>,
  criteria: Record<string, number | null>,
): PaginatedResult<T> {
  Object.assign(page.meta as unknown as Record<string, unknown>, { criteria });
  return page;
}
