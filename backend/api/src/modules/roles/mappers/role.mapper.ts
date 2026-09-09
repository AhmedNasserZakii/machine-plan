import { Locale } from 'src/common/constants/locales';
import {
  resolveTranslatedField,
  toTranslationsMap,
} from 'src/common/utils/resolve-translation.util';
import { PermissionGroupResponse, PermissionResponse } from '../dto/responses/permission.response';
import { RoleResponse } from '../dto/responses/role.response';
import { Permission } from '../entities/permission.entity';
import { Role } from '../entities/role.entity';
import { PERMISSION_GROUP_LABELS, PERMISSION_GROUP_ORDER } from '../permissions.catalogue';

export function toRoleResponse(role: Role, locale: Locale, includeRaw = false): RoleResponse {
  return {
    id: role.id,
    code: role.code,
    displayName: String(
      resolveTranslatedField(role.translations, locale, 'displayName', role.code),
    ),
    description: nullableString(
      resolveTranslatedField(role.translations, locale, 'description', ''),
    ),
    isSystem: role.isSystem,
    permissions: role.permissions?.map((permission) => permission.code) ?? [],
    permissionCount: role.permissions?.length ?? 0,
    ...(includeRaw
      ? {
          translations: toTranslationsMap(role.translations, (row) => ({
            displayName: row.displayName,
            description: row.description,
          })),
        }
      : {}),
  };
}

export function toPermissionResponse(permission: Permission, locale: Locale): PermissionResponse {
  return {
    id: permission.id,
    code: permission.code,
    group: permission.group,
    displayName: String(
      resolveTranslatedField(permission.translations, locale, 'displayName', permission.code),
    ),
    description: nullableString(
      resolveTranslatedField(permission.translations, locale, 'description', ''),
    ),
  };
}

/**
 * Groups permissions for the app's checkbox tree, in the catalogue's declared group order
 * so the finance block always renders in the same place.
 */
export function toPermissionGroups(
  permissions: Permission[],
  locale: Locale,
): PermissionGroupResponse[] {
  const byGroup = new Map<string, PermissionResponse[]>();

  for (const permission of permissions) {
    const bucket = byGroup.get(permission.group) ?? [];
    bucket.push(toPermissionResponse(permission, locale));
    byGroup.set(permission.group, bucket);
  }

  const known = PERMISSION_GROUP_ORDER.filter((group) => byGroup.has(group));
  const unknown = [...byGroup.keys()].filter((group) => !PERMISSION_GROUP_ORDER.includes(group));

  return [...known, ...unknown.sort()].map((group) => ({
    group,
    label: PERMISSION_GROUP_LABELS[group]?.[locale] ?? group,
    permissions: byGroup.get(group) ?? [],
  }));
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
