import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { WarehouseType } from 'src/common/enums/operations.enum';
import { Branch } from './branch.entity';

/**
 * Physical storage locations. The cardinality rules from
 * `06-feature-branches-warehouses.md` are enforced by partial unique indexes created in the
 * migration, because they are conditional and cannot be expressed as plain column uniqueness:
 *
 * - exactly one `COMPANY_MAIN`
 * - exactly one `SCRAP`
 * - at most one `BRANCH` warehouse per branch
 * - `MAINTENANCE` is optional and unconstrained
 *
 * Enforcing this in the database rather than the service means a race between two concurrent
 * creates still cannot produce a second company warehouse.
 */
@Entity('warehouses')
@Index('idx_warehouses_branch_id', ['branchId'])
@Index('idx_warehouses_type', ['type'])
export class Warehouse extends BaseEntity {
  /** NULL for the company-level warehouses (`COMPANY_MAIN`, `SCRAP`, `MAINTENANCE`). */
  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', length: 30 })
  type: WarehouseType;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => Branch, (branch) => branch.warehouses, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;
}
