import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ReportKey } from 'src/common/enums/report.enum';
import { ExportColumn } from 'src/common/export';
import { dateOnly, money, num } from '../report-filters';
import { LATE_CONFIRMATION_HOURS, representativeScore, SCORE_FORMULA } from '../report-scoring';
import { ReportContext, ReportResult, SqlTemporal } from '../report.types';

/**
 * The transfer, people and merchant reports of `17`.
 *
 * Every aggregate is a `GROUP BY` or a correlated `LATERAL`, never a loop over rows in Node.
 * The representative report is the one that looks expensive and is not: the laterals run once
 * per representative — tens of accounts, not tens of thousands of rows.
 */
@Injectable()
export class OperationsReportsService {
  constructor(private readonly dataSource: DataSource) {}

  /** Every hand-off in the window, with both parties resolved to names. */
  async transfersLog(context: ReportContext): Promise<ReportResult> {
    const rows = await this.dataSource.query<TransferRow[]>(
      `SELECT t.id, t.reference_no, t.type, t.direction, t.status,
              t.occurred_at, t.confirmed_at,
              COALESCE(b.name, '—') AS branch_name,
              ${partyName('from')} AS from_name,
              t.from_party_type,
              ${partyName('to')} AS to_name,
              t.to_party_type,
              items.total AS item_count,
              initiator.full_name AS initiated_by
         FROM transfers t
         LEFT JOIN branches b ON b.id = t.branch_id
         LEFT JOIN users from_user ON from_user.id = t.from_party_id
         LEFT JOIN merchants from_merchant ON from_merchant.id = t.from_party_id
         LEFT JOIN warehouses from_warehouse ON from_warehouse.id = t.from_party_id
         LEFT JOIN users to_user ON to_user.id = t.to_party_id
         LEFT JOIN merchants to_merchant ON to_merchant.id = t.to_party_id
         LEFT JOIN warehouses to_warehouse ON to_warehouse.id = t.to_party_id
         JOIN users initiator ON initiator.id = t.initiated_by_user_id
         LEFT JOIN LATERAL (
              SELECT COUNT(*)::int AS total
                FROM transfer_items ti
               WHERE ti.transfer_id = t.id
         ) items ON true
        WHERE t.deleted_at IS NULL
          AND t.occurred_at >= $1::date
          AND t.occurred_at < ($2::date + 1)
          AND ($3::uuid IS NULL OR t.branch_id = $3::uuid)
        ORDER BY t.occurred_at DESC
        LIMIT $4`,
      [context.from, context.to, context.branchId, context.maxRows],
    );

    return {
      key: ReportKey.TRANSFERS_LOG,
      generatedAt: new Date().toISOString(),
      filters: { from: context.from, to: context.to, branchId: context.branchId },
      columns: TRANSFER_COLUMNS,
      rows: rows.map((row) => ({
        referenceNo: row.reference_no,
        occurredAt: dateOnly(row.occurred_at),
        type: row.type,
        direction: row.direction,
        status: row.status,
        branch: row.branch_name,
        fromParty: `${row.from_name} (${row.from_party_type})`,
        toParty: `${row.to_name} (${row.to_party_type})`,
        machines: row.item_count,
        initiatedBy: row.initiated_by,
        confirmedAt: dateOnly(row.confirmed_at),
      })),
      totals: {
        transfers: rows.length,
        machines: rows.reduce((sum, row) => sum + row.item_count, 0),
        confirmed: rows.filter((row) => row.status === 'CONFIRMED').length,
      },
      truncated: rows.length >= context.maxRows,
    };
  }

