import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ErrorCode } from 'src/common/constants/error-codes';
import { Locale } from 'src/common/constants/locales';
import { FinanceKind } from 'src/common/enums/finance.enum';
import { AppException } from 'src/common/errors';
import { BranchScope } from 'src/common/types/request.types';
import { joinTranslation, pickTranslation } from 'src/common/utils';
import { PaymentMethod } from 'src/modules/lookups/entities/payment-method.entity';
import { FinanceByCategoryQueryDto, FinanceSummaryQueryDto } from '../dto/finance-transaction.dto';
import {
  CategoryBudgetRefResponse,
  FinanceByCategoryResponse,
  FinanceSummaryResponse,
} from '../dto/responses/finance-report.response';
import { FinanceTransaction } from '../entities/finance-transaction.entity';
import { budgetStatusOf, round, usedPercentOf } from '../budget-rules';
import {
  assembleCategoryTree,
  CategoryAggregate,
  categoryName,
  CategoryTreeNode,
  flattenCategoryTree,
  limitTreeDepth,
  subtreeRows,
} from '../category-tree';
import { toByCategoryNodeResponse } from '../mappers/finance-report.mapper';
import { BudgetsService } from './budgets.service';
import { FinanceCategoriesService } from './finance-categories.service';

/** How many lines the dashboard's category block has room for. */
const TOP_CATEGORY_LIMIT = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

interface Period {
  from: string;
  to: string;
}

@Injectable()
export class FinanceReportsService {
  constructor(
    @InjectRepository(FinanceTransaction)
    private readonly transactions: Repository<FinanceTransaction>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethods: Repository<PaymentMethod>,
    private readonly categories: FinanceCategoriesService,
    private readonly budgets: BudgetsService,
  ) {}

  /**
   * The dashboard number block (`15`).
   *
   * Three grouped queries — totals by kind, totals by payment method, totals by category — rather
   * than a figure at a time. A voided row is in none of them.
   */
  async summary(
    query: FinanceSummaryQueryDto,
    scope: BranchScope,
    locale: Locale,
  ): Promise<FinanceSummaryResponse> {
    const period = this.periodOf(query.dateFrom, query.dateTo);
    const branchId = this.resolveBranchFilter(query.branchId, scope);

    const current = await this.totalsByKind(period, branchId, scope);
    const previous = query.compareToPrevious ? this.precedingPeriod(period) : null;

    const income = current.get(FinanceKind.INCOME) ?? { total: 0, count: 0 };
    const expense = current.get(FinanceKind.EXPENSE) ?? { total: 0, count: 0 };

    return {
      period,
      income: { total: round(income.total, 2), count: income.count },
      expense: { total: round(expense.total, 2), count: expense.count },
      net: round(income.total - expense.total, 2),
      comparison: previous
        ? await this.comparisonAgainst(previous, income.total, expense.total, branchId, scope)
        : null,
      byPaymentMethod: await this.byPaymentMethod(period, branchId, scope, locale),
      topExpenseCategories: await this.topExpenseCategories(
        period,
        branchId,
        scope,
        locale,
        expense.total,
      ),
    };
  }

