import { Column, Entity, Index, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { Permission } from './permission.entity';
import { RoleTranslation } from './role-translation.entity';

/** Seeded codes. A role marked `is_system` cannot be deleted, but its permissions can change. */
export const SystemRole = {
  DIRECTOR: 'DIRECTOR',
  BRANCH_SUPERVISOR: 'BRANCH_SUPERVISOR',
  REPRESENTATIVE: 'REPRESENTATIVE',
  ACCOUNTANT: 'ACCOUNTANT',
  VIEWER: 'VIEWER',
} as const;

export type SystemRoleCode = (typeof SystemRole)[keyof typeof SystemRole];

/** Roles whose users must be scoped to a branch (`05-feature-users-roles-permissions.md`). */
export const BRANCH_SCOPED_ROLES: readonly string[] = [
  SystemRole.BRANCH_SUPERVISOR,
  SystemRole.REPRESENTATIVE,
];

@Entity('roles')
export class Role extends BaseEntity {
  @Index('uq_roles_code', { unique: true })
  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;

  @OneToMany(() => RoleTranslation, (translation) => translation.role, {
    cascade: ['insert', 'update'],
  })
  translations: RoleTranslation[];

  @ManyToMany(() => Permission, { cascade: false })
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions: Permission[];
}
