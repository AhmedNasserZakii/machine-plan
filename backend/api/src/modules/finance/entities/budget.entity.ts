import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { BudgetPeriodType } from 'src/common/enums/finance.enum';
import { Branch } from 'src/modules/organization/entities/branch.entity';
import { FinanceCategory } from './finance-category.entity';

/**
 * An optional spending limit on one expense category for one period (`16`).
 *
 * Optional is the operative word: nothing in the finance module needs a budget to work, and a
 * parent-category budget and a child-category budget may both exist and are evaluated
 * independently — which is deliberate, because "the whole of operations" and "spare parts
 * specifically" are two different questions an accountant asks at once.
 */
@Entity('budgets')
@Index('idx_budgets_category_id', ['categoryId'])
@Index('idx_budgets_branch_id', ['branchId'])
export class Budget extends BaseEntity {
  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  /** Null means company-wide rather than unassigned. */
  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @Column({ name: 'period_type', type: 'varchar', length: 10 })
  periodType: BudgetPeriodType;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  @Column({ name: 'alert_threshold_percent', type: 'int', default: 80 })
  alertThresholdPercent: number;

  /** True measures the budget against the rolled-up subtree, which is what people expect. */
  @Column({ name: 'include_subcategories', type: 'boolean', default: true })
  includeSubcategories: boolean;

  @Column({ name: 'auto_renew', type: 'boolean', default: false })
  autoRenew: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /**
   * The highest level already announced for this period. Escalation is compared against it so a
   * Director hears once when a budget reaches 80% and once when it is blown, rather than on every
   * transaction booked after the threshold — which is the difference between an alert and noise.
   */
  @Column({ name: 'last_alert_level', type: 'varchar', length: 10, nullable: true })
  lastAlertLevel: string | null;

  @Column({ name: 'last_alert_at', type: 'timestamptz', nullable: true })
  lastAlertAt: Date | null;

  @ManyToOne(() => FinanceCategory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: FinanceCategory;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;
}
