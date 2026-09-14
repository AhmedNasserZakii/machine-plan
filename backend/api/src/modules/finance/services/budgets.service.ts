import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { AuditService } from 'src/common/audit';
import { ErrorCode } from 'src/common/constants/error-codes';
import { Locale } from 'src/common/constants/locales';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { AuditAction, AuditEntityType } from 'src/common/enums';
import { FinanceKind } from 'src/common/enums/finance.enum';
import { AppException } from 'src/common/errors';
import { BranchScope } from 'src/common/types/request.types';
import { Branch } from 'src/modules/organization/entities/branch.entity';
import {
  BudgetStatusQueryDto,
  CreateBudgetDto,
  QueryBudgetsDto,
  UpdateBudgetDto,
} from '../dto/budget.dto';
import { Budget } from '../entities/budget.entity';
import { FinanceCategory } from '../entities/finance-category.entity';
import {
  BudgetPace,
  BudgetPeriodProgress,
  BudgetStatus,
  budgetStatusOf,
  DEFAULT_ALERT_THRESHOLD_PERCENT,
  escalationOf,
  paceOf,
  periodProgressOf,
  round,
  usedPercentOf,
} from '../budget-rules';
import { indexByPathLabel } from '../category-tree';
import { toDateOnly } from '../transaction-rules';
import { FinanceCategoriesService } from './finance-categories.service';

/** A budget plus the numbers a screen needs, so nothing recomputes them per field. */
export interface ComputedBudget {
  budget: Budget;
  spent: number;
  usedPercent: number;
  status: BudgetStatus;
  progress: BudgetPeriodProgress;
  pace: BudgetPace;
}

/** What every budget response needs to render a category's localized ancestry. */
export interface BudgetView {
  locale: Locale;
  categoriesById: Map<string, FinanceCategory>;
  categoriesByLabel: Map<string, FinanceCategory>;
}

export interface BudgetResult {
  budget: Budget;
  view: BudgetView;
}

export interface BudgetListResult {
  page: PaginatedResult<Budget>;
  view: BudgetView;
}

export interface BudgetStatusResult {
  asOf: string;
  page: PaginatedResult<ComputedBudget>;
  view: BudgetView;
}

/** Unpaged status, for the budget-performance report that already has its own row cap. */
export interface BudgetStatusAllResult {
  asOf: string;
  computed: ComputedBudget[];
  view: BudgetView;
}

