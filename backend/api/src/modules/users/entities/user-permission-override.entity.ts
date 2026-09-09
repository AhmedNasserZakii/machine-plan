import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { PermissionEffect } from 'src/common/enums';
import { Permission } from 'src/modules/roles/entities/permission.entity';
import { User } from './user.entity';

/**
 * Grants or revokes a single permission for one user without inventing a new role.
 * This is how "the Director decides who sees the money" is implemented.
 *
 * Resolution order: `(role_permissions ∪ overrides[ALLOW]) \ overrides[DENY]` — DENY always wins.
 */
@Entity('user_permission_overrides')
@Unique('uq_user_permission_override', ['userId', 'permissionId'])
@Index('idx_user_permission_overrides_user_id', ['userId'])
export class UserPermissionOverride extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'permission_id', type: 'uuid' })
  permissionId: string;

  @Column({ type: 'varchar', length: 10 })
  effect: PermissionEffect;

  @ManyToOne(() => User, (user) => user.permissionOverrides, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;
}
