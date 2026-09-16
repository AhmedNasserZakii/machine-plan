import type { Schema } from '@/lib/api/types';

export type User = Schema<'UserResponse'>;
export type UserCustody = Schema<'UserCustodyResponse'>;
export type UserCustodyMachine = Schema<'UserCustodyMachineResponse'>;
export type UserPermissions = Schema<'UserPermissionsResponse'>;
export type UserPermissionOverride = Schema<'UserPermissionOverrideResponse'>;
export type CreateUserDto = Schema<'CreateUserDto'>;
export type UpdateUserDto = Schema<'UpdateUserDto'>;
export type SetUserPermissionsDto = Schema<'SetUserPermissionsDto'>;
export type ResetPasswordDto = Schema<'ResetPasswordDto'>;
export type ResetPasswordResponse = Schema<'ResetPasswordResponse'>;
export type PermissionGroup = Schema<'PermissionGroupResponse'>;
export type Permission = Schema<'PermissionResponse'>;
export type Role = Schema<'RoleResponse'>;
export type Branch = Schema<'BranchResponse'>;

export type OverrideState = 'inherit' | 'allow' | 'deny';

export type UsersListParams = {
  page?: number;
  limit?: number;
  sortBy?: 'fullName' | 'phone' | 'createdAt' | 'lastLoginAt';
  sortDir?: 'asc' | 'desc';
  search?: string;
  roleId?: string;
  branchId?: string;
  isActive?: boolean;
};

export type CustodyParams = {
  page?: number;
  limit?: number;
  sortDir?: 'asc' | 'desc';
};
