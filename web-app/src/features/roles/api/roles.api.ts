import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

import type {
  CreateRoleDto,
  PermissionGroup,
  Role,
  SetRolePermissionsDto,
  UpdateRoleDto,
} from '../model';

export const rolesApi = {
  list() {
    return api.get<Role[]>(endpoints.roles.list);
  },
  get(id: string) {
    return api.get<Role>(endpoints.roles.byId(id));
  },
  create(body: CreateRoleDto, idempotencyKey: string) {
    return api.post<Role>(endpoints.roles.list, body, idempotencyKey);
  },
  update(id: string, body: UpdateRoleDto, idempotencyKey: string) {
    return api.patch<Role>(endpoints.roles.byId(id), body, idempotencyKey);
  },
  setPermissions(id: string, body: SetRolePermissionsDto, idempotencyKey: string) {
    return api.put<Role>(endpoints.roles.permissions(id), body, idempotencyKey);
  },
  catalogue() {
    return api.get<PermissionGroup[]>(endpoints.permissions.list);
  },
};