  /** Hand-offs waiting on a signature, oldest first — the queue a supervisor works down. */
  async transfersPending(context: ReportContext): Promise<ReportResult> {
    const rows = await this.dataSource.query<PendingTransferRow[]>(
      `SELECT t.id, t.reference_no, t.type, t.occurred_at,
              COALESCE(b.name, '—') AS branch_name,
              ${partyName('from')} AS from_name,
              ${partyName('to')} AS to_name,
              t.to_party_type,
              items.total AS item_count,
              EXTRACT(EPOCH FROM (now() - t.occurred_at)) / 3600 AS waiting_hours
         FROM transfers t
         LEFT JOIN branches b ON b.id = t.branch_id
         LEFT JOIN users from_user ON from_user.id = t.from_party_id
         LEFT JOIN merchants from_merchant ON from_merchant.id = t.from_party_id
         LEFT JOIN warehouses from_warehouse ON from_warehouse.id = t.from_party_id
         LEFT JOIN users to_user ON to_user.id = t.to_party_id
         LEFT JOIN merchants to_merchant ON to_merchant.id = t.to_party_id
         LEFT JOIN warehouses to_warehouse ON to_warehouse.id = t.to_party_id
         LEFT JOIN LATERAL (
              SELECT COUNT(*)::int AS total
                FROM transfer_items ti
               WHERE ti.transfer_id = t.id
         ) items ON true
        WHERE t.deleted_at IS NULL
          AND t.status = 'PENDING'
          AND ($1::uuid IS NULL OR t.branch_id = $1::uuid)
        ORDER BY t.occurred_at ASC
        LIMIT $2`,
      [context.branchId, context.maxRows],
    );

    // Deliberately not date-filtered: a hand-off nobody signed six months ago is the whole point
    // of this report, and the shared `dateFrom` default would hide it.
    return {
      key: ReportKey.TRANSFERS_PENDING,
      generatedAt: new Date().toISOString(),
      filters: { branchId: context.branchId },
      columns: PENDING_COLUMNS,
      rows: rows.map((row) => ({
        referenceNo: row.reference_no,
        occurredAt: dateOnly(row.occurred_at),
        type: row.type,
        branch: row.branch_name,
        fromParty: row.from_name,
        toParty: `${row.to_name} (${row.to_party_type})`,
        machines: row.item_count,
        waitingHours: Math.round(num(row.waiting_hours)),
      })),
      totals: {
        pending: rows.length,
        machines: rows.reduce((sum, row) => sum + row.item_count, 0),
        overdue: rows.filter((row) => num(row.waiting_hours) > LATE_CONFIRMATION_HOURS).length,
      },
      truncated: rows.length >= context.maxRows,
    };
  }

