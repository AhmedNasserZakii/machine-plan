import type { Schema } from '@/lib/api/types';

export type Branch = Schema<'BranchResponse'>;
export type BranchSummary = Schema<'BranchSummaryResponse'>;
export type CreateBranchDto = Schema<'CreateBranchDto'>;
export type UpdateBranchDto = Schema<'UpdateBranchDto'>;
export type Warehouse = Schema<'WarehouseResponse'>;
export type CreateWarehouseDto = Schema<'CreateWarehouseDto'>;
export type LookupItem = Schema<'LookupResponse'>;
export type MachineType = Schema<'MachineTypeResponse'>;
export type MachineModel = Schema<'MachineModelResponse'>;
export type ViolationType = Schema<'ViolationTypeResponse'>;
export type Supplier = Schema<'SupplierResponse'>;
export type SyncStatus = Schema<'SyncStatusResponse'>;
export type CreateNameLookupDto = Schema<'CreateNameLookupDto'>;
export type UpdateNameLookupDto = Schema<'UpdateNameLookupDto'>;
export type CreateMachineTypeDto = Schema<'CreateMachineTypeDto'>;
export type UpdateMachineTypeDto = Schema<'UpdateMachineTypeDto'>;
export type CreateViolationTypeDto = Schema<'CreateViolationTypeDto'>;
export type UpdateViolationTypeDto = Schema<'UpdateViolationTypeDto'>;
export type CreateSupplierDto = Schema<'CreateSupplierDto'>;

export type LookupTab =
  | 'types'
  | 'models'
  | 'suppliers'
  | 'payment-methods'
  | 'maintenance-locations'
  | 'violation-types'
  | 'decommission-reasons';

export type WarehouseKind = Warehouse['type'];
