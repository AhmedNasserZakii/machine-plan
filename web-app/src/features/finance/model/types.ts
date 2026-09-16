import type { Schema } from '@/lib/api/types';

export type FinanceTransaction = Schema<'FinanceTransactionResponse'>;
export type FinanceSummary = Schema<'FinanceSummaryResponse'>;
export type FinanceByCategory = Schema<'FinanceByCategoryResponse'>;
export type FinanceByCategoryNode = Schema<'FinanceByCategoryNodeResponse'>;
export type FinanceCategory = Schema<'FinanceCategoryResponse'>;
export type FinanceCategoryBreadcrumb = Schema<'FinanceCategoryBreadcrumbResponse'>;
export type CreateFinanceTransactionDto = Schema<'CreateFinanceTransactionDto'>;
export type UpdateFinanceTransactionDto = Schema<'UpdateFinanceTransactionDto'>;
export type VoidFinanceTransactionDto = Schema<'VoidFinanceTransactionDto'>;
export type CreateFinanceCategoryDto = Schema<'CreateFinanceCategoryDto'>;
export type UpdateFinanceCategoryDto = Schema<'UpdateFinanceCategoryDto'>;
export type MoveFinanceCategoryDto = Schema<'MoveFinanceCategoryDto'>;
export type Budget = Schema<'BudgetResponse'>;
export type BudgetStatus = Schema<'BudgetStatusResponse'>;
export type CreateBudgetDto = Schema<'CreateBudgetDto'>;
export type UpdateBudgetDto = Schema<'UpdateBudgetDto'>;
export type LookupItem = Schema<'LookupResponse'>;
export type Supplier = Schema<'SupplierResponse'>;

export type FinanceKind = FinanceTransaction['kind'];
export type TransactionSource = FinanceTransaction['source'];
export type BudgetPeriodType = Budget['periodType'];
export type BudgetStatusTone = BudgetStatus['status'];

export type TransactionsListParams = {
  page?: number;
  limit?: number;
  sortBy?: 'transactionDate' | 'amount' | 'createdAt';
  sortDir?: 'asc' | 'desc';
  kind?: FinanceKind;
  categoryId?: string;
  includeSubcategories?: boolean;
  branchId?: string;
  paymentMethodId?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  source?: TransactionSource | TransactionSource[];
  search?: string;
  hasInvoice?: boolean;
  includeVoided?: boolean;
};

export type FinancePeriodParams = {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  compareToPrevious?: boolean;
};

export type ByCategoryParams = {
  dateFrom?: string;
  dateTo?: string;
  kind?: FinanceKind;
  branchId?: string;
  rootCategoryId?: string;
  maxDepth?: number;
};

export type BudgetsListParams = {
  page?: number;
  limit?: number;
  sortDir?: 'asc' | 'desc';
  categoryId?: string;
  branchId?: string;
  activeOn?: string;
  includeInactive?: boolean;
};

export type BudgetStatusParams = {
  page?: number;
  limit?: number;
  sortDir?: 'asc' | 'desc';
  asOf?: string;
  branchId?: string;
};

export type CategoryTreeParams = {
  includeInactive?: boolean;
  kind?: FinanceKind;
  rootCategoryId?: string;
  maxDepth?: number;
};

export type CategoriesListParams = {
  page?: number;
  limit?: number;
  sortDir?: 'asc' | 'desc';
  includeInactive?: boolean;
  kind?: FinanceKind;
  parentId?: string;
  search?: string;
};

/** Matches backend FINANCE_BACKDATE_LIMIT_DAYS default when settings are unavailable. */
export const FINANCE_BACKDATE_LIMIT_DAYS = 90;

export const TRANSACTION_SOURCES = [
  'MANUAL',
  'AUTO_MAINTENANCE',
  'AUTO_VIOLATION',
  'AUTO_SUBSCRIPTION',
] as const satisfies readonly TransactionSource[];

export const TRANSACTION_SORTABLE = ['transactionDate', 'amount', 'createdAt'] as const;

export const BUDGET_PERIOD_TYPES = [
  'MONTHLY',
  'QUARTERLY',
  'YEARLY',
  'CUSTOM',
] as const satisfies readonly BudgetPeriodType[];