  /**
   * One row per representative, with the score of `17` and the formula that produced it.
   *
   * `lateConfirmations` counts both a hand-off signed after the grace window and one still
   * unsigned past it — from the sender's point of view those are the same failure, and only
   * counting the signed ones would reward never signing at all.
   */
  async representativePerformance(context: ReportContext): Promise<ReportResult> {
    const rows = await this.dataSource.query<RepresentativeRow[]>(
      `SELECT u.id, u.full_name, COALESCE(b.name, '—') AS branch_name,
              held.total AS machines_held,
              received.total AS transfers_received,
              received.late AS late_confirmations,
              received.avg_hours AS avg_confirmation_hours,
              returned.total AS transfers_returned,
              merchants.total AS merchants_registered,
              sent_to_maintenance.total AS machines_to_maintenance,
              violations.high, violations.medium, violations.low, violations.charged
         FROM users u
         JOIN roles r ON r.id = u.role_id AND r.code = 'REPRESENTATIVE'
         LEFT JOIN branches b ON b.id = u.branch_id
         LEFT JOIN LATERAL (
              SELECT COUNT(*)::int AS total
                FROM machines m
               WHERE m.current_holder_id = u.id
                 AND m.current_holder_type = 'REPRESENTATIVE'
                 AND m.deleted_at IS NULL
         ) held ON true
         LEFT JOIN LATERAL (
              SELECT COUNT(*)::int AS total,
                     COUNT(*) FILTER (
                       WHERE (t.confirmed_at IS NOT NULL
                              AND t.confirmed_at > t.occurred_at + ($4 || ' hours')::interval)
                          OR (t.status = 'PENDING'
                              AND now() > t.occurred_at + ($4 || ' hours')::interval)
                     )::int AS late,
                     AVG(EXTRACT(EPOCH FROM (t.confirmed_at - t.occurred_at)) / 3600) AS avg_hours
                FROM transfers t
               WHERE t.to_party_id = u.id
                 AND t.to_party_type = 'REPRESENTATIVE'
                 AND t.deleted_at IS NULL
                 AND t.occurred_at >= $1::date AND t.occurred_at < ($2::date + 1)
         ) received ON true
         LEFT JOIN LATERAL (
              SELECT COUNT(*)::int AS total
                FROM transfers t
               WHERE t.from_party_id = u.id
                 AND t.from_party_type = 'REPRESENTATIVE'
                 AND t.direction = 'RETURN'
                 AND t.deleted_at IS NULL
                 AND t.occurred_at >= $1::date AND t.occurred_at < ($2::date + 1)
         ) returned ON true
         LEFT JOIN LATERAL (
              SELECT COUNT(*)::int AS total
                FROM merchants mer
               WHERE mer.created_by_user_id = u.id
                 AND mer.deleted_at IS NULL
                 AND mer.created_at >= $1::date AND mer.created_at < ($2::date + 1)
         ) merchants ON true
         LEFT JOIN LATERAL (
              SELECT COUNT(*)::int AS total
                FROM maintenance_orders mo
               WHERE mo.created_by = u.id
                 AND mo.deleted_at IS NULL
                 AND mo.sent_at >= $1::date AND mo.sent_at < ($2::date + 1)
         ) sent_to_maintenance ON true
         LEFT JOIN LATERAL (
              SELECT COUNT(*) FILTER (WHERE v.severity = 'HIGH')::int AS high,
                     COUNT(*) FILTER (WHERE v.severity = 'MEDIUM')::int AS medium,
                     COUNT(*) FILTER (WHERE v.severity = 'LOW')::int AS low,
                     COALESCE(SUM(v.charged_amount) FILTER (WHERE v.status = 'CHARGED'), 0) AS charged
                FROM violations v
               WHERE v.user_id = u.id
                 AND v.deleted_at IS NULL
                 AND v.status <> 'WAIVED'
                 AND v.created_at >= $1::date AND v.created_at < ($2::date + 1)
         ) violations ON true
        WHERE u.deleted_at IS NULL
          AND u.is_active = true
          AND ($3::uuid IS NULL OR u.branch_id = $3::uuid)
        ORDER BY u.full_name ASC
        LIMIT $5`,
      [
        context.from,
        context.to,
        context.branchId,
        String(LATE_CONFIRMATION_HOURS),
        context.maxRows,
      ],
    );

    const mapped = rows.map((row) => ({
      userId: row.id,
      name: row.full_name,
      branch: row.branch_name,
      machinesHeld: row.machines_held,
      transfersReceived: row.transfers_received,
      transfersReturned: row.transfers_returned,
      merchantsRegistered: row.merchants_registered,
      machinesToMaintenance: row.machines_to_maintenance,
      avgConfirmationHours: Math.round(num(row.avg_confirmation_hours) * 10) / 10,
      lateConfirmations: row.late_confirmations,
      highViolations: row.high,
      mediumViolations: row.medium,
      lowViolations: row.low,
      chargedAmount: money(row.charged),
      score: representativeScore({
        high: row.high,
        medium: row.medium,
        low: row.low,
        lateConfirmations: row.late_confirmations,
      }),
    }));

    return {
      key: ReportKey.REPRESENTATIVE_PERFORMANCE,
      generatedAt: new Date().toISOString(),
      filters: { from: context.from, to: context.to, branchId: context.branchId },
      columns: REPRESENTATIVE_COLUMNS,
      rows: mapped,
      totals: {
        representatives: mapped.length,
        chargedAmount: money(mapped.reduce((sum, row) => sum + row.chargedAmount, 0)),
        averageScore: mapped.length
          ? Math.round(mapped.reduce((sum, row) => sum + row.score, 0) / mapped.length)
          : 0,
      },
      extra: { scoreFormula: SCORE_FORMULA, lateConfirmationHours: LATE_CONFIRMATION_HOURS },
      truncated: rows.length >= context.maxRows,
    };
  }

