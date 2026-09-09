import { Column } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Base for the seeded reference tables (`machine_types`, `payment_methods`, …).
 *
 * Per `02-database-localization-strategy.md` the parent table holds only non-translatable
 * data — the human-readable name lives in the sibling `*_translations` table. `code` is the
 * stable identifier that business logic and the mobile client switch on; it never changes,
 * which is what lets a row be renamed in either locale without breaking anything.
 *
 * Subclasses declare their own `@Index` on `code` so each table gets a distinctly named
 * unique constraint.
 */
export abstract class LookupEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 60 })
  code: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Drives dropdown order in the app; ties are broken by translated name. */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
