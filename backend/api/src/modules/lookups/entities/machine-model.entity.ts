import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { LookupEntity } from 'src/common/entities/lookup.entity';
import { MachineModelTranslation } from './machine-model-translation.entity';
import { MachineType } from './machine-type.entity';

/** A concrete model within a type, e.g. `INGENICO_MOVE_5000` under `MOBILE_POS`. */
@Entity('machine_models')
@Index('uq_machine_models_code', ['code'], { unique: true })
@Index('idx_machine_models_type_id', ['machineTypeId'])
export class MachineModel extends LookupEntity {
  @Column({ name: 'machine_type_id', type: 'uuid' })
  machineTypeId: string;

  /** Operational data, not localized — a manufacturer name is written the same way everywhere. */
  @Column({ type: 'varchar', length: 150, nullable: true })
  manufacturer: string | null;

  @ManyToOne(() => MachineType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'machine_type_id' })
  machineType: MachineType;

  @OneToMany(() => MachineModelTranslation, (translation) => translation.machineModel, {
    cascade: ['insert', 'update'],
  })
  translations: MachineModelTranslation[];
}
