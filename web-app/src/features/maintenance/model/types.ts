import type { Schema } from '@/lib/api/types';

export type MaintenanceOrderListItem = Schema<'MaintenanceOrderListItemResponse'>;
export type MaintenanceOrder = Schema<'MaintenanceOrderResponse'>;
export type CreateMaintenanceOrderDto = Schema<'CreateMaintenanceOrderDto'>;
export type UpdateMaintenanceOrderDto = Schema<'UpdateMaintenanceOrderDto'>;
export type SendMaintenanceOrderDto = Schema<'SendMaintenanceOrderDto'>;
export type ReceiveMaintenanceOrderDto = Schema<'ReceiveMaintenanceOrderDto'>;
export type CloseMaintenanceOrderDto = Schema<'CloseMaintenanceOrderDto'>;
export type CancelMaintenanceOrderDto = Schema<'CancelMaintenanceOrderDto'>;
export type ReplacementMachineDto = Schema<'ReplacementMachineDto'>;
export type MachineReplacedResponse = Schema<'MachineReplacedResponse'>;
export type ReplacementResponse = Schema<'ReplacementResponse'>;
export type DecommissionCandidate = Schema<'DecommissionCandidateResponse'>;
export type Decommission = Schema<'DecommissionResponse'>;
export type DecommissionMachineDto = Schema<'DecommissionMachineDto'>;
export type RevertDecommissionDto = Schema<'RevertDecommissionDto'>;
export type ReplacementChain = Schema<'ReplacementChainResponse'>;

export type MaintenanceStatus = MaintenanceOrder['status'];
export type MaintenanceResult = NonNullable<MaintenanceOrder['result']>;
export type ResponsibleParty = NonNullable<MaintenanceOrder['responsibleParty']>;

export type MaintenanceListParams = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  machineId?: string;
  status?: string | string[];
  locationId?: string;
  responsibleParty?: ResponsibleParty;
  dateFrom?: string;
  dateTo?: string;
  isFreeUnderWarranty?: boolean;
  branchId?: string;
};

export type ReplacementsListParams = {
  page?: number;
  limit?: number;
  sortDir?: 'asc' | 'desc';
  machineId?: string;
  maintenanceOrderId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type DecommissionsListParams = {
  page?: number;
  limit?: number;
  sortDir?: 'asc' | 'desc';
  sortBy?: string;
  machineId?: string;
};

export const MAINTENANCE_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'RETURNED',
  'CLOSED',
  'CANCELLED',
] as const satisfies readonly MaintenanceStatus[];

export const MAINTENANCE_STEPPER: MaintenanceStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'RETURNED',
  'CLOSED',
];

export const MAINTENANCE_RESULTS = ['REPAIRED', 'REPLACED', 'UNREPAIRABLE'] as const;
export const RESPONSIBLE_PARTIES = ['COMPANY', 'REPRESENTATIVE', 'MERCHANT', 'FACTORY'] as const;
