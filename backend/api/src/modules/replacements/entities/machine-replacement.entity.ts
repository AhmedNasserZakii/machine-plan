import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { User } from 'src/modules/users/entities/user.entity';

/**
 * One factory swap: this serial became that serial, on this date, for this reason (`12`).
 *
 * A serial is immutable (`07`), so a swap is a new machine row linked to the old one — never an
 * edit. Both sides carry a unique constraint in the migration, which is what keeps the chain
 * linear: a unit can be replaced once, and can itself be the replacement for one other unit.
 */
@Entity('machine_replacements')
@Index('idx_replacements_replaced_at', ['replacedAt'])
export class MachineReplacement extends BaseEntity {
  @Column({ name: 'old_machine_id', type: 'uuid' })
  oldMachineId: string;

  @Column({ name: 'new_machine_id', type: 'uuid' })
  newMachineId: string;

  /** Null when the swap was recorded outside a maintenance order. */
  @Column({ name: 'maintenance_order_id', type: 'uuid', nullable: true })
  maintenanceOrderId: string | null;

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'replaced_at', type: 'timestamptz' })
  replacedAt: Date;

  @ManyToOne(() => Machine, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'old_machine_id' })
  oldMachine: Machine;

  @ManyToOne(() => Machine, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'new_machine_id' })
  newMachine: Machine;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;
}
