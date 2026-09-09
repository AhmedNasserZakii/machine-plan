import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import {
  MaintenanceResult,
  MaintenanceStatus,
  ResponsibleParty,
} from 'src/common/enums/operations.enum';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { MaintenanceLocation } from 'src/modules/lookups/entities/maintenance-location.entity';
import { PaymentMethod } from 'src/modules/lookups/entities/payment-method.entity';
import { Merchant } from 'src/modules/merchants/entities/merchant.entity';
import { Branch } from 'src/modules/organization/entities/branch.entity';
import { User } from 'src/modules/users/entities/user.entity';

/**
 * A machine that stopped working, where it went, what it cost, and who paid (`11`).
 *
 * The order is opened before anybody knows the answer to the last two: the responsible party is
 * decided **after** the repair, which is why `result`, `cost` and `responsible_party` are all
 * nullable until it closes. The check constraints in the migration are what stop a closed order
 * existing without them.
 *
 * Only one order per machine may be open at a time (`11`, rule 1) — enforced by
 * `uq_machine_open_maintenance`, a partial unique index over the three open statuses, and by the
 * row lock the service takes before it inserts.
 */
@Entity('maintenance_orders')
@Index('idx_mo_machine_id', ['machineId'])
@Index('idx_mo_status', ['status'])
@Index('idx_mo_branch_id', ['branchId'])
export class MaintenanceOrder extends BaseEntity {
  /** `MNT-2026-000087` — what a supervisor quotes on the phone. */
  @Column({ name: 'reference_no', type: 'varchar', length: 30 })
  referenceNo: string;

  @Column({ name: 'machine_id', type: 'uuid' })
  machineId: string;

  @Column({ name: 'maintenance_location_id', type: 'uuid' })
  maintenanceLocationId: string;

  /** The branch that has to get the machine back. Null for units held company-side. */
  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @Column({ name: 'reported_fault', type: 'text' })
  reportedFault: string;

  @Column({ name: 'sent_at', type: 'timestamptz' })
  sentAt: Date;

  @Column({ name: 'returned_at', type: 'timestamptz', nullable: true })
  returnedAt: Date | null;

  @Column({ type: 'varchar', length: 20, default: MaintenanceStatus.OPEN })
  status: MaintenanceStatus;

  @Column({ type: 'varchar', length: 20, nullable: true })
  result: MaintenanceResult | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  cost: string | null;

  @Column({ name: 'is_free_under_warranty', type: 'boolean', default: false })
  isFreeUnderWarranty: boolean;

  /**
   * What the warranty dates said when the order was opened, so the app can pre-tick the checkbox.
   * Kept separate from the decision: a fault outside the warranty terms is still chargeable
   * during the window, and the technician overrides it on close (`11`).
   */
  @Column({ name: 'suggested_free_under_warranty', type: 'boolean', default: false })
  suggestedFreeUnderWarranty: boolean;

  @Column({ name: 'responsible_party', type: 'varchar', length: 20, nullable: true })
  responsibleParty: ResponsibleParty | null;

  @Column({ name: 'responsible_user_id', type: 'uuid', nullable: true })
  responsibleUserId: string | null;

  @Column({ name: 'responsible_merchant_id', type: 'uuid', nullable: true })
  responsibleMerchantId: string | null;

  @Column({ name: 'payment_method_id', type: 'uuid', nullable: true })
  paymentMethodId: string | null;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string | null;

  @Column({ name: 'invoice_media_id', type: 'uuid', nullable: true })
  invoiceMediaId: string | null;

  @Column({ name: 'out_transfer_id', type: 'uuid', nullable: true })
  outTransferId: string | null;

  @Column({ name: 'in_transfer_id', type: 'uuid', nullable: true })
  inTransferId: string | null;

  /**
   * Free text: internal workshop technicians are deliberately not system users in v1 (`11`,
   * rule 3). The supervisor records the outcome on their behalf, and a real account can be
   * backfilled later without a schema break.
   */
  @Column({ name: 'performed_by_name', type: 'varchar', length: 150, nullable: true })
  performedByName: string | null;

  /** The expense this close posted. Null when nobody paid — warranty, or the factory absorbed it. */
  @Column({ name: 'finance_transaction_id', type: 'uuid', nullable: true })
  financeTransactionId: string | null;

  @Column({ name: 'violation_id', type: 'uuid', nullable: true })
  violationId: string | null;

  @Column({ name: 'subscription_id', type: 'uuid', nullable: true })
  subscriptionId: string | null;

  @Column({ name: 'closed_by_user_id', type: 'uuid', nullable: true })
  closedByUserId: string | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Generated on the device before the request leaves it; the offline dedupe key (`20`). */
  @Column({ name: 'client_uuid', type: 'uuid', nullable: true, unique: true })
  clientUuid: string | null;

  @ManyToOne(() => Machine, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'machine_id' })
  machine: Machine;

  @ManyToOne(() => MaintenanceLocation, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'maintenance_location_id' })
  maintenanceLocation: MaintenanceLocation;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'responsible_user_id' })
  responsibleUser: User | null;

  @ManyToOne(() => Merchant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'responsible_merchant_id' })
  responsibleMerchant: Merchant | null;

  @ManyToOne(() => PaymentMethod, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod: PaymentMethod | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'closed_by_user_id' })
  closedBy: User | null;
}
