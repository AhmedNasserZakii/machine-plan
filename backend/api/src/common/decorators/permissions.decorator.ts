import { CustomDecorator, SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Requires the caller's effective permission set to contain **all** listed permissions.
 * Read by `PermissionsGuard`.
 */
export const Permissions = (...permissions: string[]): CustomDecorator<string> =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const ANY_PERMISSIONS_KEY = 'anyPermissions';

/** Requires **at least one** of the listed permissions. */
export const AnyPermission = (...permissions: string[]): CustomDecorator<string> =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
