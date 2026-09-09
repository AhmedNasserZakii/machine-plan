import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { NameDescriptionTranslationEntity } from 'src/common/entities/translation.entity';
import { MachineModel } from './machine-model.entity';

@Entity('machine_model_translations')
@Unique('uq_machine_model_locale', ['machineModelId', 'locale'])
@Index('idx_mmt_locale', ['locale'])
export class MachineModelTranslation extends NameDescriptionTranslationEntity {
  @Column({ name: 'machine_model_id', type: 'uuid' })
  machineModelId: string;

  @ManyToOne(() => MachineModel, (machineModel) => machineModel.translations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'machine_model_id' })
  machineModel: MachineModel;
}
