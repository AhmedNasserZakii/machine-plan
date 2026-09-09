import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheKeys, CacheService } from 'src/common/cache';
import { PermissionEffect } from 'src/common/enums';
import { RedisConfig } from 'src/config';
import { UserPermissionOverride } from 'src/modules/users/entities/user-permission-override.entity';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';

interface PermissionCodeRow {
  code: string;
}

/**
 * Resolves and caches the effective permission set for a user:
 *
 * ```
 * effective = (role_permissions ∪ overrides[ALLOW]) \ overrides[DENY]
 * ```
 *
 * DENY always wins, so the Director can revoke a single capability from one user without
 * inventing a new role.
 */
@Injectable()
export class PermissionsService {
  private readonly cacheTtlSeconds: number;

  constructor(
    @InjectRepository(Permission)
    private readonly permissionsRepository: Repository<Permission>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(UserPermissionOverride)
    private readonly overridesRepository: Repository<UserPermissionOverride>,
    private readonly cache: CacheService,
    config: ConfigService,
  ) {
    this.cacheTtlSeconds = config.getOrThrow<RedisConfig>('redis').permissionCacheTtlSeconds;
  }

  /** Cached effective permission codes for a user. */
  async getEffectivePermissions(userId: string): Promise<string[]> {
    return this.cache.remember(CacheKeys.userPermissions(userId), this.cacheTtlSeconds, () =>
      this.computeEffectivePermissions(userId),
    );
  }

  /**
   * Resolves the set in a single statement, so it cannot observe a half-applied
   * permission change the way two sequential reads could.
   */
  private async computeEffectivePermissions(userId: string): Promise<string[]> {
    const rows = await this.permissionsRepository.query<PermissionCodeRow[]>(
      `
      WITH role_grants AS (
        SELECT p.code
          FROM users u
          JOIN role_permissions rp ON rp.role_id = u.role_id
          JOIN permissions p ON p.id = rp.permission_id AND p.deleted_at IS NULL
         WHERE u.id = $1 AND u.deleted_at IS NULL
      ),
      overrides AS (
        SELECT p.code, o.effect
          FROM user_permission_overrides o
          JOIN permissions p ON p.id = o.permission_id AND p.deleted_at IS NULL
         WHERE o.user_id = $1 AND o.deleted_at IS NULL
      )
      SELECT code
        FROM (
          SELECT code FROM role_grants
          UNION
          SELECT code FROM overrides WHERE effect = $2
        ) granted
       WHERE code NOT IN (SELECT code FROM overrides WHERE effect = $3)
       ORDER BY code
      `,
      [userId, PermissionEffect.ALLOW, PermissionEffect.DENY],
    );

    return rows.map((row) => row.code);
  }

  async invalidateUser(userId: string): Promise<void> {
    await this.cache.del(CacheKeys.userPermissions(userId));
  }

  /**
   * Invalidates every user's cached set. Used when a role's permissions change, since
   * resolving which users are affected would cost more than a full flush of a small keyspace.
   */
  async invalidateAll(): Promise<void> {
    await this.cache.delByPattern(CacheKeys.userPermissionsPattern());
  }

  async listAll(): Promise<Permission[]> {
    return this.permissionsRepository.find({
      relations: { translations: true },
      order: { sortOrder: 'ASC' },
    });
  }

  /** Resolves permission codes to ids, ignoring codes that do not exist. */
  async resolveIds(codes: readonly string[]): Promise<string[]> {
    if (codes.length === 0) return [];
    const rows = await this.permissionsRepository.find({
      where: codes.map((code) => ({ code })),
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async findRoleByCode(code: string): Promise<Role | null> {
    return this.rolesRepository.findOne({
      where: { code },
      relations: { translations: true, permissions: true },
    });
  }

  async findOverrides(userId: string): Promise<UserPermissionOverride[]> {
    return this.overridesRepository.find({
      where: { userId },
      relations: { permission: true },
    });
  }
}
