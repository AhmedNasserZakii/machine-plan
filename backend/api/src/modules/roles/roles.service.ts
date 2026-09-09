import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AuditService } from 'src/common/audit';
import { ErrorCode } from 'src/common/constants/error-codes';
import { DEFAULT_LOCALE, Locale, SUPPORTED_LOCALES } from 'src/common/constants/locales';
import { AuditAction, AuditEntityType } from 'src/common/enums';
import { AppException } from 'src/common/errors';
import { AuthUser } from 'src/common/types/request.types';
import { CreateRoleDto, RoleTranslationDto, UpdateRoleDto } from './dto/create-role.dto';
import { Permission } from './entities/permission.entity';
import { Role, SystemRole } from './entities/role.entity';
import { RoleTranslation } from './entities/role-translation.entity';
import { PermissionsService } from './permissions.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(Permission) private readonly permissions: Repository<Permission>,
    @InjectRepository(RoleTranslation)
    private readonly translations: Repository<RoleTranslation>,
    private readonly permissionsService: PermissionsService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async findAll(): Promise<Role[]> {
    return this.roles.find({
      relations: { translations: true, permissions: true },
      order: { code: 'ASC' },
    });
  }

  async findById(id: string): Promise<Role> {
    const role = await this.roles.findOne({
      where: { id },
      relations: { translations: true, permissions: true },
    });

    if (!role) throw AppException.notFound();
    return role;
  }

  async create(dto: CreateRoleDto, actorId: string): Promise<Role> {
    const existing = await this.roles.findOne({ where: { code: dto.code }, withDeleted: true });
    if (existing) {
      throw AppException.conflict(ErrorCode.CODE_EXISTS, { code: dto.code });
    }

    const permissions = await this.resolvePermissions(dto.permissions ?? []);

    const role = await this.dataSource.transaction(async (manager) => {
      const created = await manager.getRepository(Role).save(
        manager.getRepository(Role).create({
          code: dto.code,
          isSystem: false,
          permissions,
          createdBy: actorId,
        }),
      );

      await manager
        .getRepository(RoleTranslation)
        .save(buildTranslations(created.id, dto.translations));

      return manager.getRepository(Role).findOneOrFail({
        where: { id: created.id },
        relations: { translations: true, permissions: true },
      });
    });

    await this.audit.record({
      userId: actorId,
      action: AuditAction.ROLE_CREATED,
      entityType: AuditEntityType.ROLE,
      entityId: role.id,
      after: {
        code: role.code,
        permissions: permissions.map((permission) => permission.code).sort(),
      },
    });

    return role;
  }

  async update(id: string, dto: UpdateRoleDto, actorId: string): Promise<Role> {
    const role = await this.findById(id);

    if (dto.translations) {
      await this.upsertTranslations(role.id, dto.translations);
    }

    await this.roles.update(role.id, { updatedBy: actorId });

    await this.audit.record({
      userId: actorId,
      action: AuditAction.ROLE_UPDATED,
      entityType: AuditEntityType.ROLE,
      entityId: role.id,
      before: dto.translations ? { translations: role.translations } : null,
      after: dto.translations ? { translations: dto.translations } : null,
    });

    return this.findById(role.id);
  }

  /**
   * Replaces a role's permission set wholesale and flushes the permission cache for every
   * user, since any of them could hold this role.
   */
  async setPermissions(id: string, codes: string[], actor: AuthUser): Promise<Role> {
    const role = await this.findById(id);

    // The DIRECTOR role is the system's root: stripping it (there is no higher role to
    // restore it from) or extending it must not be possible through the API at all.
    if (role.code === SystemRole.DIRECTOR) {
      throw AppException.unprocessable(ErrorCode.SYSTEM_ROLE_PROTECTED);
    }

    // Editing the permissions of your own role is self-escalation by another name —
    // the same rule that already protects the per-user override path.
    if (role.id === actor.roleId) {
      throw new AppException(ErrorCode.CANNOT_EDIT_OWN_PERMISSIONS);
    }

    // Codes are resolved before the escalation check so that a typo is reported as a typo.
    // "you cannot grant nope.nope" is a misleading answer to a code that is not a privilege at
    // all, and it leaks the shape of the catalogue to a caller probing for valid names.
    const permissions = await this.resolvePermissions(codes);

    // A role may only be granted capabilities the actor holds themselves.
    const missing = codes.filter((code) => !actor.permissions.includes(code));
    if (missing.length > 0) {
      throw new AppException(ErrorCode.INSUFFICIENT_PERMISSIONS, {
        details: missing.map((code) => ({
          field: 'permissions',
          value: code,
          constraint: 'cannot grant a privilege you do not hold',
        })),
      });
    }

    const before = (role.permissions ?? []).map((permission) => permission.code).sort();

    role.permissions = permissions;
    role.updatedBy = actor.id;
    await this.roles.save(role);

    await this.permissionsService.invalidateAll();

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.ROLE_PERMISSIONS_UPDATED,
      entityType: AuditEntityType.ROLE,
      entityId: role.id,
      before: { permissions: before },
      after: { permissions: [...codes].sort() },
    });

    return this.findById(role.id);
  }

  async listPermissions(): Promise<Permission[]> {
    return this.permissionsService.listAll();
  }

  /** Rejects unknown permission codes loudly rather than silently dropping them. */
  private async resolvePermissions(codes: readonly string[]): Promise<Permission[]> {
    if (codes.length === 0) return [];

    const unique = [...new Set(codes)];
    const found = await this.permissions.find({ where: { code: In(unique) } });

    if (found.length !== unique.length) {
      const known = new Set(found.map((permission) => permission.code));
      const unknown = unique.filter((code) => !known.has(code));
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: unknown.map((code) => ({
          field: 'permissions',
          value: code,
          constraint: 'unknown permission code',
        })),
      });
    }

    return found;
  }

  private async upsertTranslations(
    roleId: string,
    translations: Partial<Record<Locale, RoleTranslationDto>>,
  ): Promise<void> {
    for (const locale of SUPPORTED_LOCALES) {
      const payload = translations[locale];
      if (!payload) continue;

      const existing = await this.translations.findOne({ where: { roleId, locale } });
      if (existing) {
        await this.translations.update(existing.id, {
          displayName: payload.displayName,
          description: payload.description ?? null,
        });
      } else {
        await this.translations.save(
          this.translations.create({
            roleId,
            locale,
            displayName: payload.displayName,
            description: payload.description ?? null,
          }),
        );
      }
    }
  }
}

function buildTranslations(
  roleId: string,
  translations: Partial<Record<Locale, RoleTranslationDto>>,
): RoleTranslation[] {
  const rows: RoleTranslation[] = [];

  for (const locale of SUPPORTED_LOCALES) {
    const payload = translations[locale];
    if (!payload) continue;
    rows.push({
      roleId,
      locale,
      displayName: payload.displayName,
      description: payload.description ?? null,
    } as RoleTranslation);
  }

  if (!rows.some((row) => row.locale === DEFAULT_LOCALE)) {
    throw new AppException(ErrorCode.DEFAULT_LOCALE_REQUIRED);
  }

  return rows;
}
