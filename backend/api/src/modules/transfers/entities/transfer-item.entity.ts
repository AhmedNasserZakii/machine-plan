import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { ItemCondition } from 'src/common/enums/transfer.enum';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { Transfer } from './transfer.entity';
import { TransferItemPhoto } from './transfer-item-photo.entity';

/**
 * One machine inside one hand-off, and the record of what was physically scanned next to it.
 *
 * The three `*Matches` columns are tri-state deliberately: `false` means the scanned serial did not
 * match what the system expects, `null` means nobody scanned it. Collapsing the two would turn
 * "the rep was in a hurry" into "the rep swapped the battery", which is an accusation.
 */
@Entity('transfer_items')
@Unique('uq_transfer_item_machine', ['transferId', 'machineId'])
@Index('idx_transfer_items_machine', ['machineId'])
export class TransferItem extends BaseEntity {
  @Column({ name: 'transfer_id', type: 'uuid' })
  transferId: string;

  @Column({ name: 'machine_id', type: 'uuid' })
  machineId: string;

  @Column({ name: 'battery_serial_scanned', type: 'varchar', length: 100, nullable: true })
  batterySerialScanned: string | null;

  @Column({ name: 'battery_matches', type: 'boolean', nullable: true })
  batteryMatches: boolean | null;

  @Column({ name: 'sim_serial_scanned', type: 'varchar', length: 100, nullable: true })
  simSerialScanned: string | null;

  @Column({ name: 'sim_matches', type: 'boolean', nullable: true })
  simMatches: boolean | null;

  @Column({ name: 'box_serial_scanned', type: 'varchar', length: 100, nullable: true })
  boxSerialScanned: string | null;

  @Column({ name: 'box_matches', type: 'boolean', nullable: true })
  boxMatches: boolean | null;

  @Column({ name: 'has_charger', type: 'boolean', default: true })
  hasCharger: boolean;

  @Column({ name: 'has_box', type: 'boolean', default: false })
  hasBox: boolean;

  @Column({ type: 'varchar', length: 20, default: ItemCondition.GOOD })
  condition: ItemCondition;

  /**
   * The machine's status the instant before it went `IN_TRANSIT`. Persisted at creation so a
   * rejection is an exact rollback rather than a guess at where the unit came from.
   */
  @Column({ name: 'previous_status', type: 'varchar', length: 40 })
  previousStatus: MachineStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => Transfer, (transfer) => transfer.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transfer_id' })
  transfer: Transfer;

  @ManyToOne(() => Machine, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'machine_id' })
  machine: Machine;

  @OneToMany(() => TransferItemPhoto, (photo) => photo.transferItem)
  photos: TransferItemPhoto[];
}
