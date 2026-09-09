import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TranslationEntity } from 'src/common/entities/translation.entity';
import { Role } from './role.entity';

@Entity('role_translations')
@Unique('uq_role_locale', ['roleId', 'locale'])
@Index('idx_role_translations_locale', ['locale'])
export class RoleTranslation extends TranslationEntity {
  @Column({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ManyToOne(() => Role, (role) => role.translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;
}