  /** The violations register: every line on file in the window (`17`). */
  async violationsRegister(context: ReportContext): Promise<ReportResult> {
    const rows = await this.dataSource.query<ViolationRow[]>(
      `SELECT v.id, v.created_at, v.severity, v.status, v.charged_amount, v.auto_generated,
              COALESCE(vtt.name, vt.code) AS type_name,
              u.full_name AS user_name,
              COALESCE(m.serial, '—') AS serial,
              COALESCE(b.name, '—') AS branch_name,
              COALESCE(t.reference_no, '—') AS transfer_reference
         FROM violations v
         JOIN violation_types vt ON vt.id = v.violation_type_id
         LEFT JOIN violation_type_translations vtt
                ON vtt.violation_type_id = vt.id AND vtt.locale = $1
         JOIN users u ON u.id = v.user_id
         LEFT JOIN machines m ON m.id = v.machine_id
         LEFT JOIN branches b ON b.id = v.branch_id
         LEFT JOIN transfers t ON t.id = v.transfer_id
        WHERE v.deleted_at IS NULL
          AND v.created_at >= $2::date AND v.created_at < ($3::date + 1)
          AND ($4::uuid IS NULL OR v.branch_id = $4::uuid)
        ORDER BY v.created_at DESC
        LIMIT $5`,
      [context.locale, context.from, context.to, context.branchId, context.maxRows],
    );

    const bySeverity = await this.dataSource.query<{ severity: string; total: number }[]>(
      `SELECT v.severity, COUNT(*)::int AS total
         FROM violations v
        WHERE v.deleted_at IS NULL
          AND v.created_at >= $1::date AND v.created_at < ($2::date + 1)
          AND ($3::uuid IS NULL OR v.branch_id = $3::uuid)
        GROUP BY v.severity`,
      [context.from, context.to, context.branchId],
    );

    return {
      key: ReportKey.VIOLATIONS_REGISTER,
      generatedAt: new Date().toISOString(),
      filters: { from: context.from, to: context.to, branchId: context.branchId },
      columns: VIOLATION_COLUMNS,
      rows: rows.map((row) => ({
        createdAt: dateOnly(row.created_at),
        typeName: row.type_name,
        userName: row.user_name,
        serial: row.serial,
        branch: row.branch_name,
        severity: row.severity,
        status: row.status,
        chargedAmount: row.charged_amount === null ? null : money(row.charged_amount),
        transferReference: row.transfer_reference,
        autoGenerated: row.auto_generated ? 'AUTO' : 'MANUAL',
      })),
      totals: {
        violations: rows.length,
        chargedAmount: money(rows.reduce((sum, row) => sum + num(row.charged_amount), 0)),
      },
      extra: {
        bySeverity: Object.fromEntries(bySeverity.map((entry) => [entry.severity, entry.total])),
      },
      truncated: rows.length >= context.maxRows,
    };
  }

  /** Merchants with what they hold and what they owe (`17`). */
  async merchantPortfolio(context: ReportContext): Promise<ReportResult> {
    const rows = await this.dataSource.query<MerchantRow[]>(
      `SELECT mer.id, mer.name, mer.shop_name, mer.phone, mer.is_active,
              COALESCE(b.name, '—') AS branch_name,
              rep.full_name AS registered_by,
              mer.created_at,
              machines.total AS machines_held,
              subs.active_plans, subs.amount_due, subs.total_collected,
              subs.next_due_date, subs.overdue_count
         FROM merchants mer
         LEFT JOIN branches b ON b.id = mer.branch_id
         JOIN users rep ON rep.id = mer.created_by_user_id
         LEFT JOIN LATERAL (
              SELECT COUNT(*)::int AS total
                FROM machines m
               WHERE m.current_holder_id = mer.id
                 AND m.current_holder_type = 'MERCHANT'
                 AND m.deleted_at IS NULL
         ) machines ON true
         LEFT JOIN LATERAL (
              SELECT COUNT(*) FILTER (WHERE s.is_active)::int AS active_plans,
                     COALESCE(SUM(s.amount) FILTER (WHERE s.is_active), 0) AS amount_due,
                     COALESCE(SUM(s.total_collected), 0) AS total_collected,
                     MIN(s.next_due_date) FILTER (WHERE s.is_active) AS next_due_date,
                     COUNT(*) FILTER (
                       WHERE s.is_active AND s.next_due_date IS NOT NULL
                         AND s.next_due_date < CURRENT_DATE
                     )::int AS overdue_count
                FROM merchant_subscriptions s
               WHERE s.merchant_id = mer.id AND s.deleted_at IS NULL
         ) subs ON true
        WHERE mer.deleted_at IS NULL
          AND ($1::uuid IS NULL OR mer.branch_id = $1::uuid)
        ORDER BY machines.total DESC, mer.shop_name ASC
        LIMIT $2`,
      [context.branchId, context.maxRows],
    );

    return {
      key: ReportKey.MERCHANT_PORTFOLIO,
      generatedAt: new Date().toISOString(),
      filters: { branchId: context.branchId },
      columns: MERCHANT_COLUMNS,
      rows: rows.map((row) => ({
        shopName: row.shop_name,
        name: row.name,
        phone: row.phone,
        branch: row.branch_name,
        registeredBy: row.registered_by,
        machinesHeld: row.machines_held,
        activePlans: row.active_plans,
        amountDue: money(row.amount_due),
        totalCollected: money(row.total_collected),
        nextDueDate: dateOnly(row.next_due_date),
        overduePlans: row.overdue_count,
        isActive: row.is_active ? 'ACTIVE' : 'INACTIVE',
      })),
      totals: {
        merchants: rows.length,
        machinesHeld: rows.reduce((sum, row) => sum + row.machines_held, 0),
        totalCollected: money(rows.reduce((sum, row) => sum + num(row.total_collected), 0)),
        overduePlans: rows.reduce((sum, row) => sum + row.overdue_count, 0),
      },
      truncated: rows.length >= context.maxRows,
    };
  }