  /**
   * "Where did every category's money go" (`15`).
   *
   * One grouped query for the whole period, then the tree is assembled and rolled up in memory.
   * A query per category would be one round trip per node on a report whose entire point is
   * showing every node.
   */
  async byCategory(
    query: FinanceByCategoryQueryDto,
    scope: BranchScope,
    locale: Locale,
  ): Promise<FinanceByCategoryResponse> {
    const period = this.periodOf(query.dateFrom, query.dateTo);
    const branchId = this.resolveBranchFilter(query.branchId, scope);
    const kind = query.kind ?? FinanceKind.EXPENSE;

    const aggregates = await this.totalsByCategory(period, branchId, scope, kind);

    // Every category of this kind is loaded, not only the ones with spend: an ancestor with no
    // direct transactions still has to appear to carry its descendants' roll-up.
    const all = (await this.categories.loadAll(locale)).filter(
      (category) => category.kind === kind,
    );

    const root = query.rootCategoryId
      ? all.find((category) => category.id === query.rootCategoryId)
      : undefined;

    if (query.rootCategoryId && !root) throw AppException.notFound(ErrorCode.NOT_FOUND);

    const roots = assembleCategoryTree(root ? subtreeRows(all, root) : all, aggregates);
    const grandTotal = round(
      roots.reduce((sum, node) => sum + node.rolledUpTotal, 0),
      2,
    );

    const budgets = await this.budgets.coveringPeriod(period.from, period.to, branchId);
    const budgetOf = (node: CategoryTreeNode): CategoryBudgetRefResponse | null => {
      const budget = budgets.get(node.category.id);
      if (!budget) return null;

      const amount = Number(budget.amount);
      const spent = budget.includeSubcategories ? node.rolledUpTotal : node.directTotal;
      const usedPercent = usedPercentOf(spent, amount);

      // The report window's figure is reused rather than re-queried over the budget's own period:
      // the two coincide on the common case, and a second query per node is what this endpoint
      // exists to avoid.
      return {
        amount,
        usedPercent: round(usedPercent, 1),
        status: budgetStatusOf(usedPercent, budget.alertThresholdPercent),
      };
    };

    const displayed = query.maxDepth === undefined ? roots : limitTreeDepth(roots, query.maxDepth);

    return {
      period,
      grandTotal,
      categories: displayed.map((node) =>
        toByCategoryNodeResponse(node, {
          locale,
          grandTotal,
          parentTotal: null,
          budgetOf,
        }),
      ),
    };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Defaults to the current calendar month, which is what a dashboard opens on. */
  private periodOf(from: string | undefined, to: string | undefined, now = new Date()): Period {
    if (from && to) return { from, to };

    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

    return {
      from: from ?? start.toISOString().slice(0, 10),
      to: to ?? end.toISOString().slice(0, 10),
    };
  }

  /** The equally long window ending the day before this one starts. */
  private precedingPeriod(period: Period): Period {
    const from = Date.parse(`${period.from}T00:00:00.000Z`);
    const to = Date.parse(`${period.to}T00:00:00.000Z`);
    const span = to - from + DAY_MS;

    return {
      from: new Date(from - span).toISOString().slice(0, 10),
      to: new Date(to - span).toISOString().slice(0, 10),
    };
  }

  /**
   * A branch filter a caller may narrow but never widen: without `finance.read.all` the scope
   * guard already fixed which branch he reads, and `?branchId=` from him is ignored.
   */
  private resolveBranchFilter(requested: string | undefined, scope: BranchScope): string | null {
    if (scope.unrestricted) return requested ?? null;

    return scope.branchId;
  }

  private base(
    period: Period,
    branchId: string | null,
    scope: BranchScope,
  ): SelectQueryBuilder<FinanceTransaction> {
    const qb = this.transactions
      .createQueryBuilder('transaction')
      .where('transaction.is_voided = false')
      .andWhere('transaction.transaction_date BETWEEN :from AND :to', period);

    if (branchId) {
      // A branch's report includes the company-level rows it shares, exactly as its list does.
      qb.andWhere('(transaction.branch_id = :branchId OR transaction.branch_id IS NULL)', {
        branchId,
      });
    } else if (!scope.unrestricted) {
      qb.andWhere('transaction.branch_id IS NULL');
    }

    return qb;
  }

  private async totalsByKind(
    period: Period,
    branchId: string | null,
    scope: BranchScope,
  ): Promise<Map<FinanceKind, CategoryAggregate>> {
    const rows = await this.base(period, branchId, scope)
      .select('transaction.kind', 'kind')
      .addSelect('SUM(transaction.amount)', 'total')
      .addSelect('COUNT(*)', 'count')
      .groupBy('transaction.kind')
      .getRawMany<{ kind: FinanceKind; total: string; count: string }>();

    return new Map(
      rows.map((row) => [row.kind, { total: Number(row.total), count: Number(row.count) }]),
    );
  }

  private async comparisonAgainst(
    previous: Period,
    income: number,
    expense: number,
    branchId: string | null,
    scope: BranchScope,
  ): Promise<FinanceSummaryResponse['comparison']> {
    const totals = await this.totalsByKind(previous, branchId, scope);
    const priorIncome = totals.get(FinanceKind.INCOME)?.total ?? 0;
    const priorExpense = totals.get(FinanceKind.EXPENSE)?.total ?? 0;

    return {
      period: previous,
      incomeChangePercent: changePercent(priorIncome, income),
      expenseChangePercent: changePercent(priorExpense, expense),
      netChangePercent: changePercent(priorIncome - priorExpense, income - expense),
    };
  }

  private async byPaymentMethod(
    period: Period,
    branchId: string | null,
    scope: BranchScope,
    locale: Locale,
  ): Promise<FinanceSummaryResponse['byPaymentMethod']> {
    const rows = await this.base(period, branchId, scope)
      .select('transaction.payment_method_id', 'id')
      .addSelect('transaction.kind', 'kind')
      .addSelect('SUM(transaction.amount)', 'total')
      .groupBy('transaction.payment_method_id')
      .addGroupBy('transaction.kind')
      .getRawMany<{ id: string; kind: FinanceKind; total: string }>();

    if (rows.length === 0) return [];

    const methodsQb = this.paymentMethods.createQueryBuilder('method');
    joinTranslation(methodsQb, 'method', 'translations', locale);

    const methods = new Map(
      (await methodsQb.getMany()).map((method) => [
        method.id,
        pickTranslation(method.translations, locale)?.name ?? method.code,
      ]),
    );

    const byMethod = new Map<
      string,
      { id: string; name: string; expense: number; income: number }
    >();

    for (const row of rows) {
      const entry = byMethod.get(row.id) ?? {
        id: row.id,
        name: methods.get(row.id) ?? '',
        expense: 0,
        income: 0,
      };

      if (row.kind === FinanceKind.EXPENSE) entry.expense = round(Number(row.total), 2);
      else entry.income = round(Number(row.total), 2);

      byMethod.set(row.id, entry);
    }

    return [...byMethod.values()].sort(
      (first, second) => second.expense + second.income - (first.expense + first.income),
    );
  }

  /**
   * Ranked on the rolled-up figure, so a parent and one of its children can both appear.
   *
   * That is deliberate: `percentOfExpense` is each category's share of total spend, not a slice of
   * a partition, and "operations 65%, of which maintenance 30%" is the sentence a Director wants.
   */
  private async topExpenseCategories(
    period: Period,
    branchId: string | null,
    scope: BranchScope,
    locale: Locale,
    expenseTotal: number,
  ): Promise<FinanceSummaryResponse['topExpenseCategories']> {
    const aggregates = await this.totalsByCategory(period, branchId, scope, FinanceKind.EXPENSE);
    if (aggregates.size === 0) return [];

    const categories = (await this.categories.loadAll(locale)).filter(
      (category) => category.kind === FinanceKind.EXPENSE,
    );

    return flattenCategoryTree(assembleCategoryTree(categories, aggregates))
      .filter((node) => node.rolledUpTotal > 0)
      .sort((first, second) => second.rolledUpTotal - first.rolledUpTotal)
      .slice(0, TOP_CATEGORY_LIMIT)
      .map((node) => ({
        id: node.category.id,
        name: categoryName(node.category, locale),
        total: node.rolledUpTotal,
        percentOfExpense:
          expenseTotal > 0 ? round((node.rolledUpTotal / expenseTotal) * 100, 1) : 0,
      }));
  }

  /** The one grouped query behind both the by-category report and the dashboard's top list. */
  private async totalsByCategory(
    period: Period,
    branchId: string | null,
    scope: BranchScope,
    kind: FinanceKind,
  ): Promise<Map<string, CategoryAggregate>> {
    const rows = await this.base(period, branchId, scope)
      .andWhere('transaction.kind = :kind', { kind })
      .select('transaction.category_id', 'categoryId')
      .addSelect('SUM(transaction.amount)', 'total')
      .addSelect('COUNT(*)', 'count')
      .groupBy('transaction.category_id')
      .getRawMany<{ categoryId: string; total: string; count: string }>();

    return new Map(
      rows.map((row) => [row.categoryId, { total: Number(row.total), count: Number(row.count) }]),
    );
  }
}

/** Null rather than infinity when there was nothing to grow from — a change of ∞% says nothing. */
function changePercent(previous: number, current: number): number | null {
  if (previous === 0) return null;

  return round(((current - previous) / Math.abs(previous)) * 100, 1);
}
