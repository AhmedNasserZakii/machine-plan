import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { FinanceKind, TransactionSource } from 'src/common/enums/finance.enum';
import { PaymentMethod } from 'src/modules/lookups/entities/payment-method.entity';
import { Media } from 'src/modules/media/entities/media.entity';
import { Branch } from 'src/modules/organization/entities/branch.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { FinanceCategory } from './finance-category.entity';
import { Supplier } from './supplier.entity';

/**
 * One pound in or out, categorised and dated.
 *
 * Rows are **never** deleted, only voided with a reason (`15`, rule 4). A ledger a mistake can be
 * erased from is not a ledger: the month would reconcile and nobody could say why it changed.
 * Voided rows drop out of every aggregate but stay readable behind a filter.
 *
 * `source ≠ MANUAL` marks a row owned by an origin record — a violation charge, a maintenance
 * close, a subscription collection. Those are immutable here and reversed by reversing their
 * origin, which is also why `(source_ref_type, source_ref_id)` carries a partial unique index:
 * it is what makes a replayed auto-posting a no-op rather than a second entry in the accounts.
 *
 * Currency is EGP throughout, with no column for it. If that ever changes it is a migration and a
 * conversation about rates, not a config flag.
 */
@Entity('finance_transactions')
@Index('idx_ft_category_id', ['categoryId'])
@Index('idx_ft_supplier_id', ['supplierId'])
@Index('idx_ft_source_ref_id', ['sourceRefId'])
export class FinanceTransaction extends BaseEntity {
  /** `EXP-2026-000512` / `INC-2026-000119` — what a person quotes on the phone. */
  @Column({ name: 'reference_no', type: 'varchar', length: 30 })
  referenceNo: string;

  @Column({ type: 'varchar', length: 10 })
  kind: FinanceKind;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  /** A date, not a timestamp: an expense belongs to a day in the books, not to a moment. */
  @Column({ name: 'transaction_date', type: 'date' })
  transactionDate: string;

  @Column({ name: 'payment_method_id', type: 'uuid' })
  paymentMethodId: string;

  /** Null means company-level rather than unknown — head-office spend belongs to no branch. */
  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string | null;

  @Column({ name: 'invoice_media_id', type: 'uuid', nullable: true })
  invoiceMediaId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 20, default: TransactionSource.MANUAL })
  source: TransactionSource;

  @Column({ name: 'source_ref_type', type: 'varchar', length: 30, nullable: true })
  sourceRefType: string | null;

  @Column({ name: 'source_ref_id', type: 'uuid', nullable: true })
  sourceRefId: string | null;

  /** Set by the offline client so a retried submit lands once (`20`). */
  @Column({ name: 'client_uuid', type: 'uuid', nullable: true })
  clientUuid: string | null;

  @Column({ name: 'is_voided', type: 'boolean', default: false })
  isVoided: boolean;

  @Column({ name: 'voided_by_user_id', type: 'uuid', nullable: true })
  voidedByUserId: string | null;

  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt: Date | null;

  @Column({ name: 'void_reason', type: 'text', nullable: true })
  voidReason: string | null;

  @ManyToOne(() => FinanceCategory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: FinanceCategory;

  @ManyToOne(() => PaymentMethod, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod: PaymentMethod;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier | null;

  @ManyToOne(() => Media, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invoice_media_id' })
  invoiceMedia: Media | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'voided_by_user_id' })
  voidedBy: User | null;
}
