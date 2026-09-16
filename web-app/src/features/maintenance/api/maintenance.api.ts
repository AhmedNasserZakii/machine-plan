import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import type { ListMeta } from '@/lib/api/pagination';
import type { QueryParams } from '@/lib/api/query';

import type {
  CancelMaintenanceOrderDto,
  CloseMaintenanceOrderDto,
  CreateMaintenanceOrderDto,
  Decommission,
  DecommissionCandidate,
  DecommissionMachineDto,
  DecommissionsListParams,
  MachineReplacedResponse,
  MaintenanceListParams,
  MaintenanceOrder,
  MaintenanceOrderListItem,
  ReceiveMaintenanceOrderDto,
  ReplacementMachineDto,
  ReplacementResponse,
  ReplacementsListParams,
  RevertDecommissionDto,
  SendMaintenanceOrderDto,
  UpdateMaintenanceOrderDto,
} from '../model';

function listQuery(params: MaintenanceListParams): QueryParams {
  const status = params.status;
  return {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    machineId: params.machineId,
    locationId: params.locationId,
    responsibleParty: params.responsibleParty,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    isFreeUnderWarranty: params.isFreeUnderWarranty,
    branchId: params.branchId,
    status: Array.isArray(status) ? status : status ? [status] : undefined,
  };
}

export const maintenanceApi = {
  list(params: MaintenanceListParams = {}) {
    return api.get<MaintenanceOrderListItem[], ListMeta>(
      endpoints.maintenance.list,
      listQuery(params),
    );
  },

  get(id: string) {
    return api.get<MaintenanceOrder>(endpoints.maintenance.byId(id));
  },

  create(body: CreateMaintenanceOrderDto, idempotencyKey: string) {
    return api.post<MaintenanceOrder>(endpoints.maintenance.list, body, idempotencyKey);
  },

  update(id: string, body: UpdateMaintenanceOrderDto, idempotencyKey: string) {
    return api.patch<MaintenanceOrder>(endpoints.maintenance.byId(id), body, idempotencyKey);
  },

  send(id: string, body: SendMaintenanceOrderDto, idempotencyKey: string) {
    return api.post<MaintenanceOrder>(endpoints.maintenance.send(id), body, idempotencyKey);
  },

  receive(id: string, body: ReceiveMaintenanceOrderDto, idempotencyKey: string) {
    return api.post<MaintenanceOrder>(endpoints.maintenance.receive(id), body, idempotencyKey);
  },

  close(id: string, body: CloseMaintenanceOrderDto, idempotencyKey: string) {
    return api.post<MaintenanceOrder>(endpoints.maintenance.close(id), body, idempotencyKey);
  },

  cancel(id: string, body: CancelMaintenanceOrderDto, idempotencyKey: string) {
    return api.post<MaintenanceOrder>(endpoints.maintenance.cancel(id), body, idempotencyKey);
  },

  replacements(params: ReplacementsListParams = {}) {
    return api.get<ReplacementResponse[], ListMeta>(endpoints.replacements.list, params);
  },

  replace(machineId: string, body: ReplacementMachineDto, idempotencyKey: string) {
    return api.post<MachineReplacedResponse>(
      endpoints.machines.replace(machineId),
      body,
      idempotencyKey,
    );
  },

  decommissionCandidates(params?: { page?: number; limit?: number }) {
    return api.get<DecommissionCandidate[], ListMeta>(
      endpoints.machines.decommissionCandidates,
      params,
    );
  },

  decommissions(params: DecommissionsListParams = {}) {
    return api.get<Decommission[], ListMeta>(endpoints.decommissions.list, params);
  },

  decommission(machineId: string, body: DecommissionMachineDto, idempotencyKey: string) {
    return api.post<Decommission>(
      endpoints.machines.decommission(machineId),
      body,
      idempotencyKey,
    );
  },

  revertDecommission(machineId: string, body: RevertDecommissionDto, idempotencyKey: string) {
    return api.post<Decommission>(
      endpoints.machines.decommissionRevert(machineId),
      body,
      idempotencyKey,
    );
  },
};
