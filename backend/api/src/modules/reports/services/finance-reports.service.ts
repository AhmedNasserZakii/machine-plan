import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FinanceKind } from 'src/common/enums/finance.enum';
import { ReportGranularity, ReportKey } from 'src/common/enums/report.enum';
import { ExportColumn } from 'src/common/export';
import { pickTranslation } from 'src/common/utils';
import { BudgetsService } from 'src/modules/finance/services/budgets.service';
import { money, num, periodBucketExpression } from '../report-filters';
import { ReportContext, ReportResult, ReportRow, ReportRunQuery } from '../report.types';

/**
 * The five finance reports of `17`.
 *
 * Two rules run through all of them. Voided rows are excluded everywhere — a ledger that counts
 * reversed entries is worse than no report. And the category figures are produced by LTREE
 * containment rather than by a recursive walk, so "the whole of operations" costs the same as
 * "spare parts".
 */
@Injectable()
export class FinanceReportsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly budgets: BudgetsService,
  ) {}

  expensesByCategory(context: ReportContext): Promise<ReportResult> {
    return this.byCategory(context, FinanceKind.EXPENSE, ReportKey.EXPENSES_BY_CATEGORY);
  }

  incomeByCategory(context: ReportContext): Promise<ReportResult> {
    return this.byCategory(context, FinanceKind.INCOME, ReportKey.INCOME_BY_CATEGORY);
  }

  /**
   * Income against expense over time (`17`).
   *
   * The database returns one row per bucket per kind; the pivot into `{period, income, expense}`
   * is a reshape of an already-aggregated result, not a second pass over transactions.
   */
  async profitLoss(context: ReportContext, query: ReportRunQuery): Promise<ReportResult> {
    const granularity = query.granularity ?? ReportGranularity.MONTH;
    const bucket = periodBucketExpression(granularity, 'ft.transaction_date');

    const rows = await this.dataSource.query<SeriesRow[]>(
      `SELECT ${bucket} AS bucket, ft.kind, SUM(ft.amount) AS total, COUNT(*)::int AS entries
         FROM finance_transactions ft
        WHERE ft.deleted_at IS NULL
          AND ft.is_voided = false
          AND ft.transaction_date BETWEEN $1::date AND $2::date
          AND ($3::uuid IS NULL OR ft.branch_id = $3::uuid)
        GROUP BY 1, ft.kind
        ORDER BY 1 ASC`,
      [context.from, context.to, context.branchId],
    );

    const periods = new Map<string, { income: number; expense: number; entries: number }>();

    for (const row of rows) {
      const entry = periods.get(row.bucket) ?? { income: 0, expense: 0, entries: 0 };
      if (row.kind === FinanceKind.INCOME) entry.income += num(row.total);
      else entry.expense += num(row.total);
      entry.entries += row.entries;
      periods.set(row.bucket, entry);
    }

    const series: ReportRow[] = [...periods.entries()].map(([period, entry]) => ({
      period,
      income: money(entry.income),
      expense: money(entry.expense),
      net: money(entry.income - entry.expense),
      entries: entry.entries,
    }));

    const income = series.reduce((sum, row) => sum + Number(row.income), 0);
    const expense = series.reduce((sum, row) => sum + Number(row.expense), 0);
    const byBranch = await this.dataSource.query<BranchPnlRow[]>(
      `SELECT b.id, b.name,
              COALESCE(SUM(ft.amount) FILTER (WHERE ft.kind = 'INCOME'), 0) AS income,
              COALESCE(SUM(ft.amount) FILTER (WHERE ft.kind = 'EXPENSE'), 0) AS expense
         FROM branches b
         JOIN finance_transactions ft
           ON ft.branch_id = b.id
          AND ft.deleted_at IS NULL
          AND ft.is_voided = false
          AND ft.transaction_date BETWEEN $1::date AND $2::date
        WHERE b.deleted_at IS NULL
          AND ($3::uuid IS NULL OR b.id = $3::uuid)
        GROUP BY b.id, b.name
        ORDER BY b.name ASC`,
      [context.from, context.to, context.branchId],
    );

    return {
      key: ReportKey.PROFIT_LOSS,
      generatedAt: new Date().toISOString(),
      filters: {
        from: context.from,
        to: context.to,
        branchId: context.branchId,
        granularity,
      },
      columns: PROFIT_LOSS_COLUMNS,
      rows: series,
      totals: {
        income: money(income),
        expense: money(expense),
        net: money(income - expense),
        // Undefined margin rather than zero when nothing came in: a loss on no income is not 0%.
        marginPercent: income > 0 ? Math.round(((income - expense) / income) * 1000) / 10 : 0,
      },
      extra: {
        granularity,
        byBranch: byBranch.map((row) => ({
          branch: { id: row.id, name: row.name },
          income: money(row.income),
          expense: money(row.expense),
          net: money(num(row.income) - num(row.expense)),
        })),
      },
      truncated: false,
    };
  }

  /**
   * Every active budget with what it has consumed (`17`).
   *
   * Delegates to `BudgetsService.status`, which is the same computation the finance screens and
   * the budget alerts use. A second implementation here would eventually disagree with them
   * about the same budget, and the report is the one people would believe.
   */
  async budgetPerformance(context: ReportContext): Promise<ReportResult> {
    const result = await this.budgets.status(
      { branchId: context.branchId ?? undefined, locale: context.locale },
      context.scope,
      context.locale,
    );

    const rows: ReportRow[] = result.computed.map((entry) => {
      const category = result.view.categoriesById.get(entry.budget.categoryId);

      return {
        category:
          pickTranslation(category?.translations, context.locale)?.name ?? category?.code ?? '—',
        branch: entry.budget.branch?.name ?? 'COMPANY',
        periodType: entry.budget.periodType,
        periodStart: entry.budget.periodStart,
        periodEnd: entry.budget.periodEnd,
        amount: money(entry.budget.amount),
        spent: money(entry.spent),
        remaining: money(num(entry.budget.amount) - entry.spent),
        usedPercent: entry.usedPercent,
        elapsedPercent: entry.progress.elapsedPercent,
        status: entry.status,
        projectedTotal: money(entry.pace.projectedTotal),
      };
    });

    return {
      key: ReportKey.BUDGET_PERFORMANCE,
      generatedAt: new Date().toISOString(),
      filters: { branchId: context.branchId, asOf: result.asOf },
      columns: BUDGET_COLUMNS,
      rows,
      totals: {
        budgets: rows.length,
        amount: money(rows.reduce((sum, row) => sum + Number(row.amount), 0)),
        spent: money(rows.reduce((sum, row) => sum + Number(row.spent), 0)),
        exceeded: rows.filter((row) => row.status === 'EXCEEDED').length,
      },
      truncated: false,
    };
  }

  /**
   * Branch against branch on the six numbers that distinguish them (`17`).
   *
   * Six grouped queries keyed on `branch_id` rather than one query with six laterals: they hit
   * six different tables, and a single statement would join a branch's transactions to its
   * machines and multiply both.
   */
  async branchComparison(context: ReportContext): Promise<ReportResult> {
    const branches = await this.dataSource.query<{ id: string; name: string; code: string }[]>(
      `SELECT b.id, b.name, b.code
         FROM branches b
        WHERE b.deleted_at IS NULL
          AND ($1::uuid IS NULL OR b.id = $1::uuid)
        ORDER BY b.name ASC`,
      [context.branchId],
    );

    const [finance, machines, transfers, violations, merchants, maintenance] = await Promise.all([
      this.groupedByBranch(
        `SELECT ft.branch_id AS branch_id,
                COALESCE(SUM(ft.amount) FILTER (WHERE ft.kind = 'INCOME'), 0) AS income,
                COALESCE(SUM(ft.amount) FILTER (WHERE ft.kind = 'EXPENSE'), 0) AS expense
           FROM finance_transactions ft
          WHERE ft.deleted_at IS NULL AND ft.is_voided = false
            AND ft.transaction_date BETWEEN $1::date AND $2::date
          GROUP BY ft.branch_id`,
        [context.from, context.to],
      ),
      this.groupedByBranch(
        `SELECT m.current_branch_id AS branch_id, COUNT(*)::int AS machines
           FROM machines m
          WHERE m.deleted_at IS NULL AND m.status NOT IN ('DECOMMISSIONED', 'REPLACED')
          GROUP BY m.current_branch_id`,
        [],
      ),
      this.groupedByBranch(
        `SELECT t.branch_id AS branch_id,
                COUNT(*)::int AS transfers,
                COUNT(*) FILTER (WHERE t.status = 'PENDING')::int AS pending_transfers
           FROM transfers t
          WHERE t.deleted_at IS NULL
            AND t.occurred_at >= $1::date AND t.occurred_at < ($2::date + 1)
          GROUP BY t.branch_id`,
        [context.from, context.to],
      ),
      this.groupedByBranch(
        `SELECT v.branch_id AS branch_id,
                COUNT(*)::int AS violations,
                COALESCE(SUM(v.charged_amount), 0) AS violation_charges
           FROM violations v
          WHERE v.deleted_at IS NULL
            AND v.created_at >= $1::date AND v.created_at < ($2::date + 1)
          GROUP BY v.branch_id`,
        [context.from, context.to],
      ),
      this.groupedByBranch(
        `SELECT mer.branch_id AS branch_id, COUNT(*)::int AS merchants
           FROM merchants mer
          WHERE mer.deleted_at IS NULL AND mer.is_active = true
          GROUP BY mer.branch_id`,
        [],
      ),
      this.groupedByBranch(
        `SELECT mo.branch_id AS branch_id,
                COUNT(*)::int AS maintenance_orders,
                COALESCE(SUM(mo.cost), 0) AS maintenance_cost
           FROM maintenance_orders mo
          WHERE mo.deleted_at IS NULL
            AND mo.sent_at >= $1::date AND mo.sent_at < ($2::date + 1)
          GROUP BY mo.branch_id`,
        [context.from, context.to],
      ),
    ]);

    const rows: ReportRow[] = branches.map((branch) => {
      const income = num(finance.get(branch.id)?.income);
      const expense = num(finance.get(branch.id)?.expense);

      return {
        branch: branch.name,
        code: branch.code,
        machines: num(machines.get(branch.id)?.machines),
        merchants: num(merchants.get(branch.id)?.merchants),
        transfers: num(transfers.get(branch.id)?.transfers),
        pendingTransfers: num(transfers.get(branch.id)?.pending_transfers),
        violations: num(violations.get(branch.id)?.violations),
        violationCharges: money(violations.get(branch.id)?.violation_charges),
        maintenanceOrders: num(maintenance.get(branch.id)?.maintenance_orders),
        maintenanceCost: money(maintenance.get(branch.id)?.maintenance_cost),
        income: money(income),
        expense: money(expense),
        net: money(income - expense),
      };
    });

    return {
      key: ReportKey.BRANCH_COMPARISON,
      generatedAt: new Date().toISOString(),
      filters: { from: context.from, to: context.to, branchId: context.branchId },
      columns: BRANCH_COLUMNS,
      rows,
      totals: {
        branches: rows.length,
        income: money(rows.reduce((sum, row) => sum + Number(row.income), 0)),
        expense: money(rows.reduce((sum, row) => sum + Number(row.expense), 0)),
        machines: rows.reduce((sum, row) => sum + Number(row.machines), 0),
      },
      truncated: false,
    };
  }

  /**
   * The category breakdown, direct and rolled up (`17`).
   *
   * Both figures are reported because they answer different questions: an accountant reading
   * "Maintenance — 40,000" needs to know whether that is what was booked against the parent or
   * what the whole subtree cost, and a report that shows only one of them is read as the other.
   */
  private async byCategory(
    context: ReportContext,
    kind: FinanceKind,
    key: ReportKey,
  ): Promise<ReportResult> {
    const rows = await this.dataSource.query<CategoryRow[]>(
      `WITH totals AS (
         SELECT ft.category_id, SUM(ft.amount) AS total, COUNT(*)::int AS entries
           FROM finance_transactions ft
          WHERE ft.deleted_at IS NULL
            AND ft.is_voided = false
            AND ft.kind = $1
            AND ft.transaction_date BETWEEN $2::date AND $3::date
            AND ($4::uuid IS NULL OR ft.branch_id = $4::uuid)
          GROUP BY ft.category_id
       )
       SELECT * FROM (
         SELECT fc.id, fc.code, fc.depth, fc.path::text AS path,
                COALESCE(tr.name, fc.code) AS name,
                COALESCE(direct.total, 0) AS direct_total,
                COALESCE(direct.entries, 0) AS direct_entries,
                COALESCE((
                  SELECT SUM(t.total)
                    FROM totals t
                    JOIN finance_categories child ON child.id = t.category_id
                   WHERE child.path <@ fc.path
                ), 0) AS rolled_total,
                COALESCE((
                  SELECT SUM(t.entries)
                    FROM totals t
                    JOIN finance_categories child ON child.id = t.category_id
                   WHERE child.path <@ fc.path
                ), 0)::int AS rolled_entries
           FROM finance_categories fc
           LEFT JOIN finance_category_translations tr
                  ON tr.finance_category_id = fc.id AND tr.locale = $5
           LEFT JOIN totals direct ON direct.category_id = fc.id
          WHERE fc.deleted_at IS NULL AND fc.kind = $1
       ) breakdown
        WHERE breakdown.rolled_total <> 0
        ORDER BY breakdown.path ASC
        LIMIT $6`,
      [kind, context.from, context.to, context.branchId, context.locale, context.maxRows],
    );

    // The roots carry the whole tree between them, so summing every row would count each pound
    // once per level of nesting above it.
    const grandTotal = rows
      .filter((row) => row.depth === 0)
      .reduce((sum, row) => sum + num(row.rolled_total), 0);

    return {
      key,
      generatedAt: new Date().toISOString(),
      filters: { from: context.from, to: context.to, branchId: context.branchId, kind },
      columns: CATEGORY_COLUMNS,
      rows: rows.map((row) => ({
        category: row.name,
        code: row.code,
        depth: row.depth,
        directTotal: money(row.direct_total),
        directEntries: row.direct_entries,
        rolledTotal: money(row.rolled_total),
        rolledEntries: row.rolled_entries,
        sharePercent:
          grandTotal > 0 ? Math.round((num(row.rolled_total) / grandTotal) * 1000) / 10 : 0,
      })),
      totals: { categories: rows.length, total: money(grandTotal) },
      truncated: rows.length >= context.maxRows,
    };
  }

  private async groupedByBranch(
    sql: string,
    params: unknown[],
  ): Promise<Map<string, BranchMetricRow>> {
    const rows = await this.dataSource.query<BranchMetricRow[]>(sql, params);

    return new Map(
      rows
        .filter((row): row is BranchMetricRow & { branch_id: string } => row.branch_id !== null)
        .map((row) => [row.branch_id, row]),
    );
  }
}

