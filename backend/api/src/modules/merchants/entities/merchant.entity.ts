import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { Branch } from 'src/modules/organization/entities/branch.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { MerchantSubscription } from './merchant-subscription.entity';

/**
 * The last stop a machine makes. A merchant is a record rather than an account: he never logs in
 * and never signs, which is why `REPRESENTATIVE_TO_MERCHANT` is one of the few transfer types the
 * sender attests to alone.
 *
 * `branchId` and `createdByUserId` are taken from the representative who registered him and are
 * never accepted from a request body — they are what scopes the merchant list, so letting the
 * client set them would hand it the keys to another branch's book of trade.
 */
@Entity('merchants')
@Index('idx_merchants_phone', ['phone'])
@Index('idx_merchants_branch_id', ['branchId'])
@Index('idx_merchants_created_by_user', ['createdByUserId'])
export class Merchant extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ name: 'shop_name', type: 'varchar', length: 150 })
  shopName: string;

  @Column({ type: 'text' })
  address: string;

  /** Egyptian national ID, 14 digits. Optional, but unique system-wide when given. */
  @Column({ name: 'national_id', type: 'varchar', length: 20, nullable: true })
  nationalId: string | null;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  /** The representative who registered him — the person a supervisor asks about this shop. */
  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Generated on the device before the request leaves it; the offline dedupe key (`20`). */
  @Column({ name: 'client_uuid', type: 'uuid', nullable: true, unique: true })
  clientUuid: string | null;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id' })
  registeredBy: User;

  @OneToMany(() => MerchantSubscription, (subscription) => subscription.merchant)
  subscriptions: MerchantSubscription[];
}
