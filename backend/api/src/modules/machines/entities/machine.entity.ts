import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { PartyType } from 'src/common/enums/transfer.enum';
import { Branch } from 'src/modules/organization/entities/branch.entity';
import { Warehouse } from 'src/modules/organization/entities/warehouse.entity';
import { MachineModel } from 'src/modules/lookups/entities/machine-model.entity';
import { MachineType } from 'src/modules/lookups/entities/machine-type.entity';
import { Battery } from './battery.entity';

/**
 * The central asset. Four serials identify one delivered unit — machine, battery, SIM and box —
 * and all four are permanent: a unit that comes back from the factory with a different SIM is a
 * *replacement*, not an edit, because the serials are what a signature was given against.
 *
 * `status` and the `current_holder_*` columns are read-only through this module. Only the transfer
 * engine, maintenance, replacement and decommission may move custody, which is why there is no
 * setter for them on the machines service.
 *
 * The unique indexes on `sim_serial` and `box_serial` are partial and live in the migration: both
 * are nullable, and two machines without a SIM must not collide.
 */
@Entity('machines')
@Index('idx_machines_status', ['status'])
@Index('idx_machines_holder', ['currentHolderType', 'currentHolderId'])
@Index('idx_machines_branch_status', ['currentBranchId', 'status'])
@Index('idx_machines_model_id', ['machineModelId'])
export class Machine extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  serial: string;

  /** SIM card printed serial (ICCID). Required when the type's `requiresSim` is true. */
  @Column({ name: 'sim_serial', type: 'varchar', length: 100, nullable: true })
  simSerial: string | null;

  /** Carton serial. Always optional — not every factory prints one. */
  @Column({ name: 'box_serial', type: 'varchar', length: 100, nullable: true })
  boxSerial: string | null;

  /** Only set when the sticker encodes something other than the serial itself. */
  @Column({ name: 'qr_payload', type: 'text', nullable: true })
  qrPayload: string | null;

  @Column({ name: 'machine_model_id', type: 'uuid' })
  machineModelId: string;

  /** Denormalized from the model so status/type filters do not need a join. */
  @Column({ name: 'machine_type_id', type: 'uuid' })
  machineTypeId: string;

  @Column({ name: 'purchase_price', type: 'numeric', precision: 14, scale: 2, nullable: true })
  purchasePrice: string | null;

  @Column({ name: 'purchase_date', type: 'date', nullable: true })
  purchaseDate: string | null;

  @Column({ name: 'factory_invoice_no', type: 'varchar', length: 80, nullable: true })
  factoryInvoiceNo: string | null;

  /** The free-maintenance window. Maintenance pre-computes cover from these two dates. */
  @Column({ name: 'warranty_start', type: 'date', nullable: true })
  warrantyStart: string | null;

  @Column({ name: 'warranty_end', type: 'date', nullable: true })
  warrantyEnd: string | null;

  @Column({ type: 'varchar', length: 40, default: MachineStatus.IN_COMPANY_WAREHOUSE })
  status: MachineStatus;

  @Column({ name: 'current_branch_id', type: 'uuid', nullable: true })
  currentBranchId: string | null;

  @Column({ name: 'current_warehouse_id', type: 'uuid', nullable: true })
  currentWarehouseId: string | null;

  @Column({ name: 'current_holder_type', type: 'varchar', length: 20, nullable: true })
  currentHolderType: PartyType | null;

  /** Polymorphic: a user id, a merchant id or a warehouse id depending on the type. */
  @Column({ name: 'current_holder_id', type: 'uuid', nullable: true })
  currentHolderId: string | null;

  /**
   * Whether the carton is physically with the machine *right now*, which is not the same
   * question as `boxSerial` — that is which carton it is. A representative can lose the box
   * without the machine's identity changing.
   */
  @Column({ name: 'has_box', type: 'boolean', default: false })
  hasBox: boolean;

  @Column({ name: 'total_repair_cost', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalRepairCost: string;

  @Column({ name: 'repair_count', type: 'int', default: 0 })
  repairCount: number;

  @Column({ name: 'replaced_by_machine_id', type: 'uuid', nullable: true })
  replacedByMachineId: string | null;

  @Column({ name: 'replaces_machine_id', type: 'uuid', nullable: true })
  replacesMachineId: string | null;

  @Column({ name: 'decommissioned_at', type: 'timestamptz', nullable: true })
  decommissionedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => MachineModel, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'machine_model_id' })
  machineModel: MachineModel;

  @ManyToOne(() => MachineType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'machine_type_id' })
  machineType: MachineType;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'current_branch_id' })
  currentBranch: Branch | null;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'current_warehouse_id' })
  currentWarehouse: Warehouse | null;

  @OneToOne(() => Battery, (battery) => battery.machine)
  battery: Battery;
}