  /** Maintenance orders in the window, with who ended up paying (`17`). */
  async maintenanceLog(context: ReportContext): Promise<ReportResult> {
    const rows = await this.dataSource.query<MaintenanceRow[]>(
      `SELECT mo.id, mo.reference_no, mo.sent_at, mo.returned_at, mo.status, mo.result,
              mo.cost, mo.is_free_under_warranty, mo.responsible_party,
              m.serial,
              COALESCE(mlt.name, ml.code) AS location_name,
              COALESCE(b.name, '—') AS branch_name,
              COALESCE(ru.full_name, rm.shop_name, '—') AS responsible_name,
              mo.reported_fault
         FROM maintenance_orders mo
         JOIN machines m ON m.id = mo.machine_id
         JOIN maintenance_locations ml ON ml.id = mo.maintenance_location_id
         LEFT JOIN maintenance_location_translations mlt
                ON mlt.maintenance_location_id = ml.id AND mlt.locale = $1
         LEFT JOIN branches b ON b.id = mo.branch_id
         LEFT JOIN users ru ON ru.id = mo.responsible_user_id
         LEFT JOIN merchants rm ON rm.id = mo.responsible_merchant_id
        WHERE mo.deleted_at IS NULL
          AND mo.sent_at >= $2::date AND mo.sent_at < ($3::date + 1)
          AND ($4::uuid IS NULL OR mo.branch_id = $4::uuid)
        ORDER BY mo.sent_at DESC
        LIMIT $5`,
      [context.locale, context.from, context.to, context.branchId, context.maxRows],
    );

    const byResult = await this.dataSource.query<{ result: string | null; total: number }[]>(
      `SELECT mo.result, COUNT(*)::int AS total
         FROM maintenance_orders mo
        WHERE mo.deleted_at IS NULL
          AND mo.sent_at >= $1::date AND mo.sent_at < ($2::date + 1)
          AND ($3::uuid IS NULL OR mo.branch_id = $3::uuid)
        GROUP BY mo.result`,
      [context.from, context.to, context.branchId],
    );

    return {
      key: ReportKey.MAINTENANCE_LOG,
      generatedAt: new Date().toISOString(),
      filters: { from: context.from, to: context.to, branchId: context.branchId },
      columns: MAINTENANCE_COLUMNS,
      rows: rows.map((row) => ({
        referenceNo: row.reference_no,
        serial: row.serial,
        sentAt: dateOnly(row.sent_at),
        returnedAt: dateOnly(row.returned_at),
        location: row.location_name,
        branch: row.branch_name,
        status: row.status,
        result: row.result,
        cost: row.cost === null ? null : money(row.cost),
        underWarranty: row.is_free_under_warranty ? 'YES' : 'NO',
        responsibleParty: row.responsible_party,
        responsibleName: row.responsible_name,
        reportedFault: row.reported_fault,
      })),
      totals: {
        orders: rows.length,
        cost: money(rows.reduce((sum, row) => sum + num(row.cost), 0)),
        underWarranty: rows.filter((row) => row.is_free_under_warranty).length,
      },
      extra: {
        byResult: Object.fromEntries(
          byResult.map((entry) => [entry.result ?? 'PENDING', entry.total]),
        ),
      },
      truncated: rows.length >= context.maxRows,
    };
  }
}

