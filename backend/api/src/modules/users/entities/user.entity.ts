import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { Role } from 'src/modules/roles/entities/role.entity';
import { UserPermissionOverride } from './user-permission-override.entity';

/**
 * Accounts are created by the Director only — there is no public sign-up.
 * The login identifier is the phone number, because field staff do not reliably have email.
 */
@Entity('users')
export class User extends BaseEntity {
  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  @Index('uq_users_phone', { unique: true })
  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Index('uq_users_email', { unique: true })
  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  /** argon2id digest. Never selected unless explicitly requested. */
  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Index('idx_users_role_id')
  @Column({ name: 'role_id', type: 'uuid' })
  roleId: string;

  /** NULL for company-level users. The FK to `branches` is added in the Phase 2 migration. */
  @Index('idx_users_branch_id')
  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** The Director creates accounts, so the first login always forces a password change. */
  @Column({ name: 'must_change_password', type: 'boolean', default: true })
  mustChangePassword: boolean;

  @Column({ name: 'biometric_enabled', type: 'boolean', default: false })
  biometricEnabled: boolean;

  @Column({ name: 'signature_image_url', type: 'text', nullable: true })
  signatureImageUrl: string | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  /**
   * Which language this account is written to in. NULL means the default locale.
   *
   * Notifications are rendered in the **recipient's** language, not the actor's (`18`), and a
   * notification row stores the rendered text — so unlike a request locale, which arrives on
   * every call in `Accept-Language`, this one has to be on the account. Set through
   * `PUT /notification-preferences`.
   */
  @Column({ name: 'preferred_locale', type: 'varchar', length: 5, nullable: true })
  preferredLocale: string | null;

  @ManyToOne(() => Role, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @OneToMany(() => UserPermissionOverride, (override) => override.user)
  permissionOverrides: UserPermissionOverride[];
}
