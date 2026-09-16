'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useIdempotentMutation } from '@/lib/query/use-idempotent-mutation';

import { financeApi } from '../api/finance.api';
import type {
  BudgetsListParams,
  BudgetStatusParams,
  ByCategoryParams,
  CategoryTreeParams,
  CreateBudgetDto,
  CreateFinanceCategoryDto,
  CreateFinanceTransactionDto,
  FinancePeriodParams,
  MoveFinanceCategoryDto,
  TransactionsListParams,
  UpdateBudgetDto,
  UpdateFinanceCategoryDto,
  UpdateFinanceTransactionDto,
  VoidFinanceTransactionDto,
} from '../model';
import { dashboardKeys, financeKeys } from './query-keys';

async function invalidateFinanceWrites(qc: ReturnType<typeof useQueryClient>, detailId?: string) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: financeKeys.all }),
    qc.invalidateQueries({ queryKey: financeKeys.budgets() }),
    qc.invalidateQueries({ queryKey: dashboardKeys.all }),
    detailId ? qc.invalidateQueries({ queryKey: financeKeys.detail(detailId) }) : Promise.resolve(),
  ]);
}

async function invalidateCategoryWrites(qc: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: financeKeys.categories() }),
    qc.invalidateQueries({ queryKey: financeKeys.lists() }),
  ]);
}

async function invalidateBudgetWrites(qc: ReturnType<typeof useQueryClient>, id?: string) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: financeKeys.budgets() }),
    qc.invalidateQueries({ queryKey: dashboardKeys.all }),
    id ? qc.invalidateQueries({ queryKey: financeKeys.budget(id) }) : Promise.resolve(),
  ]);
}

export function useFinanceSummary(params: FinancePeriodParams, enabled = true) {
  return useQuery({
    queryKey: financeKeys.summary(params),
    queryFn: async () => {
      const result = await financeApi.summary(params);
      return result.data;
    },
    enabled,
  });
}

export function useFinanceByCategory(params: ByCategoryParams, enabled = true) {
  return useQuery({
    queryKey: financeKeys.byCategory(params),
    queryFn: async () => {
      const result = await financeApi.byCategory(params);
      return result.data;
    },
    enabled,
  });
}

export function useTransactionsList(params: TransactionsListParams) {
  return useQuery({
    queryKey: financeKeys.list(params),
    queryFn: () => financeApi.transactions(params),
    placeholderData: keepPreviousData,
  });
}

export function useTransactionDetail(id: string) {
  return useQuery({
    queryKey: financeKeys.detail(id),
    queryFn: async () => {
      const result = await financeApi.transaction(id);
      return result.data;
    },
    enabled: Boolean(id),
  });
}

export function useCategoriesTree(params: CategoryTreeParams = {}, enabled = true) {
  return useQuery({
    queryKey: financeKeys.categoriesTree(params),
    queryFn: async () => {
      const result = await financeApi.categoriesTree(params);
      return result.data ?? [];
    },
    enabled,
  });
}

export function useCategoryDetail(id: string | null) {
  return useQuery({
    queryKey: financeKeys.category(id ?? ''),
    queryFn: async () => {
      if (!id) return null;
      const result = await financeApi.category(id);
      return result.data;
    },
    enabled: Boolean(id),
  });
}

export function useBudgetsList(params: BudgetsListParams) {
  return useQuery({
    queryKey: financeKeys.budgetsList(params),
    queryFn: () => financeApi.budgets(params),
    placeholderData: keepPreviousData,
  });
}

export function useBudgetsStatus(params: BudgetStatusParams = {}, enabled = true) {
  return useQuery({
    queryKey: financeKeys.budgetsStatus(params),
    queryFn: async () => {
      const result = await financeApi.budgetsStatus(params);
      return result.data ?? [];
    },
    enabled,
  });
}

export function useBudgetDetail(id: string) {
  return useQuery({
    queryKey: financeKeys.budget(id),
    queryFn: async () => {
      const result = await financeApi.budget(id);
      return result.data;
    },
    enabled: Boolean(id),
  });
}

export function usePaymentMethods(enabled = true) {
  return useQuery({
    queryKey: financeKeys.paymentMethods(),
    queryFn: async () => {
      const result = await financeApi.paymentMethods();
      return (result.data ?? []).filter((row) => row.isActive);
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useSuppliers(search: string, enabled = true) {
  return useQuery({
    queryKey: financeKeys.suppliers(search),
    queryFn: async () => {
      const result = await financeApi.suppliers({
        search: search || undefined,
        limit: 30,
      });
      return result.data ?? [];
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateTransactionMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: CreateFinanceTransactionDto, idempotencyKey: string) => {
      const result = await financeApi.createTransaction(body, idempotencyKey);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateFinanceWrites(qc);
    },
  });
}

export function useUpdateTransactionMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: UpdateFinanceTransactionDto, idempotencyKey: string) => {
      const result = await financeApi.updateTransaction(id, body, idempotencyKey);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateFinanceWrites(qc, id);
    },
  });
}

export function useVoidTransactionMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: VoidFinanceTransactionDto, idempotencyKey: string) => {
      const result = await financeApi.voidTransaction(id, body, idempotencyKey);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateFinanceWrites(qc, id);
    },
  });
}

export function useCreateCategoryMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: CreateFinanceCategoryDto, idempotencyKey: string) => {
      const result = await financeApi.createCategory(body, idempotencyKey);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateCategoryWrites(qc);
    },
  });
}

export function useUpdateCategoryMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: UpdateFinanceCategoryDto, idempotencyKey: string) => {
      const result = await financeApi.updateCategory(id, body, idempotencyKey);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateCategoryWrites(qc);
    },
  });
}

export function useDeleteCategoryMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (vars: { id: string }, idempotencyKey: string) => {
      await financeApi.deleteCategory(vars.id, idempotencyKey);
      return vars.id;
    },
    onSuccess: async () => {
      await invalidateCategoryWrites(qc);
    },
  });
}

export function useMoveCategoryMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (
      vars: { id: string; body: MoveFinanceCategoryDto },
      idempotencyKey: string,
    ) => {
      const result = await financeApi.moveCategory(vars.id, vars.body, idempotencyKey);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateCategoryWrites(qc);
    },
  });
}

export function useCreateBudgetMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: CreateBudgetDto, idempotencyKey: string) => {
      const result = await financeApi.createBudget(body, idempotencyKey);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateBudgetWrites(qc);
    },
  });
}

export function useUpdateBudgetMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: UpdateBudgetDto, idempotencyKey: string) => {
      const result = await financeApi.updateBudget(id, body, idempotencyKey);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateBudgetWrites(qc, id);
    },
  });
}

export function useDeleteBudgetMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (vars: { id: string }, idempotencyKey: string) => {
      await financeApi.deleteBudget(vars.id, idempotencyKey);
      return vars.id;
    },
    onSuccess: async () => {
      await invalidateBudgetWrites(qc);
    },
  });
}

/** Synchronous CSV/XLSX download — GET, no Idempotency-Key. */
export function useExportTransactionsMutation() {
  return useMutation({
    mutationFn: (params: TransactionsListParams & { format?: 'csv' | 'xlsx' }) =>
      financeApi.exportTransactions(params),
  });
}
