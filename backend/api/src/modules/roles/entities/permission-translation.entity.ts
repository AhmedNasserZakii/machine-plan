import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TranslationEntity } from 'src/common/entities/translation.entity';
import { Permission } from './permission.entity';

@Entity('permission_translations')
@Unique('uq_permission_locale', ['permissionId', 'locale'])
// Indexed separately from the unique constraint because lookups filter on locale alone.
@Index('idx_permission_translations_locale', ['locale'])
export class PermissionTranslation extends TranslationEntity {
  @Column({ name: 'permission_id', type: 'uuid' })
  permissionId: string;

  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ManyToOne(() => Permission, (permission) => permission.translations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;
}
