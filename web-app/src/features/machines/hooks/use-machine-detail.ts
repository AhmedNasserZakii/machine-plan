'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { isCursorMeta } from '@/lib/api/pagination';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';

import { machinesApi } from '../api/machines.api';
import { machineKeys } from './query-keys';

export function useMachineDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: id ? machineKeys.detail(id) : machineKeys.details(),
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) throw new Error('missing id');
      const result = await machinesApi.get(id);
      return result.data;
    },
  });
}

export function useMachineTimelineQuery(id: string | undefined) {
  return useInfiniteQuery({
    queryKey: id ? machineKeys.timeline(id) : [...machineKeys.all, 'timeline', 'idle'],
    enabled: Boolean(id),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      if (!id) throw new Error('missing id');
      return machinesApi.timeline(id, { limit: 30, cursor: pageParam });
    },
    getNextPageParam: (last) => {
      if (isCursorMeta(last.meta) && last.meta.hasNext) return last.meta.nextCursor;
      return undefined;
    },
  });
}

export function useMachineCostsQuery(id: string | undefined) {
  const { permissions } = useSession();
  const allowed = can(permissions, P.financeRead);

  return useQuery({
    queryKey: id ? machineKeys.costs(id) : [...machineKeys.all, 'costs', 'idle'],
    enabled: Boolean(id) && allowed,
    queryFn: async () => {
      if (!id) throw new Error('missing id');
      const result = await machinesApi.costSummary(id);
      return result.data;
    },
  });
}

export function useMachineMaintenanceHistoryQuery(
  id: string | undefined,
  params: { page?: number; limit?: number } = { page: 1, limit: 20 },
) {
  return useQuery({
    queryKey: id ? machineKeys.maintenance(id, params) : [...machineKeys.all, 'maintenance', 'idle'],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) throw new Error('missing id');
      const result = await machinesApi.maintenanceHistory(id, params);
      return result.data;
    },
  });
}

export function useMachineChainQuery(id: string | undefined) {
  return useQuery({
    queryKey: id ? machineKeys.chain(id) : [...machineKeys.all, 'chain', 'idle'],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) throw new Error('missing id');
      const result = await machinesApi.replacementChain(id);
      return result.data;
    },
  });
}
