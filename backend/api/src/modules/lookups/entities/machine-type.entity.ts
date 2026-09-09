import { Column, Entity, Index, OneToMany } from 'typeorm';
import { LookupEntity } from 'src/common/entities/lookup.entity';
import { MachineTypeTranslation } from './machine-type-translation.entity';

/** Seeded: POS_TERMINAL, MOBILE_POS, SMART_POS, PIN_PAD, CASH_REGISTER. */
@Entity('machine_types')
@Index('uq_machine_types_code', ['code'], { unique: true })
export class MachineType extends LookupEntity {
  /**
   * Whether machines of this type carry a SIM card, which decides if
   * `machines.sim_serial` is required at intake (`03-database-schema.md`).
   *
   * A type-level flag rather than a blanket `NOT NULL` on the machine, because a `PIN_PAD` has
   * no mobile line while every POS variant does — and the mobile form needs to know whether to
   * show the SIM field before the user has typed anything.
   */
  @Column({ name: 'requires_sim', type: 'boolean', default: true })
  requiresSim: boolean;

  @OneToMany(() => MachineTypeTranslation, (translation) => translation.machineType, {
    cascade: ['insert', 'update'],
  })
  translations: MachineTypeTranslation[];
}
