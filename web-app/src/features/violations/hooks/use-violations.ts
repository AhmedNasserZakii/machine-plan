'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { dashboardKeys, financeKeys } from '@/features/finance/hooks/query-keys';
import { useIdempotentMutation } from '@/lib/query/use-idempotent-mutation';

import { violationsApi, type ViolationsListParams } from '../api/violations.api';
import type {
  ChargeViolationBody,
  CreateViolationBody,
  UpdateViolationBody,
  WaiveViolationBody,
} from '../model/types';
import { userKeys, violationKeys } from './query-keys';

async function invalidateViolationWrites(
  qc: ReturnType<typeof useQueryClient>,
  opts?: { id?: string; userId?: string; touchFinance?: boolean },
) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: violationKeys.all }),
    qc.invalidateQueries({ queryKey: dashboardKeys.all }),
    opts?.id
      ? qc.invalidateQueries({ queryKey: violationKeys.detail(opts.id) })
      : Promise.resolve(),
    opts?.userId
      ? qc.invalidateQueries({ queryKey: userKeys.detail(opts.userId) })
      : Promise.resolve(),
    opts?.touchFinance
      ? qc.invalidateQueries({ queryKey: financeKeys.all })
      : Promise.resolve(),
  ]);
}

export function useViolationsList(params: ViolationsListParams, enabled = true) {
  return useQuery({
    queryKey: violationKeys.list(params),
    queryFn: () => violationsApi.list(params),
    enabled,
  });
}

export function useViolationDetail(id: string) {
  return useQuery({
    queryKey: violationKeys.detail(id),
    queryFn: async () => {
      const result = await violationsApi.detail(id);
      return result.data;
    },
    enabled: Boolean(id),
  });
}

export function useViolationTypes(enabled = true) {
  return useQuery({
    queryKey: violationKeys.types(),
    queryFn: async () => {
      const result = await violationsApi.types({ isActive: true });
      return result.data ?? [];
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function usePaymentMethods(enabled = true) {
  return useQuery({
    queryKey: violationKeys.paymentMethods(),
    queryFn: async () => {
      const result = await violationsApi.paymentMethods({ isActive: true });
      return result.data ?? [];
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useUserViolations(userId: string, params: ViolationsListParams = {}) {
  return useQuery({
    queryKey: violationKeys.forUser(userId, params),
    queryFn: () => violationsApi.forUser(userId, params),
    enabled: Boolean(userId),
  });
}

export function useUserViolationSummary(userId: string) {
  return useQuery({
    queryKey: violationKeys.summaryForUser(userId),
    queryFn: async () => {
      const result = await violationsApi.summaryForUser(userId);
      return result.data;
    },
    enabled: Boolean(userId),
  });
}

export function useCreateViolationMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: CreateViolationBody, idempotencyKey: string) => {
      const result = await violationsApi.create(body, idempotencyKey);
      return result.data;
    },
    onSuccess: async (data) => {
      await invalidateViolationWrites(qc, { userId: data?.user.id });
    },
  });
}

export function useUpdateViolationMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: UpdateViolationBody, idempotencyKey: string) => {
      const result = await violationsApi.update(id, body, idempotencyKey);
      return result.data;
    },
    onSuccess: async (data) => {
      await invalidateViolationWrites(qc, { id, userId: data?.user.id });
    },
  });
}

export function useAcknowledgeViolationMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (_body: Record<string, never> | void, idempotencyKey: string) => {
      const result = await violationsApi.acknowledge(id, idempotencyKey);
      return result.data;
    },
    onSuccess: async (data) => {
      await invalidateViolationWrites(qc, { id, userId: data?.user.id });
    },
  });
}

export function useChargeViolationMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: ChargeViolationBody, idempotencyKey: string) => {
      const result = await violationsApi.charge(id, body, idempotencyKey);
      return result.data;
    },
    onSuccess: async (data) => {
      await invalidateViolationWrites(qc, {
        id,
        userId: data?.user.id,
        touchFinance: true,
      });
    },
  });
}

export function useWaiveViolationMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: WaiveViolationBody, idempotencyKey: string) => {
      const result = await violationsApi.waive(id, body, idempotencyKey);
      return result.data;
    },
    onSuccess: async (data) => {
      await invalidateViolationWrites(qc, {
        id,
        userId: data?.user.id,
        touchFinance: true,
      });
    },
  });
}
