import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { PermissionTranslation } from './permission-translation.entity';

/**
 * A single `resource.action` capability, e.g. `machines.create`.
 * Authorization is permission-based at the check site; roles are just bundles of these.
 */
@Entity('permissions')
export class Permission extends BaseEntity {
  @Index('uq_permissions_code', { unique: true })
  @Column({ type: 'varchar', length: 80 })
  code: string;

  /** UI grouping key, e.g. `machines`, `finance`. Renders the checkbox tree in the app. */
  @Index('idx_permissions_group')
  @Column({ name: 'group', type: 'varchar', length: 50 })
  group: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => PermissionTranslation, (translation) => translation.permission, {
    cascade: ['insert', 'update'],
  })
  translations: PermissionTranslation[];
}