/** What a finance write hands the alert engine to re-evaluate. */
export interface BudgetTrigger {
  categoryId: string;
  categoryPath: string;
  branchId: string | null;
  transactionDate: string;
}

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget) private readonly budgets: Repository<Budget>,
    private readonly categories: FinanceCategoriesService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    query: QueryBudgetsDto,
    scope: BranchScope,
    locale: Locale,
  ): Promise<BudgetListResult> {
    const qb = this.budgets
      .createQueryBuilder('budget')
      .leftJoinAndSelect('budget.branch', 'branch');

    this.applyScope(qb, scope);

    if (query.categoryId) {
      qb.andWhere('budget.category_id = :categoryId', { categoryId: query.categoryId });
    }
    if (scope.unrestricted && query.branchId) {
      qb.andWhere('budget.branch_id = :branchId', { branchId: query.branchId });
    }
    if (query.activeOn) {
      qb.andWhere('budget.period_start <= :activeOn AND budget.period_end >= :activeOn', {
        activeOn: query.activeOn,
      });
    }
    if (!query.includeInactive) qb.andWhere('budget.is_active = true');

    const [budgets, total] = await qb
      .orderBy('budget.periodStart', 'DESC')
      .addOrderBy('budget.id', 'ASC')
      .skip(query.skip)
      .take(query.take)
      .getManyAndCount();

    return {
      page: new PaginatedResult(budgets, total, query.page, query.limit),
      view: await this.view(locale),
    };
  }

  async findById(id: string, scope: BranchScope, locale: Locale): Promise<BudgetResult> {
    return { budget: await this.requireVisible(id, scope), view: await this.view(locale) };
  }

  async create(
    dto: CreateBudgetDto,
    scope: BranchScope,
    actorId: string,
    locale: Locale,
  ): Promise<BudgetResult> {
    const category = await this.categories.requireById(dto.categoryId);

    // Income is measured, not limited. A "budget" on it would compute a percentage that reads as
    // a warning when the company is doing well, which is the opposite of the signal wanted.
    if (category.kind !== FinanceKind.EXPENSE) {
      throw AppException.unprocessable(ErrorCode.BUDGET_ON_INCOME_CATEGORY);
    }

    if (dto.periodEnd < dto.periodStart) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [
          { field: 'periodEnd', value: dto.periodEnd, constraint: 'must not precede periodStart' },
        ],
      });
    }

    const branchId = await this.resolveBranch(dto.branchId ?? null, scope);
    await this.assertNoOverlap(category.id, branchId, dto.periodStart, dto.periodEnd);

    const created = await this.budgets.save(
      this.budgets.create({
        categoryId: category.id,
        branchId,
        periodType: dto.periodType,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        amount: String(dto.amount),
        alertThresholdPercent: dto.alertThresholdPercent ?? DEFAULT_ALERT_THRESHOLD_PERCENT,
        includeSubcategories: dto.includeSubcategories ?? true,
        autoRenew: dto.autoRenew ?? false,
        isActive: true,
        createdBy: actorId,
      }),
    );

    await this.audit.record({
      userId: actorId,
      action: AuditAction.BUDGET_CREATED,
      entityType: AuditEntityType.BUDGET,
      entityId: created.id,
      after: { categoryId: category.id, branchId, amount: String(dto.amount) },
    });

    return { budget: await this.requireVisible(created.id, scope), view: await this.view(locale) };
  }

  async update(
    id: string,
    dto: UpdateBudgetDto,
    scope: BranchScope,
    actorId: string,
    locale: Locale,
  ): Promise<BudgetResult> {
    const budget = await this.requireVisible(id, scope);

    const patch = {
      ...(dto.amount !== undefined ? { amount: String(dto.amount) } : {}),
      ...(dto.alertThresholdPercent !== undefined
        ? { alertThresholdPercent: dto.alertThresholdPercent }
        : {}),
      ...(dto.includeSubcategories !== undefined
        ? { includeSubcategories: dto.includeSubcategories }
        : {}),
      ...(dto.autoRenew !== undefined ? { autoRenew: dto.autoRenew } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      updatedBy: actorId,
    };

    await this.budgets.update(id, patch);

    await this.audit.record({
      userId: actorId,
      action: AuditAction.BUDGET_UPDATED,
      entityType: AuditEntityType.BUDGET,
      entityId: id,
      before: {
        amount: budget.amount,
        alertThresholdPercent: budget.alertThresholdPercent,
        isActive: budget.isActive,
      },
      after: {
        amount: patch.amount ?? budget.amount,
        alertThresholdPercent: patch.alertThresholdPercent ?? budget.alertThresholdPercent,
        isActive: patch.isActive ?? budget.isActive,
      },
    });

    return { budget: await this.requireVisible(budget.id, scope), view: await this.view(locale) };
  }

  /** Removing a limit says nothing about the money already spent, so no transaction is touched. */
  async remove(id: string, scope: BranchScope, actorId: string): Promise<void> {
    const budget = await this.requireVisible(id, scope);

    await this.budgets.update(budget.id, { updatedBy: actorId });
    await this.budgets.softDelete(budget.id);

    await this.audit.record({
      userId: actorId,
      action: AuditAction.BUDGET_DELETED,
      entityType: AuditEntityType.BUDGET,
      entityId: id,
      before: { amount: budget.amount, categoryId: budget.categoryId },
    });
  }

  async status(
    query: BudgetStatusQueryDto,
    scope: BranchScope,
    locale: Locale,
  ): Promise<BudgetStatusResult> {
    const asOf = query.asOf ?? toDateOnly(new Date());
    const qb = this.statusQuery(query.branchId, scope);
    const [budgets, total] = await qb
      .orderBy('budget.periodStart', 'DESC')
      .addOrderBy('budget.id', 'ASC')
      .skip(query.skip)
      .take(query.take)
      .getManyAndCount();

    return {
      asOf,
      page: new PaginatedResult(
        await this.computeAll(budgets, asOf),
        total,
        query.page,
        query.limit,
      ),
      view: await this.view(locale),
    };
  }

  /**
   * Same rows as `status`, without a page. The budget-performance report needs every matching
   * budget; it already truncates at `context.maxRows`.
   */
  async statusAll(
    query: Pick<BudgetStatusQueryDto, 'asOf' | 'branchId'>,
    scope: BranchScope,
    locale: Locale,
  ): Promise<BudgetStatusAllResult> {
    const asOf = query.asOf ?? toDateOnly(new Date());
    const budgets = await this.statusQuery(query.branchId, scope)
      .orderBy('budget.periodStart', 'DESC')
      .addOrderBy('budget.id', 'ASC')
      .getMany();

    return { asOf, computed: await this.computeAll(budgets, asOf), view: await this.view(locale) };
  }

  private statusQuery(
    branchId: string | undefined,
    scope: BranchScope,
  ): SelectQueryBuilder<Budget> {
    const qb = this.budgets
      .createQueryBuilder('budget')
      .leftJoinAndSelect('budget.branch', 'branch')
      .where('budget.is_active = true');

    this.applyScope(qb, scope);

    if (scope.unrestricted && branchId) {
      qb.andWhere('budget.branch_id = :branchId', { branchId });
    }

    return qb;
  }

  private async computeAll(budgets: Budget[], asOf: string): Promise<ComputedBudget[]> {
    const computed: ComputedBudget[] = [];
    for (const budget of budgets) {
      computed.push(await this.compute(budget, asOf));
    }
    return computed;
  }

  /** The numbers behind one budget line, including the pace that makes it actionable (`16`). */
  async compute(budget: Budget, asOf: string, manager?: EntityManager): Promise<ComputedBudget> {
    const amount = Number(budget.amount);
    const spent = await this.spentFor(budget, manager);
    const usedPercent = usedPercentOf(spent, amount);
    const progress = periodProgressOf(budget.periodStart, budget.periodEnd, asOf);

    return {
      budget,
      spent: round(spent, 2),
      usedPercent: round(usedPercent, 1),
      status: budgetStatusOf(usedPercent, budget.alertThresholdPercent),
      progress,
      pace: paceOf(amount, spent, progress),
    };
  }

  /**
   * What has been spent against a budget.
   *
   * `includeSubcategories` is the whole reason the LTREE path exists: the rolled-up figure is one
   * indexed `path <@ :ancestor` probe rather than a recursive walk, and it is what an accountant
   * means by "the maintenance budget".
   */
  async spentFor(budget: Budget, manager?: EntityManager): Promise<number> {
    const category = await this.categories.requireById(budget.categoryId, manager);
    const runner = manager ?? this.dataSource;

    // A company-wide budget covers every branch plus head-office spend; a branch budget covers
    // only that branch. Neither is a filter the caller may weaken.
    const rows = await runner.query<Array<{ total: string }>>(
      `SELECT COALESCE(SUM(ft.amount), 0) AS total
         FROM finance_transactions ft
         JOIN finance_categories fc ON fc.id = ft.category_id
        WHERE (($6::boolean AND fc.path <@ $1::ltree)
               OR (NOT $6::boolean AND ft.category_id = $2::uuid))
          AND ft.is_voided = false
          AND ft.deleted_at IS NULL
          AND ft.kind = 'EXPENSE'
          AND ft.transaction_date BETWEEN $3::date AND $4::date
          AND ($5::uuid IS NULL OR ft.branch_id = $5::uuid)`,
      [
        category.path,
        category.id,
        budget.periodStart,
        budget.periodEnd,
        budget.branchId,
        budget.includeSubcategories,
      ],
    );

    return Number(rows[0]?.total ?? 0);
  }

  /**
   * Re-evaluates every budget a finance write could have moved, and records a level only when it
   * escalates (`16`).
   *
   * Runs inside the writing transaction so the recomputation sees the row that caused it. The
   * escalated budgets are returned rather than notified: delivery is the notifications module's
   * job (`18`), and the level recorded here is what stops the same warning being sent twice.
   */
  async evaluateAfterWrite(
    trigger: BudgetTrigger,
    manager: EntityManager,
  ): Promise<ComputedBudget[]> {
    const affected = await manager
      .getRepository(Budget)
      .createQueryBuilder('budget')
      .innerJoin(FinanceCategory, 'fc', 'fc.id = budget.category_id')
      .where('budget.is_active = true')
      .andWhere('budget.period_start <= :date AND budget.period_end >= :date', {
        date: trigger.transactionDate,
      })
      .andWhere(
        `((budget.include_subcategories = true AND CAST(:path AS ltree) <@ fc.path)
           OR (budget.include_subcategories = false AND budget.category_id = :categoryId))`,
        { path: trigger.categoryPath, categoryId: trigger.categoryId },
      )
      .andWhere('(budget.branch_id IS NULL OR budget.branch_id = :branchId)', {
        branchId: trigger.branchId,
      })
      .getMany();

    const escalated: ComputedBudget[] = [];

    for (const budget of affected) {
      const computed = await this.compute(budget, trigger.transactionDate, manager);
      const escalation = escalationOf(budget.lastAlertLevel, computed.status);

      if (!escalation) continue;

      await manager.getRepository(Budget).update(budget.id, {
        lastAlertLevel: escalation,
        lastAlertAt: new Date(),
      });

      escalated.push(computed);
    }

    return escalated;
  }

  /**
   * The budget block the by-category report hangs on each node: at most one per category, the one
   * whose period covers the reported window.
   */
  async coveringPeriod(
    from: string,
    to: string,
    branchId: string | null,
  ): Promise<Map<string, Budget>> {
    const qb = this.budgets
      .createQueryBuilder('budget')
      .where('budget.is_active = true')
      .andWhere('budget.period_start <= :to AND budget.period_end >= :from', { from, to });

    if (branchId) {
      qb.andWhere('(budget.branch_id IS NULL OR budget.branch_id = :branchId)', { branchId });
    }

    const budgets = await qb.orderBy('budget.period_start', 'DESC').getMany();
    const byCategory = new Map<string, Budget>();

    // A branch budget is the more specific statement, so it wins over the company-wide one for
    // the same category rather than both being reported on the same line.
    for (const budget of budgets) {
      const existing = byCategory.get(budget.categoryId);
      if (!existing || (existing.branchId === null && budget.branchId !== null)) {
        byCategory.set(budget.categoryId, budget);
      }
    }

    return byCategory;
  }

  async view(locale: Locale): Promise<BudgetView> {
    const categories = await this.categories.loadAll(locale);

    return {
      locale,
      categoriesById: new Map(categories.map((category) => [category.id, category])),
      categoriesByLabel: indexByPathLabel(categories),
    };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** A caller without `finance.read.all` sees his branch's budgets plus the company-wide ones. */
  private applyScope(qb: SelectQueryBuilder<Budget>, scope: BranchScope): void {
    if (scope.unrestricted) return;

    qb.andWhere('(budget.branch_id = :scopeBranch OR budget.branch_id IS NULL)', {
      scopeBranch: scope.branchId,
    });
  }

  private async requireVisible(id: string, scope: BranchScope): Promise<Budget> {
    const budget = await this.budgets.findOne({ where: { id }, relations: { branch: true } });

    // Outside the caller's scope reads as absent: a budget id must not be probeable.
    if (!budget) throw AppException.notFound(ErrorCode.NOT_FOUND);
    if (!scope.unrestricted && budget.branchId !== null && budget.branchId !== scope.branchId) {
      throw AppException.notFound(ErrorCode.NOT_FOUND);
    }

    return budget;
  }

  private async resolveBranch(branchId: string | null, scope: BranchScope): Promise<string | null> {
    if (branchId === null) return null;

    if (!scope.unrestricted && branchId !== scope.branchId) {
      throw new AppException(ErrorCode.BRANCH_SCOPE_VIOLATION);
    }

    const exists = await this.dataSource.getRepository(Branch).count({ where: { id: branchId } });
    if (exists === 0) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'branchId', value: branchId, constraint: 'unknown branch' }],
      });
    }

    return branchId;
  }

  /**
   * Two budgets over the same category, branch and window would each report a different
   * percentage of the same spend, and nobody could say which one the Director was reading.
   */
  private async assertNoOverlap(
    categoryId: string,
    branchId: string | null,
    periodStart: string,
    periodEnd: string,
  ): Promise<void> {
    const clashing = await this.budgets.query<Array<{ id: string }>>(
      `SELECT id FROM budgets
        WHERE deleted_at IS NULL
          AND category_id = $1::uuid
          AND branch_id IS NOT DISTINCT FROM $2::uuid
          AND daterange(period_start, period_end, '[]') && daterange($3::date, $4::date, '[]')
        LIMIT 1`,
      [categoryId, branchId, periodStart, periodEnd],
    );

    if (clashing.length > 0) {
      throw AppException.conflict(ErrorCode.OVERLAPPING_BUDGET, { id: clashing[0].id });
    }
  }
}
