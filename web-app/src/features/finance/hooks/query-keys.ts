import type {
  BudgetsListParams,
  BudgetStatusParams,
  ByCategoryParams,
  CategoriesListParams,
  CategoryTreeParams,
  FinancePeriodParams,
  TransactionsListParams,
} from '../model';

export const financeKeys = {
  all: ['finance'] as const,
  summaries: () => [...financeKeys.all, 'summary'] as const,
  summary: (params: FinancePeriodParams) => [...financeKeys.summaries(), params] as const,
  byCategories: () => [...financeKeys.all, 'by-category'] as const,
  byCategory: (params: ByCategoryParams) => [...financeKeys.byCategories(), params] as const,
  lists: () => [...financeKeys.all, 'list'] as const,
  list: (params: TransactionsListParams) => [...financeKeys.lists(), params] as const,
  details: () => [...financeKeys.all, 'detail'] as const,
  detail: (id: string) => [...financeKeys.details(), id] as const,
  categories: () => [...financeKeys.all, 'categories'] as const,
  categoriesList: (params: CategoriesListParams) =>
    [...financeKeys.categories(), 'list', params] as const,
  categoriesTree: (params: CategoryTreeParams) =>
    [...financeKeys.categories(), 'tree', params] as const,
  category: (id: string) => [...financeKeys.categories(), 'detail', id] as const,
  categoryBreadcrumb: (id: string) => [...financeKeys.categories(), 'breadcrumb', id] as const,
  budgets: () => ['budgets'] as const,
  budgetsList: (params: BudgetsListParams) => [...financeKeys.budgets(), 'list', params] as const,
  budgetsStatus: (params: BudgetStatusParams = {}) =>
    [...financeKeys.budgets(), 'status', params] as const,
  budget: (id: string) => [...financeKeys.budgets(), 'detail', id] as const,
  paymentMethods: () => [...financeKeys.all, 'payment-methods'] as const,
  suppliers: (search: string) => [...financeKeys.all, 'suppliers', search] as const,
};

export const dashboardKeys = {
  all: ['dashboard'] as const,
};