/**
 * A transfer party is polymorphic, so its name lives in one of three tables and the alias set is
 * identical on both sides. Built here rather than repeated so the two legs cannot drift.
 */
function partyName(side: 'from' | 'to'): string {
  return `COALESCE(${side}_user.full_name, ${side}_merchant.shop_name, ${side}_warehouse.name, '—')`;
}

const TRANSFER_COLUMNS: ExportColumn[] = [
  { key: 'referenceNo', header: 'رقم الإذن', type: 'text' },
  { key: 'occurredAt', header: 'التاريخ', type: 'date' },
  { key: 'type', header: 'النوع', type: 'text' },
  { key: 'direction', header: 'الاتجاه', type: 'text' },
  { key: 'status', header: 'الحالة', type: 'text' },
  { key: 'branch', header: 'الفرع', type: 'text' },
  { key: 'fromParty', header: 'من', type: 'text' },
  { key: 'toParty', header: 'إلى', type: 'text' },
  { key: 'machines', header: 'عدد الماكينات', type: 'number' },
  { key: 'initiatedBy', header: 'أنشأه', type: 'text' },
  { key: 'confirmedAt', header: 'تاريخ التأكيد', type: 'date' },
];

const PENDING_COLUMNS: ExportColumn[] = [
  { key: 'referenceNo', header: 'رقم الإذن', type: 'text' },
  { key: 'occurredAt', header: 'التاريخ', type: 'date' },
  { key: 'type', header: 'النوع', type: 'text' },
  { key: 'branch', header: 'الفرع', type: 'text' },
  { key: 'fromParty', header: 'من', type: 'text' },
  { key: 'toParty', header: 'إلى', type: 'text' },
  { key: 'machines', header: 'عدد الماكينات', type: 'number' },
  { key: 'waitingHours', header: 'ساعات الانتظار', type: 'number' },
];

const REPRESENTATIVE_COLUMNS: ExportColumn[] = [
  { key: 'name', header: 'المندوب', type: 'text' },
  { key: 'branch', header: 'الفرع', type: 'text' },
  { key: 'machinesHeld', header: 'ماكينات بالعهدة', type: 'number' },
  { key: 'transfersReceived', header: 'تسليمات مستلمة', type: 'number' },
  { key: 'transfersReturned', header: 'تسليمات مرتجعة', type: 'number' },
  { key: 'merchantsRegistered', header: 'تجار مسجلون', type: 'number' },
  { key: 'machinesToMaintenance', header: 'ماكينات للصيانة', type: 'number' },
  { key: 'avgConfirmationHours', header: 'متوسط ساعات التأكيد', type: 'number' },
  { key: 'lateConfirmations', header: 'تأكيدات متأخرة', type: 'number' },
  { key: 'highViolations', header: 'مخالفات جسيمة', type: 'number' },
  { key: 'mediumViolations', header: 'مخالفات متوسطة', type: 'number' },
  { key: 'lowViolations', header: 'مخالفات بسيطة', type: 'number' },
  { key: 'chargedAmount', header: 'المبالغ المحصلة', type: 'number' },
  { key: 'score', header: 'التقييم', type: 'number' },
];

const VIOLATION_COLUMNS: ExportColumn[] = [
  { key: 'createdAt', header: 'التاريخ', type: 'date' },
  { key: 'typeName', header: 'نوع المخالفة', type: 'text' },
  { key: 'userName', header: 'المسؤول', type: 'text' },
  { key: 'serial', header: 'الماكينة', type: 'text' },
  { key: 'branch', header: 'الفرع', type: 'text' },
  { key: 'severity', header: 'الجسامة', type: 'text' },
  { key: 'status', header: 'الحالة', type: 'text' },
  { key: 'chargedAmount', header: 'المبلغ', type: 'number' },
  { key: 'transferReference', header: 'إذن التسليم', type: 'text' },
  { key: 'autoGenerated', header: 'المصدر', type: 'text' },
];

