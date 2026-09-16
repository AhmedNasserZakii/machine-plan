'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useIdempotentMutation } from '@/lib/query/use-idempotent-mutation';

import { merchantsApi } from '../api/merchants.api';
import type {
  CheckMerchantDto,
  CollectSubscriptionDto,
  CreateMerchantDto,
  CreateSubscriptionDto,
  MerchantsListParams,
  UpdateMerchantDto,
  UpdateSubscriptionDto,
} from '../model';
import { dashboardKeys, financeKeys, merchantKeys, transferKeys } from './keys';

async function invalidateMerchantSurface(
  qc: ReturnType<typeof useQueryClient>,
  id?: string,
) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: merchantKeys.all }),
    qc.invalidateQueries({ queryKey: dashboardKeys.all }),
    id ? qc.invalidateQueries({ queryKey: merchantKeys.detail(id) }) : Promise.resolve(),
  ]);
}

export function useMerchantsList(params: MerchantsListParams) {
  return useQuery({
    queryKey: merchantKeys.list(params),
    queryFn: async () => merchantsApi.list(params),
  });
}

export function useMerchantDetail(id: string) {
  return useQuery({
    queryKey: merchantKeys.detail(id),
    queryFn: async () => {
      const result = await merchantsApi.get(id);
      return result.data;
    },
    enabled: Boolean(id),
  });
}

export function useMerchantMachines(id: string, params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: merchantKeys.machines(id, params),
    queryFn: async () => {
      const result = await merchantsApi.machines(id, params);
      return result;
    },
    enabled: Boolean(id),
  });
}

export function useMerchantSubscriptions(id: string) {
  return useQuery({
    queryKey: merchantKeys.subscriptions(id),
    queryFn: async () => {
      const result = await merchantsApi.subscriptions(id);
      return result.data ?? [];
    },
    enabled: Boolean(id),
  });
}

export function useMerchantTimeline(id: string) {
  return useInfiniteQuery({
    queryKey: merchantKeys.timeline(id),
    queryFn: async ({ pageParam }) => {
      const result = await merchantsApi.timeline(id, {
        limit: 30,
        cursor: pageParam,
      });
      return result;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => {
      const cursor =
        last.meta && typeof last.meta === 'object' && 'nextCursor' in last.meta
          ? (last.meta as { nextCursor?: string | null }).nextCursor
          : null;
      return cursor ?? undefined;
    },
    enabled: Boolean(id),
  });
}

/** Idempotency-exempt duplicate pre-check. */
export function useMerchantCheck() {
  return useMutation({
    mutationFn: async (body: CheckMerchantDto) => {
      const result = await merchantsApi.check(body);
      return result.data;
    },
  });
}

export function useCreateMerchantMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: CreateMerchantDto, key: string) => {
      const result = await merchantsApi.create(body, key);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateMerchantSurface(qc);
    },
  });
}

export function useUpdateMerchantMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: UpdateMerchantDto, key: string) => {
      const result = await merchantsApi.update(id, body, key);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateMerchantSurface(qc, id);
    },
  });
}

export function useDeactivateMerchantMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (_: void, key: string) => {
      const result = await merchantsApi.deactivate(id, key);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateMerchantSurface(qc, id);
      await qc.invalidateQueries({ queryKey: transferKeys.all });
    },
  });
}

export function useCreateSubscriptionMutation(merchantId: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: CreateSubscriptionDto, key: string) => {
      const result = await merchantsApi.createSubscription(merchantId, body, key);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateMerchantSurface(qc, merchantId);
    },
  });
}

export function useUpdateSubscriptionMutation(merchantId: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (
      vars: { id: string; body: UpdateSubscriptionDto },
      key: string,
    ) => {
      const result = await merchantsApi.updateSubscription(vars.id, vars.body, key);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateMerchantSurface(qc, merchantId);
    },
  });
}

export function useCollectSubscriptionMutation(merchantId: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (
      vars: { id: string; body: CollectSubscriptionDto },
      key: string,
    ) => {
      const result = await merchantsApi.collectSubscription(vars.id, vars.body, key);
      return result.data;
    },
    onSuccess: async () => {
      await Promise.all([
        invalidateMerchantSurface(qc, merchantId),
        qc.invalidateQueries({ queryKey: financeKeys.all }),
      ]);
    },
  });
}
