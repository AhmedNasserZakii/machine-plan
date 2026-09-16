import type { Schema } from '@/lib/api/types';

export type Role = Schema<'RoleResponse'>;
export type CreateRoleDto = Schema<'CreateRoleDto'>;
export type UpdateRoleDto = Schema<'UpdateRoleDto'>;
export type SetRolePermissionsDto = Schema<'SetRolePermissionsDto'>;
export type PermissionGroup = Schema<'PermissionGroupResponse'>;
export type Permission = Schema<'PermissionResponse'>;