const CATEGORY_COLUMNS: ExportColumn[] = [
  { key: 'category', header: 'التصنيف', type: 'text' },
  { key: 'code', header: 'الكود', type: 'text' },
  { key: 'depth', header: 'المستوى', type: 'number' },
  { key: 'directTotal', header: 'مباشر', type: 'number' },
  { key: 'directEntries', header: 'عدد الحركات', type: 'number' },
  { key: 'rolledTotal', header: 'شامل الفروع', type: 'number' },
  { key: 'rolledEntries', header: 'إجمالي الحركات', type: 'number' },
  { key: 'sharePercent', header: 'النسبة %', type: 'number' },
];

const PROFIT_LOSS_COLUMNS: ExportColumn[] = [
  { key: 'period', header: 'الفترة', type: 'text' },
  { key: 'income', header: 'الإيرادات', type: 'number' },
  { key: 'expense', header: 'المصروفات', type: 'number' },
  { key: 'net', header: 'الصافي', type: 'number' },
  { key: 'entries', header: 'عدد الحركات', type: 'number' },
];

const BUDGET_COLUMNS: ExportColumn[] = [
  { key: 'category', header: 'التصنيف', type: 'text' },
  { key: 'branch', header: 'الفرع', type: 'text' },
  { key: 'periodType', header: 'نوع الفترة', type: 'text' },
  { key: 'periodStart', header: 'من', type: 'date' },
  { key: 'periodEnd', header: 'إلى', type: 'date' },
  { key: 'amount', header: 'الميزانية', type: 'number' },
  { key: 'spent', header: 'المنصرف', type: 'number' },
  { key: 'remaining', header: 'المتبقي', type: 'number' },
  { key: 'usedPercent', header: 'نسبة الاستهلاك %', type: 'number' },
  { key: 'elapsedPercent', header: 'نسبة الفترة %', type: 'number' },
  { key: 'projectedTotal', header: 'المتوقع', type: 'number' },
  { key: 'status', header: 'الحالة', type: 'text' },
];

