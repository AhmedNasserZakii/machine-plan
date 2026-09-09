import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';

/**
 * Who an expense was paid to. Deliberately thin: the business asked for a name it can pick again
 * next month, not a procurement record, and a supplier is optional on every transaction (`15`).
 *
 * Not localized — a supplier's name is entered once, as it is written on the invoice (`02`).
 */
@Entity('suppliers')
@Index('idx_suppliers_name', ['name'])
export class Supplier extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
