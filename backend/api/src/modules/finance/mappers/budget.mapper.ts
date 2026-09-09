import {
  BudgetCategoryRefResponse,
  BudgetResponse,
  BudgetStatusListResponse,
  BudgetStatusResponse,
} from '../dto/responses/budget.response';
import { Budget } from '../entities/budget.entity';
import { BudgetStatus, round } from '../budget-rules';
import { categoryName, localizedCategoryPath } from '../category-tree';
import { BudgetView, ComputedBudget } from '../services/budgets.service';

export function toBudgetResponse(budget: Budget, view: BudgetView): BudgetResponse {
  return {
    id: budget.id,
    category: categoryRef(budget, view),
    branch: budget.branch ? { id: budget.branch.id, name: budget.branch.name } : null,
    periodType: budget.periodType,
    periodStart: budget.periodStart,
    periodEnd: budget.periodEnd,
    amount: Number(budget.amount),
    alertThresholdPercent: budget.alertThresholdPercent,
    includeSubcategories: budget.includeSubcategories,
    autoRenew: budget.autoRenew,
    isActive: budget.isActive,
    lastAlertLevel: budget.lastAlertLevel,
    lastAlertAt: budget.lastAlertAt?.toISOString() ?? null,
    createdAt: budget.createdAt.toISOString(),
  };
}

export function toBudgetStatusResponse(
  computed: ComputedBudget,
  view: BudgetView,
): BudgetStatusResponse {
  const { budget } = computed;
  const amount = Number(budget.amount);

  return {
    id: budget.id,
    category: categoryRef(budget, view),
    branch: budget.branch ? { id: budget.branch.id, name: budget.branch.name } : null,
    period: {
      type: budget.periodType,
      start: budget.periodStart,
      end: budget.periodEnd,
      daysElapsed: computed.progress.daysElapsed,
      daysTotal: computed.progress.daysTotal,
      elapsedPercent: computed.progress.elapsedPercent,
    },
    amount,
    spent: computed.spent,
    // Negative once a budget is over, which is the number people actually read off this line.
    remaining: round(amount - computed.spent, 2),
    usedPercent: computed.usedPercent,
    status: computed.status,
    pace: computed.pace,
    lastAlertLevel: budget.lastAlertLevel,
  };
}

export function toBudgetStatusListResponse(
  asOf: string,
  computed: ComputedBudget[],
  view: BudgetView,
): BudgetStatusListResponse {
  return {
    asOf,
    budgets: computed.map((entry) => toBudgetStatusResponse(entry, view)),
    summary: {
      total: computed.length,
      ok: computed.filter((entry) => entry.status === BudgetStatus.OK).length,
      warning: computed.filter((entry) => entry.status === BudgetStatus.WARNING).length,
      exceeded: computed.filter((entry) => entry.status === BudgetStatus.EXCEEDED).length,
    },
  };
}

function categoryRef(budget: Budget, view: BudgetView): BudgetCategoryRefResponse {
  const category = view.categoriesById.get(budget.categoryId);

  if (!category) return { id: budget.categoryId, name: '', path: '' };

  return {
    id: category.id,
    name: categoryName(category, view.locale),
    path: localizedCategoryPath(category, view.categoriesByLabel, view.locale),
  };
}
