'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { isCursorMeta } from '@/lib/api/pagination';

import { auditApi } from '../api/audit.api';
import type { AuditListParams } from '../model';
import { auditKeys } from './query-keys';

export function useAuditInfinite(params: Omit<AuditListParams, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: auditKeys.list(params),
    queryFn: async ({ pageParam }) =>
      auditApi.list({ ...params, cursor: pageParam, limit: params.limit ?? 30 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => {
      if (isCursorMeta(last.meta) && last.meta.hasNext) return last.meta.nextCursor;
      return undefined;
    },
  });
}

export function useAuditList(params: AuditListParams = {}, enabled = true) {
  return useQuery({
    queryKey: auditKeys.list(params),
    queryFn: async () => {
      const result = await auditApi.list(params);
      return result.data ?? [];
    },
    enabled,
  });
}

export function useEntityAudit(type: string, id: string, enabled = true) {
  return useQuery({
    queryKey: auditKeys.entity(type, id),
    queryFn: async () => {
      const result = await auditApi.byEntity(type, id, { limit: 20 });
      return result.data ?? [];
    },
    enabled: Boolean(type && id) && enabled,
  });
}

export function useUserAudit(userId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: auditKeys.user(userId),
    queryFn: async ({ pageParam }) =>
      auditApi.byUser(userId, { limit: 30, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => {
      if (isCursorMeta(last.meta) && last.meta.hasNext) return last.meta.nextCursor;
      return undefined;
    },
    enabled: Boolean(userId) && enabled,
  });
}
