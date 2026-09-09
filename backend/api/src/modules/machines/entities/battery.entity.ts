import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { Machine } from './machine.entity';

/**
 * Bound to exactly one machine for life. `machine_id` is unique, and there is deliberately no
 * endpoint that moves a battery between machines: if a unit turns up with the wrong battery the
 * hand-off is still accepted and a violation is filed instead, because refusing it would strand a
 * representative in a shop with a machine nobody will sign for.
 */
@Entity('batteries')
export class Battery extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  serial: string;

  @Column({ name: 'machine_id', type: 'uuid' })
  machineId: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToOne(() => Machine, (machine) => machine.battery, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'machine_id' })
  machine: Machine;
}
