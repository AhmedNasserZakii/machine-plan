import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { Warehouse } from './warehouse.entity';

/**
 * Machines belong to a branch. Note that `name` is **operational data and deliberately not
 * localized** (`06-feature-branches-warehouses.md` rule 4) — a branch is called
 * "فرع الإسكندرية" regardless of the reader's locale, so it has no translation table.
 */
@Entity('branches')
@Index('uq_branches_code', ['code'], { unique: true })
export class Branch extends BaseEntity {
  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Warehouse, (warehouse) => warehouse.branch)
  warehouses: Warehouse[];
}
