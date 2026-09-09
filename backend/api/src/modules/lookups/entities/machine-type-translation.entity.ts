import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { NameTranslationEntity } from 'src/common/entities/translation.entity';
import { MachineType } from './machine-type.entity';

@Entity('machine_type_translations')
@Unique('uq_machine_type_locale', ['machineTypeId', 'locale'])
@Index('idx_mtt_locale', ['locale'])
export class MachineTypeTranslation extends NameTranslationEntity {
  @Column({ name: 'machine_type_id', type: 'uuid' })
  machineTypeId: string;

  @ManyToOne(() => MachineType, (machineType) => machineType.translations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'machine_type_id' })
  machineType: MachineType;
}