const BRANCH_COLUMNS: ExportColumn[] = [
  { key: 'branch', header: 'الفرع', type: 'text' },
  { key: 'code', header: 'الكود', type: 'text' },
  { key: 'machines', header: 'الماكينات', type: 'number' },
  { key: 'merchants', header: 'التجار', type: 'number' },
  { key: 'transfers', header: 'التسليمات', type: 'number' },
  { key: 'pendingTransfers', header: 'تسليمات معلقة', type: 'number' },
  { key: 'violations', header: 'المخالفات', type: 'number' },
  { key: 'violationCharges', header: 'مبالغ المخالفات', type: 'number' },
  { key: 'maintenanceOrders', header: 'أوامر الصيانة', type: 'number' },
  { key: 'maintenanceCost', header: 'تكلفة الصيانة', type: 'number' },
  { key: 'income', header: 'الإيرادات', type: 'number' },
  { key: 'expense', header: 'المصروفات', type: 'number' },
  { key: 'net', header: 'الصافي', type: 'number' },
];

interface CategoryRow {
  id: string;
  code: string | null;
  depth: number;
  path: string;
  name: string;
  direct_total: string;
  direct_entries: number;
  rolled_total: string;
  rolled_entries: number;
}

interface SeriesRow {
  bucket: string;
  kind: FinanceKind;
  total: string;
  entries: number;
}

interface BranchPnlRow {
  id: string;
  name: string;
  income: string;
  expense: string;
}

interface BranchMetricRow {
  branch_id: string | null;
  income?: string;
  expense?: string;
  machines?: number;
  transfers?: number;
  pending_transfers?: number;
  violations?: number;
  violation_charges?: string;
  merchants?: number;
  maintenance_orders?: number;
  maintenance_cost?: string;
}
