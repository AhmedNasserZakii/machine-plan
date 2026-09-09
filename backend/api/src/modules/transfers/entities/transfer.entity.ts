import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import {
  PartyType,
  TransferDirection,
  TransferStatus,
  TransferType,
} from 'src/common/enums/transfer.enum';
import { Branch } from 'src/modules/organization/entities/branch.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { TransferItem } from './transfer-item.entity';
import { TransferSignature } from './transfer-signature.entity';

/**
 * One physical hand-off: a sender declares what leaves, a receiver signs for what arrives. Between
 * those two moments the machines belong to nobody and read `IN_TRANSIT`.
 *
 * The parties are polymorphic on purpose — a warehouse, a user and a merchant can all hold custody,
 * and forcing them into one table would either invent fake users for merchants or lose the
 * distinction that decides which rule applies.
 */
@Entity('transfers')
@Index('idx_transfers_status_created', ['status', 'createdAt'])
@Index('idx_transfers_to_party', ['toPartyType', 'toPartyId', 'status'])
@Index('idx_transfers_from_party', ['fromPartyType', 'fromPartyId', 'status'])
@Index('idx_transfers_branch', ['branchId', 'status'])
export class Transfer extends BaseEntity {
  /** Human-readable and quoted over the phone: `TRF-2026-000141`. */
  @Column({ name: 'reference_no', type: 'varchar', length: 30, unique: true })
  referenceNo: string;

  @Column({ type: 'varchar', length: 40 })
  type: TransferType;

  @Column({ type: 'varchar', length: 10 })
  direction: TransferDirection;

  @Column({ name: 'from_party_type', type: 'varchar', length: 20 })
  fromPartyType: PartyType;

  /** `null` for `FACTORY`, which is not an entity in this system. */
  @Column({ name: 'from_party_id', type: 'uuid', nullable: true })
  fromPartyId: string | null;

  @Column({ name: 'to_party_type', type: 'varchar', length: 20 })
  toPartyType: PartyType;

  @Column({ name: 'to_party_id', type: 'uuid', nullable: true })
  toPartyId: string | null;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', length: 20, default: TransferStatus.PENDING })
  status: TransferStatus;

  @Column({ name: 'initiated_by_user_id', type: 'uuid' })
  initiatedByUserId: string;

  @Column({ name: 'confirmed_by_user_id', type: 'uuid', nullable: true })
  confirmedByUserId: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Generated on the device before the request leaves it; the offline dedupe key (`20`). */
  @Column({ name: 'client_uuid', type: 'uuid', nullable: true, unique: true })
  clientUuid: string | null;

  /**
   * When the hand-off physically happened. A representative in a village signs at 14:00 and syncs
   * at 19:00, so this routinely predates `created_at` — reports must use this column.
   */
  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'initiated_by_user_id' })
  initiatedBy?: User;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'confirmed_by_user_id' })
  confirmedBy?: User | null;

  @OneToMany(() => TransferItem, (item) => item.transfer)
  items: TransferItem[];

  @OneToMany(() => TransferSignature, (signature) => signature.transfer)
  signatures: TransferSignature[];
}
