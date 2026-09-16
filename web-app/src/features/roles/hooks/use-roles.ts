'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import type { ListMeta } from '@/lib/api/pagination';
import { useIdempotentMutation } from '@/lib/query/use-idempotent-mutation';

import { rolesApi } from '../api/roles.api';
import type { CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from '../model';
import { roleKeys, sessionKeys, userKeys } from './query-keys';

export function useRolesList() {
  return useQuery({
    queryKey: roleKeys.list(),
    queryFn: async () => {
      const result = await rolesApi.list();
      return result.data ?? [];
    },
  });
}

export function useRoleDetail(id: string) {
  return useQuery({
    queryKey: roleKeys.detail(id),
    queryFn: async () => {
      const result = await rolesApi.get(id);
      return result.data;
    },
    enabled: Boolean(id),
  });
}

export function usePermissionsCatalogue() {
  return useQuery({
    queryKey: roleKeys.catalogue(),
    queryFn: async () => {
      const result = await rolesApi.catalogue();
      return result.data ?? [];
    },
  });
}

export function useRoleUserCount(roleId: string, enabled = true) {
  return useQuery({
    queryKey: [...roleKeys.detail(roleId), 'user-count'] as const,
    enabled: Boolean(roleId) && enabled,
    queryFn: async () => {
      const result = await api.get<unknown[], ListMeta>(endpoints.users.list, {
        roleId,
        page: 1,
        limit: 1,
      });
      const meta = result.meta;
      if (meta && typeof meta === 'object' && 'total' in meta) {
        return Number((meta as { total: number }).total) || 0;
      }
      return result.data?.length ?? 0;
    },
  });
}

export function useCreateRoleMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: CreateRoleDto, key: string) => {
      const result = await rolesApi.create(body, key);
      return result.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: roleKeys.all });
    },
  });
}

export function useUpdateRoleMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: UpdateRoleDto, key: string) => {
      const result = await rolesApi.update(id, body, key);
      return result.data;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: roleKeys.all }),
        qc.invalidateQueries({ queryKey: roleKeys.detail(id) }),
      ]);
    },
  });
}

export function useSetRolePermissionsMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: SetRolePermissionsDto, key: string) => {
      const result = await rolesApi.setPermissions(id, body, key);
      return result.data;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: roleKeys.all }),
        qc.invalidateQueries({ queryKey: roleKeys.detail(id) }),
        qc.invalidateQueries({ queryKey: userKeys.all }),
        qc.invalidateQueries({ queryKey: sessionKeys.all }),
      ]);
    },
  });
}