const MERCHANT_COLUMNS: ExportColumn[] = [
  { key: 'shopName', header: 'المحل', type: 'text' },
  { key: 'name', header: 'التاجر', type: 'text' },
  { key: 'phone', header: 'الهاتف', type: 'text' },
  { key: 'branch', header: 'الفرع', type: 'text' },
  { key: 'registeredBy', header: 'سجله', type: 'text' },
  { key: 'machinesHeld', header: 'الماكينات', type: 'number' },
  { key: 'activePlans', header: 'اشتراكات نشطة', type: 'number' },
  { key: 'amountDue', header: 'قيمة الاشتراك', type: 'number' },
  { key: 'totalCollected', header: 'إجمالي المحصل', type: 'number' },
  { key: 'nextDueDate', header: 'الاستحقاق القادم', type: 'date' },
  { key: 'overduePlans', header: 'متأخرات', type: 'number' },
  { key: 'isActive', header: 'الحالة', type: 'text' },
];

const MAINTENANCE_COLUMNS: ExportColumn[] = [
  { key: 'referenceNo', header: 'رقم الأمر', type: 'text' },
  { key: 'serial', header: 'الماكينة', type: 'text' },
  { key: 'sentAt', header: 'تاريخ الإرسال', type: 'date' },
  { key: 'returnedAt', header: 'تاريخ العودة', type: 'date' },
  { key: 'location', header: 'جهة الصيانة', type: 'text' },
  { key: 'branch', header: 'الفرع', type: 'text' },
  { key: 'status', header: 'الحالة', type: 'text' },
  { key: 'result', header: 'النتيجة', type: 'text' },
  { key: 'cost', header: 'التكلفة', type: 'number' },
  { key: 'underWarranty', header: 'تحت الضمان', type: 'text' },
  { key: 'responsibleParty', header: 'جهة التحمل', type: 'text' },
  { key: 'responsibleName', header: 'المسؤول', type: 'text' },
  { key: 'reportedFault', header: 'العطل', type: 'text' },
];

interface TransferRow {
  id: string;
  reference_no: string;
  type: string;
  direction: string;
  status: string;
  occurred_at: SqlTemporal;
  confirmed_at: SqlTemporal | null;
  branch_name: string;
  from_name: string;
  from_party_type: string;
  to_name: string;
  to_party_type: string;
  item_count: number;
  initiated_by: string;
}

interface PendingTransferRow {
  id: string;
  reference_no: string;
  type: string;
  occurred_at: SqlTemporal;
  branch_name: string;
  from_name: string;
  to_name: string;
  to_party_type: string;
  item_count: number;
  waiting_hours: string;
}

interface RepresentativeRow {
  id: string;
  full_name: string;
  branch_name: string;
  machines_held: number;
  transfers_received: number;
  late_confirmations: number;
  avg_confirmation_hours: string | null;
  transfers_returned: number;
  merchants_registered: number;
  machines_to_maintenance: number;
  high: number;
  medium: number;
  low: number;
  charged: string;
}

interface ViolationRow {
  id: string;
  created_at: SqlTemporal;
  severity: string;
  status: string;
  charged_amount: string | null;
  auto_generated: boolean;
  type_name: string;
  user_name: string;
  serial: string;
  branch_name: string;
  transfer_reference: string;
}

interface MerchantRow {
  id: string;
  name: string;
  shop_name: string;
  phone: string;
  is_active: boolean;
  branch_name: string;
  registered_by: string;
  created_at: SqlTemporal;
  machines_held: number;
  active_plans: number;
  amount_due: string;
  total_collected: string;
  next_due_date: SqlTemporal | null;
  overdue_count: number;
}

interface MaintenanceRow {
  id: string;
  reference_no: string;
  sent_at: SqlTemporal;
  returned_at: SqlTemporal | null;
  status: string;
  result: string | null;
  cost: string | null;
  is_free_under_warranty: boolean;
  responsible_party: string | null;
  serial: string;
  location_name: string;
  branch_name: string;
  responsible_name: string;
  reported_fault: string;
}
