import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { DEFAULT_LOCALE, isSupportedLocale, Locale } from 'src/common/constants/locales';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { User } from 'src/modules/users/entities/user.entity';

/** A resolved recipient: who to notify and which language to write it in. */
export interface Recipient {
  id: string;
  fullName: string;
  branchId: string | null;
  locale: Locale;
}

/**
 * Turns the recipient column of the `18` event catalogue — "Director", "branch supervisor",
 * "finance readers" — into user ids.
 *
 * Roles are resolved by code and permissions by their **effective** set, because "finance
 * readers" is not a role: the Director hands finance access out with
 * `user_permission_overrides`, and a resolver that only looked at roles would leave exactly the
 * people who were deliberately granted it out of the alert.
 */
@Injectable()
export class NotificationRecipientsService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async directors(): Promise<Recipient[]> {
    return this.byRoleCodes([SystemRole.DIRECTOR], null);
  }

  /** The supervisors of one branch. Empty for a company-level event with no branch attached. */
  async branchSupervisors(branchId: string | null): Promise<Recipient[]> {
    if (!branchId) return [];

    return this.byRoleCodes([SystemRole.BRANCH_SUPERVISOR], branchId);
  }

  /** The Director plus the branch's supervisors — the pair most escalations go to. */
  async directorsAndBranchSupervisors(branchId: string | null): Promise<Recipient[]> {
    return dedupe([...(await this.directors()), ...(await this.branchSupervisors(branchId))]);
  }

  async byId(userId: string): Promise<Recipient | null> {
    const user = await this.users.findOne({ where: { id: userId, deletedAt: IsNull() } });

    return user && user.isActive ? toRecipient(user) : null;
  }

  async byIds(userIds: readonly string[]): Promise<Recipient[]> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return [];

    const rows = await this.users
      .createQueryBuilder('user')
      .where('user.id IN (:...ids)', { ids: unique })
      .andWhere('user.is_active = true')
      .andWhere('user.deleted_at IS NULL')
      .getMany();

    return rows.map(toRecipient);
  }

  /**
   * Everyone whose effective permission set contains `code`, optionally narrowed to a branch.
   *
   * `(role_permissions ∪ overrides[ALLOW]) \ overrides[DENY]`, in one statement rather than a
   * permission lookup per account: the finance alerts fan out to whoever can read money, and on
   * a hundred-account tenant that would otherwise be a hundred round trips per notification.
   */
  async withPermission(code: string, branchId?: string | null): Promise<Recipient[]> {
    const qb = this.users
      .createQueryBuilder('user')
      .leftJoin('permissions', 'permission', 'permission.code = :code', { code })
      .leftJoin(
        'role_permissions',
        'rolePermission',
        'rolePermission.role_id = user.role_id AND rolePermission.permission_id = permission.id',
      )
      .leftJoin(
        'user_permission_overrides',
        'override',
        'override.user_id = user.id AND override.permission_id = permission.id AND override.deleted_at IS NULL',
      )
      .where('user.deleted_at IS NULL')
      .andWhere('user.is_active = true')
      .andWhere("(rolePermission.permission_id IS NOT NULL OR override.effect = 'ALLOW')")
      .andWhere("(override.effect IS NULL OR override.effect <> 'DENY')");

    if (branchId !== undefined && branchId !== null) {
      // Company-level readers are included: a Director with no branch still has to hear that a
      // branch blew its budget.
      qb.andWhere('(user.branch_id = :branchId OR user.branch_id IS NULL)', { branchId });
    }

    return (await qb.getMany()).map(toRecipient);
  }

  private async byRoleCodes(
    codes: readonly string[],
    branchId: string | null,
  ): Promise<Recipient[]> {
    const qb = this.users
      .createQueryBuilder('user')
      .innerJoin('roles', 'role', 'role.id = user.role_id')
      .where('role.code IN (:...codes)', { codes })
      .andWhere('user.is_active = true')
      .andWhere('user.deleted_at IS NULL');

    if (branchId) qb.andWhere('user.branch_id = :branchId', { branchId });

    return (await qb.getMany()).map(toRecipient);
  }
}

function toRecipient(user: User): Recipient {
  return {
    id: user.id,
    fullName: user.fullName,
    branchId: user.branchId,
    locale: isSupportedLocale(user.preferredLocale) ? user.preferredLocale : DEFAULT_LOCALE,
  };
}

/** The same person can qualify twice — a Director who is also a finance reader, say. */
export function dedupe(recipients: readonly Recipient[]): Recipient[] {
  const byId = new Map(recipients.map((recipient) => [recipient.id, recipient]));

  return [...byId.values()];
}
