import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { SubscriptionPlanType } from 'src/common/enums/finance.enum';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { Merchant } from './merchant.entity';

/**
 * What the merchant pays, and when he is next due.
 *
 * A plan may cover the whole shop (`machineId` null) or one machine, which is how a merchant with
 * one free unit and one paid unit is modelled. `nextDueDate` rolls forward on each collection and
 * is the column the nightly overdue sweep reads, so it is indexed on its own.
 */
@Entity('merchant_subscriptions')
@Index('idx_subscriptions_next_due', ['nextDueDate'])
export class MerchantSubscription extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  /** Null means the plan covers everything the merchant holds. */
  @Column({ name: 'machine_id', type: 'uuid', nullable: true })
  machineId: string | null;

  @Column({ name: 'plan_type', type: 'varchar', length: 20 })
  planType: SubscriptionPlanType;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  amount: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  /** Null once a one-off fee has been collected, or when the plan is `NONE`. */
  @Column({ name: 'next_due_date', type: 'date', nullable: true })
  nextDueDate: string | null;

  @Column({ name: 'total_collected', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalCollected: string;

  @Column({ name: 'collection_count', type: 'int', default: 0 })
  collectionCount: number;

  @Column({ name: 'last_collected_at', type: 'timestamptz', nullable: true })
  lastCollectedAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Generated on the device before the request leaves it; the offline dedupe key (`20`). */
  @Column({ name: 'client_uuid', type: 'uuid', nullable: true, unique: true })
  clientUuid: string | null;

  @ManyToOne(() => Merchant, (merchant) => merchant.subscriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @ManyToOne(() => Machine, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'machine_id' })
  machine: Machine | null;
}
