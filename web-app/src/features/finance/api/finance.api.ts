import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import type { ListMeta } from '@/lib/api/pagination';
import type { QueryParams } from '@/lib/api/query';

import type {
  Budget,
  BudgetsListParams,
  BudgetStatus,
  BudgetStatusParams,
  ByCategoryParams,
  CategoriesListParams,
  CategoryTreeParams,
  CreateBudgetDto,
  CreateFinanceCategoryDto,
  CreateFinanceTransactionDto,
  FinanceByCategory,
  FinanceCategory,
  FinanceCategoryBreadcrumb,
  FinancePeriodParams,
  FinanceSummary,
  FinanceTransaction,
  LookupItem,
  MoveFinanceCategoryDto,
  Supplier,
  TransactionsListParams,
  UpdateBudgetDto,
  UpdateFinanceCategoryDto,
  UpdateFinanceTransactionDto,
  VoidFinanceTransactionDto,
} from '../model';

function txQuery(params: TransactionsListParams): QueryParams {
  const source = params.source;
  return {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    kind: params.kind,
    categoryId: params.categoryId,
    includeSubcategories: params.includeSubcategories,
    branchId: params.branchId,
    paymentMethodId: params.paymentMethodId,
    supplierId: params.supplierId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    minAmount: params.minAmount,
    maxAmount: params.maxAmount,
    source: Array.isArray(source) ? source : source ? [source] : undefined,
    search: params.search,
    hasInvoice: params.hasInvoice,
    includeVoided: params.includeVoided ? true : undefined,
  };
}

export const financeApi = {
  summary(params: FinancePeriodParams = {}) {
    return api.get<FinanceSummary>(endpoints.finance.summary, {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      branchId: params.branchId,
      compareToPrevious: params.compareToPrevious ?? true,
    });
  },

  byCategory(params: ByCategoryParams = {}) {
    return api.get<FinanceByCategory>(endpoints.finance.byCategory, {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      kind: params.kind,
      branchId: params.branchId,
      rootCategoryId: params.rootCategoryId,
      maxDepth: params.maxDepth,
    });
  },

  transactions(params: TransactionsListParams = {}) {
    return api.get<FinanceTransaction[], ListMeta>(endpoints.finance.transactions, txQuery(params));
  },

  transaction(id: string) {
    return api.get<FinanceTransaction>(endpoints.finance.transaction(id));
  },

  createTransaction(body: CreateFinanceTransactionDto, idempotencyKey: string) {
    return api.post<FinanceTransaction>(endpoints.finance.transactions, body, idempotencyKey);
  },

  updateTransaction(id: string, body: UpdateFinanceTransactionDto, idempotencyKey: string) {
    return api.patch<FinanceTransaction>(endpoints.finance.transaction(id), body, idempotencyKey);
  },

  voidTransaction(id: string, body: VoidFinanceTransactionDto, idempotencyKey: string) {
    return api.post<FinanceTransaction>(endpoints.finance.transactionVoid(id), body, idempotencyKey);
  },

  categories(params: CategoriesListParams = {}) {
    return api.get<FinanceCategory[], ListMeta>(endpoints.finance.categories, {
      page: params.page,
      limit: params.limit,
      sortDir: params.sortDir,
      includeInactive: params.includeInactive,
      kind: params.kind,
      parentId: params.parentId,
      search: params.search,
    });
  },

  categoriesTree(params: CategoryTreeParams = {}) {
    return api.get<FinanceCategory[]>(endpoints.finance.categoriesTree, {
      includeInactive: params.includeInactive,
      kind: params.kind,
      rootCategoryId: params.rootCategoryId,
      maxDepth: params.maxDepth,
    });
  },

  category(id: string) {
    return api.get<FinanceCategory>(endpoints.finance.category(id));
  },

  categoryBreadcrumb(id: string) {
    return api.get<FinanceCategoryBreadcrumb[]>(endpoints.finance.categoryBreadcrumb(id));
  },

  createCategory(body: CreateFinanceCategoryDto, idempotencyKey: string) {
    return api.post<FinanceCategory>(endpoints.finance.categories, body, idempotencyKey);
  },

  updateCategory(id: string, body: UpdateFinanceCategoryDto, idempotencyKey: string) {
    return api.patch<FinanceCategory>(endpoints.finance.category(id), body, idempotencyKey);
  },

  deleteCategory(id: string, idempotencyKey: string) {
    return api.delete<null>(endpoints.finance.category(id), idempotencyKey);
  },

  moveCategory(id: string, body: MoveFinanceCategoryDto, idempotencyKey: string) {
    return api.patch<FinanceCategory>(endpoints.finance.categoryMove(id), body, idempotencyKey);
  },

  budgets(params: BudgetsListParams = {}) {
    return api.get<Budget[], ListMeta>(endpoints.finance.budgets, {
      page: params.page,
      limit: params.limit,
      sortDir: params.sortDir,
      categoryId: params.categoryId,
      branchId: params.branchId,
      activeOn: params.activeOn,
      includeInactive: params.includeInactive ? true : undefined,
    });
  },

  budgetsStatus(params: BudgetStatusParams = {}) {
    return api.get<BudgetStatus[], ListMeta>(endpoints.finance.budgetsStatus, {
      page: params.page,
      limit: params.limit,
      sortDir: params.sortDir,
      asOf: params.asOf,
      branchId: params.branchId,
    });
  },

  budget(id: string) {
    return api.get<Budget>(endpoints.finance.budget(id));
  },

  createBudget(body: CreateBudgetDto, idempotencyKey: string) {
    return api.post<Budget>(endpoints.finance.budgets, body, idempotencyKey);
  },

  updateBudget(id: string, body: UpdateBudgetDto, idempotencyKey: string) {
    return api.patch<Budget>(endpoints.finance.budget(id), body, idempotencyKey);
  },

  deleteBudget(id: string, idempotencyKey: string) {
    return api.delete<null>(endpoints.finance.budget(id), idempotencyKey);
  },

  paymentMethods() {
    return api.get<LookupItem[]>(endpoints.lookups.paymentMethods);
  },

  suppliers(params?: { search?: string; page?: number; limit?: number; includeInactive?: boolean }) {
    return api.get<Supplier[], ListMeta>(endpoints.lookups.suppliers, params);
  },

  /**
   * Synchronous file download (not a report job). Streams through the BFF as a raw attachment.
   */
  async exportTransactions(
    params: TransactionsListParams & { format?: 'csv' | 'xlsx' },
  ): Promise<{ blob: Blob; filename: string }> {
    const query = { ...txQuery(params), format: params.format ?? 'csv' };
    const { buildQuery } = await import('@/lib/api/query');
    const url = `/api/bff/${endpoints.finance.export}${buildQuery(query)}`;
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) {
      const { ApiError } = await import('@/lib/api/client');
      const { ErrorCode } = await import('@/lib/api/error-codes');
      let message = 'Export failed';
      let code: string = ErrorCode.UNEXPECTED_RESPONSE;
      try {
        const body = (await response.json()) as {
          error?: { message?: string; code?: string };
        };
        message = body.error?.message ?? message;
        code = body.error?.code ?? code;
      } catch {
        /* raw body */
      }
      throw new ApiError(response.status, code, message);
    }
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    const filename = match?.[1] ?? `finance-transactions.${params.format ?? 'csv'}`;
    const blob = await response.blob();
    return { blob, filename };
  },
};
