import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { FinanceKind } from 'src/common/enums/finance.enum';
import { FinanceCategoryTranslation } from './finance-category-translation.entity';

/**
 * One node in the expense/income tree, nested as deeply as the accountant wants (`14`).
 *
 * The tree is stored as an LTREE materialized path rather than walked through `parent_id`, so a
 * roll-up at any depth is one indexed `path <@ :ancestor` probe instead of a recursive query per
 * report row. `parent_id` is kept alongside it for direct-children reads and referential
 * integrity — the path is a derived fact and would be unrecoverable if the parent link were not
 * also written down.
 *
 * `kind` is inherited from the parent and immutable: a subcategory of an expense is an expense,
 * and re-typing a node after transactions are booked under it would silently flip their sign in
 * every historical report.
 */
@Entity('finance_categories')
@Index('idx_finance_categories_parent', ['parentId'])
@Index('idx_finance_categories_kind', ['kind'])
export class FinanceCategory extends BaseEntity {
  /** Present only on the seeded system rows — the codes other modules post against. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  code: string | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  /**
   * Dot-separated ids with the hyphens stripped, root first. Hyphens are removed because an
   * LTREE label admits only alphanumerics and underscores, which a raw UUID is not.
   */
  @Column({ type: 'varchar' })
  path: string;

  /** `nlevel(path) - 1`, stored so a whole tree can be ordered without recursing. */
  @Column({ type: 'int' })
  depth: number;

  @Column({ type: 'varchar', length: 10 })
  kind: FinanceKind;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;

  /** Hides the node from pickers while leaving every booked transaction and report intact. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => FinanceCategory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parent_id' })
  parent: FinanceCategory | null;

  @OneToMany(() => FinanceCategoryTranslation, (translation) => translation.category, {
    cascade: ['insert', 'update'],
  })
  translations: FinanceCategoryTranslation[];
}
