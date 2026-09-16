import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import type { ListMeta } from '@/lib/api/pagination';
import type { QueryParams } from '@/lib/api/query';

import type {
  Branch,
  CreateUserDto,
  CustodyParams,
  PermissionGroup,
  ResetPasswordDto,
  ResetPasswordResponse,
  Role,
  SetUserPermissionsDto,
  UpdateUserDto,
  User,
  UserCustody,
  UserPermissions,
  UsersListParams,
} from '../model';

function listQuery(params: UsersListParams): QueryParams {
  return {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    search: params.search,
    roleId: params.roleId,
    branchId: params.branchId,
    isActive:
      params.isActive === undefined ? undefined : params.isActive ? 'true' : 'false',
  };
}

export const usersApi = {
  list(params: UsersListParams = {}) {
    return api.get<User[], ListMeta>(endpoints.users.list, listQuery(params));
  },

  get(id: string) {
    return api.get<User>(endpoints.users.byId(id));
  },

  create(body: CreateUserDto, idempotencyKey: string) {
    return api.post<User>(endpoints.users.list, body, idempotencyKey);
  },

  update(id: string, body: UpdateUserDto, idempotencyKey: string) {
    return api.patch<User>(endpoints.users.byId(id), body, idempotencyKey);
  },

  activate(id: string, idempotencyKey: string) {
    return api.patch<User>(endpoints.users.activate(id), {}, idempotencyKey);
  },

  deactivate(id: string, idempotencyKey: string) {
    return api.patch<User>(endpoints.users.deactivate(id), {}, idempotencyKey);
  },

  resetPassword(id: string, body: ResetPasswordDto, idempotencyKey: string) {
    return api.post<ResetPasswordResponse>(
      endpoints.users.resetPassword(id),
      body,
      idempotencyKey,
    );
  },

  permissions(id: string) {
    return api.get<UserPermissions>(endpoints.users.permissions(id));
  },

  setPermissions(id: string, body: SetUserPermissionsDto, idempotencyKey: string) {
    return api.put<UserPermissions>(endpoints.users.permissions(id), body, idempotencyKey);
  },

  custody(id: string, params: CustodyParams = {}) {
    return api.get<UserCustody>(endpoints.users.custody(id), {
      page: params.page,
      limit: params.limit,
      sortDir: params.sortDir,
    });
  },

  roles() {
    return api.get<Role[]>(endpoints.roles.list);
  },

  permissionsCatalogue() {
    return api.get<PermissionGroup[]>(endpoints.permissions.list);
  },

  branches() {
    return api.get<Branch[]>(endpoints.branches.list);
  },
};
