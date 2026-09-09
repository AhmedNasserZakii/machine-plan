import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { DecommissionReason } from 'src/modules/lookups/entities/decommission-reason.entity';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { User } from 'src/modules/users/entities/user.entity';

/**
 * The end of a machine's life (`13`) — and the point where its cost story is frozen.
 *
 * The four `*_at_decision` columns are copies, not joins. A maintenance cost corrected next month
 * must not rewrite the numbers the Director scrapped the unit on, which is exactly what reading
 * them live off `machines` would do.
 */
@Entity('decommissions')
@Index('idx_decommissions_at', ['decommissionedAt'])
export class Decommission extends BaseEntity {
  @Column({ name: 'machine_id', type: 'uuid' })
  machineId: string;

  @Column({ name: 'decommission_reason_id', type: 'uuid' })
  decommissionReasonId: string;

  @Column({ type: 'text' })
  notes: string;

  @Column({ name: 'decommissioned_at', type: 'timestamptz' })
  decommissionedAt: Date;

  @Column({ name: 'decommissioned_by_user_id', type: 'uuid' })
  decommissionedByUserId: string;

  @Column({
    name: 'purchase_price_at_decision',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  purchasePriceAtDecision: string | null;

  @Column({
    name: 'cumulative_repair_cost_at_decision',
    type: 'numeric',
    precision: 14,
    scale: 2,
  })
  cumulativeRepairCostAtDecision: string;

  @Column({ name: 'repair_count_at_decision', type: 'int' })
  repairCountAtDecision: number;

  /** How many serials the asset wore. 1 for a machine that was never swapped. */
  @Column({ name: 'chain_length_at_decision', type: 'int', default: 1 })
  chainLengthAtDecision: number;

  /** The `COMPANY_TO_SCRAP` hand-off, so the move shows up in the timeline like every other. */
  @Column({ name: 'transfer_id', type: 'uuid', nullable: true })
  transferId: string | null;

  @Column({ name: 'signature_media_id', type: 'uuid', nullable: true })
  signatureMediaId: string | null;

  @Column({ name: 'reverted_at', type: 'timestamptz', nullable: true })
  revertedAt: Date | null;

  @Column({ name: 'reverted_by_user_id', type: 'uuid', nullable: true })
  revertedByUserId: string | null;

  @Column({ name: 'revert_reason', type: 'text', nullable: true })
  revertReason: string | null;

  @ManyToOne(() => Machine, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'machine_id' })
  machine: Machine;

  @ManyToOne(() => DecommissionReason, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'decommission_reason_id' })
  reason: DecommissionReason;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'decommissioned_by_user_id' })
  decommissionedBy: User;
}
