'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import type { ListMeta } from '@/lib/api/pagination';
import { useIdempotentMutation } from '@/lib/query/use-idempotent-mutation';

import { transfersApi, type TransfersListParams } from '../api/transfers-api';
import type {
  CancelTransferBody,
  ConfirmTransferBody,
  CreateTransferBody,
  RejectTransferBody,
  TransfersView,
} from '../model/types';
import {
  dashboardKeys,
  machineKeys,
  notificationKeys,
  transferKeys,
} from './keys';

async function invalidateTransferMutations(
  qc: ReturnType<typeof useQueryClient>,
  id?: string,
) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: transferKeys.all }),
    qc.invalidateQueries({ queryKey: transferKeys.pendings() }),
    qc.invalidateQueries({ queryKey: machineKeys.all }),
    qc.invalidateQueries({ queryKey: dashboardKeys.all }),
    qc.invalidateQueries({ queryKey: notificationKeys.all }),
    // Dashboard currently uses inline pending keys — keep those fresh too.
    qc.invalidateQueries({ queryKey: ['transfers', 'pending'] }),
    id ? qc.invalidateQueries({ queryKey: transferKeys.detail(id) }) : Promise.resolve(),
  ]);
}

export function useTransfersList(view: TransfersView, params: TransfersListParams) {
  return useQuery({
    queryKey: transferKeys.list(view, params),
    queryFn: async () => {
      const result = await transfersApi.list(view, params);
      return result;
    },
    refetchInterval: view === 'incoming' || view === 'outgoing' ? 60_000 : false,
  });
}

export function usePendingIncomingTransfers(limit = 5, enabled = true) {
  return useQuery({
    queryKey: [...transferKeys.pendingIncoming(), limit] as const,
    queryFn: async () => {
      const result = await transfersApi.pendingIncoming(limit);
      return result.data ?? [];
    },
    enabled,
    refetchInterval: enabled ? 60_000 : false,
  });
}

export function usePendingOutgoingTransfers(limit = 5, enabled = true) {
  return useQuery({
    queryKey: [...transferKeys.pendingOutgoing(), limit] as const,
    queryFn: async () => {
      const result = await transfersApi.pendingOutgoing(limit);
      return result.data ?? [];
    },
    enabled,
    refetchInterval: enabled ? 60_000 : false,
  });
}

export function useTransferDetail(id: string) {
  return useQuery({
    queryKey: transferKeys.detail(id),
    queryFn: async () => {
      const result = await transfersApi.detail(id);
      return result.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreatableTransferTypes(enabled = true) {
  return useQuery({
    queryKey: transferKeys.creatableTypes(),
    queryFn: async () => {
      const result = await transfersApi.creatableTypes();
      return result.data ?? [];
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useTransferRecipients(type: string | undefined, search: string) {
  return useQuery({
    queryKey: transferKeys.recipients(type ?? '', search),
    queryFn: async () => {
      if (!type) return [];
      const result = await transfersApi.recipients({
        type,
        search: search || undefined,
        limit: 30,
      });
      return result.data ?? [];
    },
    enabled: Boolean(type),
    staleTime: 30_000,
  });
}

export function usePickableMerchants(search: string, enabled: boolean) {
  return useQuery({
    queryKey: ['merchants', 'pickable', search] as const,
    queryFn: async () => {
      const result = await api.get<
        Array<{ id: string; name?: string; shopName?: string; phone?: string }>,
        ListMeta
      >(endpoints.merchants.pickable, {
        search: search || undefined,
        limit: 30,
      });
      return (result.data ?? []).map((m) => ({
        id: m.id,
        name: m.shopName || m.name || m.id,
        subtitle: m.phone ?? null,
      }));
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useSignatureMedia(transferId: string, signatureId: string, enabled: boolean) {
  return useQuery({
    queryKey: transferKeys.signatureMedia(transferId, signatureId),
    queryFn: async () => {
      const result = await transfersApi.signatureMedia(transferId, signatureId);
      return result.data;
    },
    enabled: enabled && Boolean(transferId) && Boolean(signatureId),
    staleTime: 60_000,
  });
}

export function useCreateTransferMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: CreateTransferBody, idempotencyKey: string) => {
      const result = await transfersApi.create(body, idempotencyKey);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateTransferMutations(qc);
    },
  });
}

export function useConfirmTransferMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: ConfirmTransferBody, idempotencyKey: string) => {
      const result = await transfersApi.confirm(id, body, idempotencyKey);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateTransferMutations(qc, id);
    },
  });
}

export function useRejectTransferMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: RejectTransferBody, idempotencyKey: string) => {
      const result = await transfersApi.reject(id, body, idempotencyKey);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateTransferMutations(qc, id);
    },
  });
}

export function useCancelTransferMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: CancelTransferBody | undefined, idempotencyKey: string) => {
      const result = await transfersApi.cancel(id, body, idempotencyKey);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateTransferMutations(qc, id);
    },
  });
}

/** Dry-run validate — no Idempotency-Key; safe to call freely while drafting. */
export function useValidateTransfer() {
  return useMutation({
    mutationFn: async (body: CreateTransferBody) => {
      const result = await transfersApi.validate(body);
      return result.data;
    },
  });
}
