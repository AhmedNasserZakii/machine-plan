import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { AuditService } from 'src/common/audit';
import { ErrorCode } from 'src/common/constants/error-codes';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { AuditAction, AuditEntityType, PermissionEffect } from 'src/common/enums';
import { AppException } from 'src/common/errors';
import { AuthUser } from 'src/common/types/request.types';
import { likePattern } from 'src/common/utils';
import { normalizePhone } from 'src/common/utils/phone.util';
import { PasswordService } from 'src/modules/auth/services/password.service';
import { RevokeReason } from 'src/modules/auth/entities/refresh-token.entity';
import { TokenService } from 'src/modules/auth/services/token.service';
import { PermissionsService } from 'src/modules/roles/permissions.service';
import { BRANCH_SCOPED_ROLES, Role, SystemRole } from 'src/modules/roles/entities/role.entity';
import { Permission } from 'src/modules/roles/entities/permission.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { ResetPasswordDto, SetUserPermissionsDto, UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { Branch } from 'src/modules/organization/entities/branch.entity';
import { UserPermissionOverride } from './entities/user-permission-override.entity';
import { CUSTODY_PORT, CustodyPort } from './custody.port';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(Permission) private readonly permissions: Repository<Permission>,
    @InjectRepository(UserPermissionOverride)
    private readonly overrides: Repository<UserPermissionOverride>,
    @InjectRepository(Branch) private readonly branches: Repository<Branch>,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly permissionsService: PermissionsService,
    @Inject(CUSTODY_PORT) private readonly custody: CustodyPort,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: QueryUsersDto, branchScope: string | null): Promise<PaginatedResult<User>> {
    const qb = this.users
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.translations', 'role_tr');

    if (branchScope) {
      qb.andWhere('user.branch_id = :branchScope', { branchScope });
    } else if (query.branchId) {
      qb.andWhere('user.branch_id = :branchId', { branchId: query.branchId });
    }

    if (query.roleId) {
      qb.andWhere('user.role_id = :roleId', { roleId: query.roleId });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('user.is_active = :isActive', { isActive: query.isActive });
    }

    if (query.search) {
      const search = likePattern(query.search);
      qb.andWhere(
        new Brackets((where) =>
          where
            .where('user.full_name ILIKE :search', { search })
            .orWhere('user.phone ILIKE :search', { search }),
        ),
      );
    }

    // Sortable fields are whitelisted by the DTO, never interpolated from raw input.
    qb.orderBy(`user.${query.sortBy}`, query.order).addOrderBy('user.id', 'ASC');
    qb.skip(query.skip).take(query.take);

    const [items, total] = await qb.getManyAndCount();
    return new PaginatedResult(items, total, query.page, query.limit);
  }

  async findById(id: string, branchScope: string | null = null): Promise<User> {
    const user = await this.users.findOne({
      where: { id },
      relations: { role: { translations: true } },
    });

    // A user outside the caller's branch is reported as absent rather than forbidden,
    // so the response does not leak that the account exists.
    if (!user || (branchScope && user.branchId !== branchScope)) {
      throw AppException.notFound();
    }

    return user;
  }

  async create(dto: CreateUserDto, actor: AuthUser): Promise<User> {
    const phone = normalizePhone(dto.phone);
    const role = await this.roles.findOne({
      where: { id: dto.roleId },
      relations: { permissions: true },
    });

    if (!role) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'roleId', constraint: 'unknown role' }],
      });
    }

    // Privilege-escalation guard: `users.create` alone must never be enough to mint an
    // account more powerful than the actor (e.g. a fresh Director with a known password).
    this.assertActorHoldsAll(
      actor,
      (role.permissions ?? []).map((permission) => permission.code),
      'roleId',
    );

    await this.assertBranchIsValidForRole(role.code, dto.branchId ?? null);
    await this.assertPhoneAvailable(phone, null);
    await this.assertEmailAvailable(dto.email ?? null, null);

    const user = await this.users.save(
      this.users.create({
        fullName: dto.fullName,
        phone,
        email: dto.email ?? null,
        passwordHash: await this.passwords.hash(dto.password),
        roleId: role.id,
        branchId: dto.branchId ?? null,
        isActive: true,
        // The Director sets a temporary password, so the first login forces a change.
        mustChangePassword: true,
        createdBy: actor.id,
      }),
    );

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.USER_CREATED,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      after: {
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        roleId: user.roleId,
        branchId: user.branchId,
      },
    });

    return this.findById(user.id);
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser): Promise<User> {
    const user = await this.findById(id);

    // Changing your own role could remove your own access and lock you out.
    if (dto.roleId && dto.roleId !== user.roleId && id === actor.id) {
      throw new AppException(ErrorCode.CANNOT_EDIT_OWN_PERMISSIONS);
    }

    // An actor may not touch an account that outranks them: editing a more privileged
    // user's phone, branch or role is a takeover primitive, not administration.
    await this.assertActorOutranksUser(actor, user);

    const targetRole = await this.resolveTargetRole(user, dto.roleId);
    const targetBranchId = dto.branchId !== undefined ? dto.branchId : user.branchId;
    await this.assertBranchIsValidForRole(targetRole.code, targetBranchId ?? null);

    const changesRole = Boolean(dto.roleId) && dto.roleId !== user.roleId;

    if (changesRole) {
      // The assigned role must not grant anything the actor does not hold themselves.
      this.assertActorHoldsAll(
        actor,
        (targetRole.permissions ?? []).map((permission) => permission.code),
        'roleId',
      );
    }

    if (dto.phone) {
      await this.assertPhoneAvailable(normalizePhone(dto.phone), user.id);
    }

    if (dto.email !== undefined) {
      await this.assertEmailAvailable(dto.email, user.id);
    }

    const patch = {
      ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
      ...(dto.phone !== undefined ? { phone: normalizePhone(dto.phone) } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.roleId !== undefined ? { roleId: dto.roleId } : {}),
      ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
      updatedBy: actor.id,
    };

    if (changesRole) {
      // Demoting a Director is the other way the last-Director invariant can be broken, so
      // it needs the same check-and-write-in-one-transaction treatment as `deactivate`.
      await this.dataSource.transaction(async (manager) => {
        await this.assertNotLastActiveDirector(manager, user, 'role change');
        await manager.getRepository(User).update(user.id, patch);
      });
    } else {
      await this.users.update(user.id, patch);
    }

    if (dto.roleId && dto.roleId !== user.roleId) {
      await this.permissionsService.invalidateUser(user.id);
    }

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.USER_UPDATED,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      before: {
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        roleId: user.roleId,
        branchId: user.branchId,
      },
      after: {
        fullName: patch.fullName ?? user.fullName,
        phone: patch.phone ?? user.phone,
        email: 'email' in patch ? patch.email : user.email,
        roleId: patch.roleId ?? user.roleId,
        branchId: 'branchId' in patch ? patch.branchId : user.branchId,
      },
    });

    return this.findById(user.id);
  }

  /**
   * A user holding machines cannot be deactivated — their custody must first be moved to
   * someone else through a transfer, otherwise the fleet would have an owner who cannot log in.
   */
  async deactivate(id: string, actor: AuthUser): Promise<User> {
    const user = await this.findById(id);

    if (id === actor.id) {
      throw new AppException(ErrorCode.CANNOT_EDIT_OWN_PERMISSIONS);
    }

    if (!user.isActive) return user;

    // The guard and the write share one transaction so the count cannot go stale between
    // them: two requests deactivating two different Directors would otherwise both pass.
    await this.dataSource.transaction(async (manager) => {
      // The last-Director invariant is checked before the ranking guard because no actor can
      // ever outrank a Director: ranking-first would answer every such attempt with a generic
      // 403 and the caller would never learn the real reason the system refused. It leaks
      // nothing — the caller already needs `users.read` to name this target.
      await this.assertNotLastActiveDirector(manager, user, 'deactivation');

      await this.assertActorOutranksUser(actor, user);

      const heldMachines = await this.custody.countHeldByUser(user.id);
      if (heldMachines > 0) {
        throw AppException.conflict(ErrorCode.USER_HAS_CUSTODY, { count: heldMachines });
      }

      await manager.getRepository(User).update(user.id, { isActive: false, updatedBy: actor.id });
    });

    await this.tokens.revokeAllForUser(user.id, RevokeReason.USER_DEACTIVATED);
    await this.permissionsService.invalidateUser(user.id);

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.USER_DEACTIVATED,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      before: { isActive: true },
      after: { isActive: false },
    });

    return this.findById(user.id);
  }

  async activate(id: string, actor: AuthUser): Promise<User> {
    const user = await this.findById(id);
    if (user.isActive) return user;

    await this.assertActorOutranksUser(actor, user);

    // Re-run the same validation as create/update: the user's branch may have been
    // deactivated while the account was inactive, and reactivating them would otherwise
    // pin active staff to a closed branch.
    await this.assertBranchIsValidForRole(user.role.code, user.branchId ?? null);

    await this.users.update(user.id, { isActive: true, updatedBy: actor.id });

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.USER_ACTIVATED,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      before: { isActive: false },
      after: { isActive: true },
    });

    return this.findById(user.id);
  }

  /** Resets a password and forces a change on next login. */
  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
    actor: AuthUser,
  ): Promise<{ userId: string; temporaryPassword: string | null }> {
    const user = await this.findById(id);

    // Whoever resets a password knows the new one — so resetting a more privileged
    // account (e.g. a Director) is a one-step takeover, not administration.
    await this.assertActorOutranksUser(actor, user);

    const generated = dto.newPassword ? null : randomBytes(9).toString('base64url');
    const password = dto.newPassword ?? (generated as string);

    await this.users.update(user.id, {
      passwordHash: await this.passwords.hash(password),
      mustChangePassword: true,
      updatedBy: actor.id,
    });

    await this.tokens.revokeAllForUser(user.id, RevokeReason.ADMIN_RESET);

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.PASSWORD_RESET,
      entityType: AuditEntityType.USER,
      entityId: user.id,
    });

    return { userId: user.id, temporaryPassword: generated };
  }

  async getPermissions(
    id: string,
    branchScope: string | null = null,
  ): Promise<{
    userId: string;
    rolePermissions: string[];
    overrides: { code: string; effect: PermissionEffect }[];
    effectivePermissions: string[];
  }> {
    const user = await this.users.findOne({
      where: { id },
      relations: { role: { permissions: true } },
    });

    // Same rule as findById: out-of-scope users read as absent, so a branch-scoped
    // caller cannot enumerate the capabilities of accounts in other branches.
    if (!user || (branchScope && user.branchId !== branchScope)) {
      throw AppException.notFound();
    }

    const overrides = await this.overrides.find({
      where: { userId: id },
      relations: { permission: true },
    });

    return {
      userId: id,
      rolePermissions: (user.role.permissions ?? []).map((permission) => permission.code).sort(),
      overrides: overrides.map((override) => ({
        code: override.permission.code,
        effect: override.effect,
      })),
      effectivePermissions: await this.permissionsService.getEffectivePermissions(id),
    };
  }

  /**
   * Replaces a user's override set. This is how the Director hands the finance module to a
   * single supervisor, or takes it away, without designing a new role.
   */
  async setPermissions(id: string, dto: SetUserPermissionsDto, actor: AuthUser): Promise<void> {
    if (id === actor.id) {
      throw new AppException(ErrorCode.CANNOT_EDIT_OWN_PERMISSIONS);
    }

    const user = await this.findById(id);
    const allow = [...new Set(dto.allow ?? [])];
    const deny = [...new Set(dto.deny ?? [])];

    const conflicting = allow.filter((code) => deny.includes(code));
    if (conflicting.length > 0) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: conflicting.map((code) => ({
          field: 'allow',
          value: code,
          constraint: 'cannot be both allowed and denied',
        })),
      });
    }

    // Codes are resolved before the escalation check so that a typo is reported as a typo.
    // "you cannot grant nope.nope" is a misleading answer to a code that is not a privilege at
    // all, and it leaks the shape of the catalogue to a caller probing for valid names.
    const byCode = await this.resolvePermissionsByCode([...allow, ...deny]);

    // ALLOW overrides may only hand out capabilities the actor holds — otherwise
    // `roles.manage` becomes a proxy for granting an accomplice anything at all.
    this.assertActorHoldsAll(actor, allow, 'allow');

    const existing = await this.overrides.find({
      where: { userId: user.id },
      relations: { permission: true },
    });
    const before = {
      allow: existing
        .filter((override) => override.effect === PermissionEffect.ALLOW)
        .map((override) => override.permission.code)
        .sort(),
      deny: existing
        .filter((override) => override.effect === PermissionEffect.DENY)
        .map((override) => override.permission.code)
        .sort(),
    };

    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(UserPermissionOverride);

      // Hard delete, not soft: an override is a current statement of intent, and a
      // soft-deleted row would still have to be filtered out of every resolution query.
      await repository.delete({ userId: user.id });

      const rows = [
        ...allow.map((code) => ({ code, effect: PermissionEffect.ALLOW })),
        ...deny.map((code) => ({ code, effect: PermissionEffect.DENY })),
      ].map((entry) =>
        repository.create({
          userId: user.id,
          permissionId: byCode.get(entry.code) as string,
          effect: entry.effect,
          createdBy: actor.id,
        }),
      );

      if (rows.length > 0) await repository.save(rows);
    });

    await this.permissionsService.invalidateUser(user.id);

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.USER_PERMISSIONS_UPDATED,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      before,
      after: { allow: [...allow].sort(), deny: [...deny].sort() },
    });
  }

  private async resolveTargetRole(user: User, roleId?: string): Promise<Role> {
    if (!roleId || roleId === user.roleId) return user.role;

    const role = await this.roles.findOne({
      where: { id: roleId },
      relations: { permissions: true },
    });
    if (!role) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'roleId', constraint: 'unknown role' }],
      });
    }
    return role;
  }

  /**
   * The privilege-subset rule: an actor may only grant, or act upon, capabilities they
   * themselves hold. Without it, `users.update` alone is a Director-takeover primitive
   * (assign the DIRECTOR role to an accomplice, or reset a Director's password).
   */
  private assertActorHoldsAll(actor: AuthUser, codes: string[], field: string): void {
    const missing = codes.filter((code) => !actor.permissions.includes(code));
    if (missing.length > 0) {
      throw new AppException(ErrorCode.INSUFFICIENT_PERMISSIONS, {
        details: missing.map((code) => ({
          field,
          value: code,
          constraint: 'cannot grant or manage a privilege you do not hold',
        })),
      });
    }
  }

  /** Forbids acting on a target whose effective permissions exceed the actor's. */
  private async assertActorOutranksUser(actor: AuthUser, target: User): Promise<void> {
    if (target.id === actor.id) return;
    const targetPermissions = await this.permissionsService.getEffectivePermissions(target.id);
    this.assertActorHoldsAll(actor, targetPermissions, 'userId');
  }

  /**
   * Two separate rules: branch-scoped roles must have a branch at all, and any branch given
   * must exist and still be active — otherwise staff could be parked on a closed branch.
   */
  private async assertBranchIsValidForRole(
    roleCode: string,
    branchId: string | null,
  ): Promise<void> {
    if (BRANCH_SCOPED_ROLES.includes(roleCode) && !branchId) {
      throw new AppException(ErrorCode.BRANCH_REQUIRED_FOR_ROLE, {
        details: [{ field: 'branchId', constraint: `required for role ${roleCode}` }],
      });
    }

    if (!branchId) return;

    const branch = await this.branches.findOne({
      where: { id: branchId },
      select: { id: true, isActive: true },
    });

    if (!branch) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'branchId', value: branchId, constraint: 'unknown branch' }],
      });
    }

    if (!branch.isActive) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'branchId', value: branchId, constraint: 'branch is deactivated' }],
      });
    }
  }

  /** Guarantees the system can never be left without an active Director. */
  /**
   * Refuses to remove the last way into the system.
   *
   * Takes the transaction's manager and locks every active Director row before counting.
   * Two requests demoting two different Directors would otherwise each see the other still
   * active, both pass, and leave an installation with no Director — a state no API call can
   * repair, since granting the role requires holding it.
   */
  private async assertNotLastActiveDirector(
    manager: EntityManager,
    user: User,
    action: string,
  ): Promise<void> {
    if (user.role.code !== SystemRole.DIRECTOR) return;

    // `FOR UPDATE` on the set, not just the target: the invariant is about the group, so the
    // group is what has to be held still while it is counted.
    await manager
      .getRepository(User)
      .createQueryBuilder('user')
      .where('user.role_id = :roleId', { roleId: user.roleId })
      .andWhere('user.is_active = true')
      .setLock('pessimistic_write')
      .getMany();

    const remaining = await manager.getRepository(User).count({
      where: {
        id: Not(user.id),
        isActive: true,
        roleId: user.roleId,
      },
    });

    if (remaining === 0) {
      throw new AppException(ErrorCode.LAST_DIRECTOR, {
        details: [{ constraint: `blocked ${action}: no other active director exists` }],
      });
    }
  }

  private async assertPhoneAvailable(phone: string, exceptUserId: string | null): Promise<void> {
    const existing = await this.users.findOne({
      where: { phone },
      withDeleted: true,
      select: { id: true },
    });

    if (existing && existing.id !== exceptUserId) {
      throw AppException.conflict(ErrorCode.PHONE_EXISTS);
    }
  }

  private async assertEmailAvailable(
    email: string | null,
    exceptUserId: string | null,
  ): Promise<void> {
    if (!email) return;

    const existing = await this.users.findOne({
      where: { email },
      withDeleted: true,
      select: { id: true },
    });

    if (existing && existing.id !== exceptUserId) {
      throw AppException.conflict(ErrorCode.EMAIL_EXISTS);
    }
  }

  private async resolvePermissionsByCode(codes: string[]): Promise<Map<string, string>> {
    if (codes.length === 0) return new Map();

    const unique = [...new Set(codes)];
    const found = await this.permissions.find({ where: { code: In(unique) } });
    const byCode = new Map(found.map((permission) => [permission.code, permission.id]));

    const unknown = unique.filter((code) => !byCode.has(code));
    if (unknown.length > 0) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: unknown.map((code) => ({
          field: 'permissions',
          value: code,
          constraint: 'unknown permission code',
        })),
      });
    }

    return byCode;
  }
}
