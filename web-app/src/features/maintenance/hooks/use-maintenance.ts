'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useIdempotentMutation } from '@/lib/query/use-idempotent-mutation';

import { maintenanceApi } from '../api/maintenance.api';
import type {
  CancelMaintenanceOrderDto,
  CloseMaintenanceOrderDto,
  CreateMaintenanceOrderDto,
  DecommissionMachineDto,
  DecommissionsListParams,
  MaintenanceListParams,
  ReceiveMaintenanceOrderDto,
  ReplacementMachineDto,
  ReplacementsListParams,
  RevertDecommissionDto,
  SendMaintenanceOrderDto,
} from '../model';
import {
  dashboardKeys,
  decommissionKeys,
  financeKeys,
  machineKeys,
  maintenanceKeys,
  replacementKeys,
  transferKeys,
} from './keys';

async function invalidateMaintenance(
  qc: ReturnType<typeof useQueryClient>,
  id?: string,
) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: maintenanceKeys.all }),
    qc.invalidateQueries({ queryKey: machineKeys.all }),
    qc.invalidateQueries({ queryKey: transferKeys.all }),
    qc.invalidateQueries({ queryKey: dashboardKeys.all }),
    id ? qc.invalidateQueries({ queryKey: maintenanceKeys.detail(id) }) : Promise.resolve(),
  ]);
}

export function useMaintenanceList(params: MaintenanceListParams, enabled = true) {
  return useQuery({
    queryKey: maintenanceKeys.list(params),
    queryFn: async () => maintenanceApi.list(params),
    enabled,
  });
}

export function useMaintenanceDetail(id: string) {
  return useQuery({
    queryKey: maintenanceKeys.detail(id),
    queryFn: async () => {
      const result = await maintenanceApi.get(id);
      return result.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateMaintenanceMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: CreateMaintenanceOrderDto, key: string) => {
      const result = await maintenanceApi.create(body, key);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateMaintenance(qc);
    },
  });
}

export function useSendMaintenanceMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: SendMaintenanceOrderDto, key: string) => {
      const result = await maintenanceApi.send(id, body, key);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateMaintenance(qc, id);
    },
  });
}

export function useReceiveMaintenanceMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: ReceiveMaintenanceOrderDto, key: string) => {
      const result = await maintenanceApi.receive(id, body, key);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateMaintenance(qc, id);
    },
  });
}

export function useCloseMaintenanceMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: CloseMaintenanceOrderDto, key: string) => {
      const result = await maintenanceApi.close(id, body, key);
      return result.data;
    },
    onSuccess: async () => {
      await Promise.all([
        invalidateMaintenance(qc, id),
        qc.invalidateQueries({ queryKey: financeKeys.all }),
        qc.invalidateQueries({ queryKey: replacementKeys.all }),
      ]);
    },
  });
}

export function useCancelMaintenanceMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: CancelMaintenanceOrderDto, key: string) => {
      const result = await maintenanceApi.cancel(id, body, key);
      return result.data;
    },
    onSuccess: async () => {
      await invalidateMaintenance(qc, id);
    },
  });
}

export function useReplacementsList(params: ReplacementsListParams) {
  return useQuery({
    queryKey: replacementKeys.list(params),
    queryFn: async () => maintenanceApi.replacements(params),
  });
}

export function useReplaceMachineMutation(machineId: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: ReplacementMachineDto, key: string) => {
      const result = await maintenanceApi.replace(machineId, body, key);
      return result.data;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: machineKeys.all }),
        qc.invalidateQueries({ queryKey: replacementKeys.all }),
        qc.invalidateQueries({ queryKey: maintenanceKeys.all }),
        qc.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]);
    },
  });
}

export function useDecommissionCandidates(
  params?: { page?: number; limit?: number },
  enabled = true,
) {
  return useQuery({
    queryKey: decommissionKeys.candidates(params),
    queryFn: async () => maintenanceApi.decommissionCandidates(params),
    enabled,
  });
}

export function useDecommissionsList(params: DecommissionsListParams) {
  return useQuery({
    queryKey: decommissionKeys.list(params),
    queryFn: async () => maintenanceApi.decommissions(params),
  });
}

export function useDecommissionMachineMutation(machineId: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: DecommissionMachineDto, key: string) => {
      const result = await maintenanceApi.decommission(machineId, body, key);
      return result.data;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: machineKeys.all }),
        qc.invalidateQueries({ queryKey: decommissionKeys.all }),
        qc.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]);
    },
  });
}

export function useRevertDecommissionMutation(machineId: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: RevertDecommissionDto, key: string) => {
      const result = await maintenanceApi.revertDecommission(machineId, body, key);
      return result.data;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: machineKeys.all }),
        qc.invalidateQueries({ queryKey: decommissionKeys.all }),
        qc.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]);
    },
  });
}
