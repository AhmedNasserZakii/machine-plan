import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import type { ListMeta } from '@/lib/api/pagination';
import type { QueryParams } from '@/lib/api/query';

import type {
  BulkCreateMachinesDto,
  BulkCreateMachinesResponse,
  CreateMachineDto,
  Machine,
  MachineCostSummary,
  MachineListItem,
  MachineLookup,
  MachinesListParams,
  MachineTimelineEvent,
  MaintenanceHistory,
  ReplacementChain,
  ReportJob,
  UpdateMachineDto,
} from '../model';

function listQuery(params: MachinesListParams): QueryParams {
  const status = params.status;
  return {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    search: params.search,
    machineTypeId: params.machineTypeId,
    machineModelId: params.machineModelId,
    branchId: params.branchId,
    holderType: params.holderType,
    holderId: params.holderId,
    warrantyExpiringBefore: params.warrantyExpiringBefore,
    minRepairCost: params.minRepairCost,
    includeRetired: params.includeRetired ? true : undefined,
    status: Array.isArray(status) ? status : status ? [status] : undefined,
  };
}

export const machinesApi = {
  list(params: MachinesListParams = {}) {
    return api.get<MachineListItem[], ListMeta>(endpoints.machines.list, listQuery(params));
  },

  get(id: string) {
    return api.get<Machine>(endpoints.machines.byId(id));
  },

  bySerial(serial: string) {
    return api.get<Machine>(endpoints.machines.bySerial(serial));
  },

  lookup(q: string) {
    return api.get<MachineLookup>(endpoints.machines.lookup, { q });
  },

  create(body: CreateMachineDto, idempotencyKey: string) {
    return api.post<Machine>(endpoints.machines.list, body, idempotencyKey);
  },

  update(id: string, body: UpdateMachineDto, idempotencyKey: string) {
    return api.patch<Machine>(endpoints.machines.byId(id), body, idempotencyKey);
  },

  bulk(body: BulkCreateMachinesDto, idempotencyKey: string) {
    return api.post<BulkCreateMachinesResponse>(endpoints.machines.bulk, body, idempotencyKey);
  },

  timeline(id: string, params?: { limit?: number; cursor?: string | null }) {
    return api.get<MachineTimelineEvent[], ListMeta>(endpoints.machines.timeline(id), {
      limit: params?.limit,
      cursor: params?.cursor ?? undefined,
    });
  },

  costSummary(id: string) {
    return api.get<MachineCostSummary>(endpoints.machines.costSummary(id));
  },

  maintenanceHistory(id: string, params?: { page?: number; limit?: number }) {
    return api.get<MaintenanceHistory>(endpoints.machines.maintenanceHistory(id), params);
  },

  replacementChain(id: string) {
    return api.get<ReplacementChain>(endpoints.machines.replacementChain(id));
  },

  /** File export of the inventory report for the current filter view. */
  exportInventory(params: MachinesListParams & { format?: 'csv' | 'xlsx' }) {
    return api.get<ReportJob>(endpoints.reports.machinesInventory, {
      ...listQuery(params),
      format: params.format ?? 'csv',
    });
  },
};
