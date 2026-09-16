import type { Schema } from '@/lib/api/types';

export type MachineListItem = Schema<'MachineListItemResponse'>;
export type Machine = Schema<'MachineResponse'>;
export type MachineLookup = Schema<'MachineLookupResponse'>;
export type MachineTimelineEvent = Schema<'MachineTimelineEventResponse'>;
export type MachineCostSummary = Schema<'MachineCostSummaryResponse'>;
export type ReplacementChain = Schema<'ReplacementChainResponse'>;
export type MaintenanceHistory = Schema<'MaintenanceHistoryResponse'>;
export type CreateMachineDto = Schema<'CreateMachineDto'>;
export type UpdateMachineDto = Schema<'UpdateMachineDto'>;
export type BulkCreateMachinesDto = Schema<'BulkCreateMachinesDto'>;
export type BulkCreateMachinesResponse = Schema<'BulkCreateMachinesResponse'>;
export type MachineType = Schema<'MachineTypeResponse'>;
export type MachineModel = Schema<'MachineModelResponse'>;
export type CreateMaintenanceOrderDto = Schema<'CreateMaintenanceOrderDto'>;
export type MaintenanceOrder = Schema<'MaintenanceOrderResponse'>;
export type ReportJob = Schema<'ReportJobResponse'>;

export type MachineStatus = MachineListItem['status'];
export type HolderType = NonNullable<MachineListItem['holder']>['type'];
export type MatchedOn = MachineLookup['matchedOn'];

export type MachinesListParams = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  status?: string | string[];
  machineTypeId?: string;
  machineModelId?: string;
  branchId?: string;
  holderType?: string;
  holderId?: string;
  warrantyExpiringBefore?: string;
  minRepairCost?: number;
  includeRetired?: boolean;
};
