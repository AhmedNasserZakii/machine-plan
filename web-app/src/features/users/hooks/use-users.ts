'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';

import { useIdempotentMutation } from '@/lib/query/use-idempotent-mutation';

import { usersApi } from '../api/users.api';
import type {
  CreateUserDto,
  CustodyParams,
  ResetPasswordDto,
  SetUserPermissionsDto,
  UpdateUserDto,
  UsersListParams,
} from '../model';
import { roleKeys, sessionKeys, userKeys } from './query-keys';

async function invalidateUserSurface(
  qc: ReturnType<typeof useQueryClient>,
  id?: string,
  touchSession = false,
) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: userKeys.all }),
    qc.invalidateQueries({ queryKey: roleKeys.all }),
    id ? qc.invalidateQueries({ queryKey: userKeys.detail(id) }) : Promise.resolve(),
    touchSession ? qc.invalidateQueries({ queryKey: sessionKeys.all }) : Promise.resolve(),
  ]);
}

export function useUsersList(params: UsersListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => usersApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useUserDetail(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: async () => {
      const result = await usersApi.get(id);
      return result.data;
    },
    enabled: Boolean(id),
  });
}

export function useUserPermissions(id: string, enabled = true) {
  return useQuery({
    queryKey: userKeys.permissions(id),
    queryFn: async () => {
      const result = await usersApi.permissions(id);
      return result.data;
    },
    enabled: Boolean(id) && enabled,
  });
}

export function useUserCustody(id: string, params: CustodyParams = {}, enabled = true) {
  return useQuery({
    queryKey: userKeys.custody(id, params),
    queryFn: async () => {
      const result = await usersApi.custody(id, params);
      return result.data;
    },
    enabled: Boolean(id) && enabled,
  });
}

export function usePermissionsCatalogue() {
  return useQuery({
    queryKey: userKeys.catalogue(),
    queryFn: async () => {
      const result = await usersApi.permissionsCatalogue();
      return result.data ?? [];
    },
  });
}

export function useRolesOptions() {
  return useQuery({
    queryKey: userKeys.roles(),
    queryFn: async () => {
      const result = await usersApi.roles();
      return result.data ?? [];
    },
  });
}

export function useBranchesOptions() {
  return useQuery({
    queryKey: userKeys.branches(),
    queryFn: async () => {
      const result = await usersApi.branches();
      return (result.data ?? []).filter((b) => b.isActive);
    },
  });
}

export function useCreateUserMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: CreateUserDto, key: string) => {
      const result = await usersApi.create(body, key);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateUserSurface(qc);
    },
  });
}

export function useUpdateUserMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: UpdateUserDto, key: string) => {
      const result = await usersApi.update(id, body, key);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateUserSurface(qc, id);
    },
  });
}

export function useActivateUserMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (_: void, key: string) => {
      const result = await usersApi.activate(id, key);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateUserSurface(qc, id);
    },
  });
}

export function useDeactivateUserMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (_: void, key: string) => {
      const result = await usersApi.deactivate(id, key);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateUserSurface(qc, id);
    },
  });
}

export function useResetPasswordMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: ResetPasswordDto, key: string) => {
      const result = await usersApi.resetPassword(id, body, key);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateUserSurface(qc, id);
    },
  });
}

export function useSetUserPermissionsMutation(id: string, isSelf: boolean) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: SetUserPermissionsDto, key: string) => {
      const result = await usersApi.setPermissions(id, body, key);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateUserSurface(qc, id, isSelf);
    },
  });
}
