'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { useIdempotentMutation } from '@/lib/query/use-idempotent-mutation';

import { catalogueApi } from '../api/catalogue.api';
import { machinesApi } from '../api/machines.api';
import type { CreateMachineDto, MachineFormValues, UpdateMachineDto } from '../model';
import { catalogueKeys, machineKeys } from './query-keys';

function toCreateDto(values: MachineFormValues): CreateMachineDto {
  return {
    serial: values.serial.trim(),
    machineModelId: values.machineModelId,
    battery: { serial: values.batterySerial.trim() },
    hasBox: values.hasBox,
    ...(values.simSerial ? { simSerial: values.simSerial } : {}),
    ...(values.boxSerial ? { boxSerial: values.boxSerial } : {}),
    ...(values.purchasePrice !== undefined ? { purchasePrice: values.purchasePrice } : {}),
    ...(values.purchaseDate ? { purchaseDate: values.purchaseDate } : {}),
    ...(values.factoryInvoiceNo ? { factoryInvoiceNo: values.factoryInvoiceNo } : {}),
    ...(values.warrantyStart ? { warrantyStart: values.warrantyStart } : {}),
    ...(values.warrantyEnd ? { warrantyEnd: values.warrantyEnd } : {}),
    ...(values.notes ? { notes: values.notes } : {}),
  };
}

function toUpdateDto(values: MachineFormValues): UpdateMachineDto {
  return {
    machineModelId: values.machineModelId,
    ...(values.purchasePrice !== undefined ? { purchasePrice: values.purchasePrice } : {}),
    ...(values.purchaseDate ? { purchaseDate: values.purchaseDate } : {}),
    ...(values.factoryInvoiceNo ? { factoryInvoiceNo: values.factoryInvoiceNo } : {}),
    ...(values.warrantyStart ? { warrantyStart: values.warrantyStart } : {}),
    ...(values.warrantyEnd ? { warrantyEnd: values.warrantyEnd } : {}),
    ...(values.notes ? { notes: values.notes } : {}),
  };
}

export function useMachineTypesQuery(search?: string) {
  return useQuery({
    queryKey: catalogueKeys.types({ search, isActive: true }),
    queryFn: async () => {
      const result = await catalogueApi.types({ search, limit: 100, isActive: true });
      return result.data;
    },
    staleTime: 60_000,
  });
}

export function useMachineModelsQuery(machineTypeId?: string, options?: { requireType?: boolean }) {
  const requireType = options?.requireType ?? true;
  return useQuery({
    queryKey: catalogueKeys.models({ machineTypeId, isActive: true }),
    enabled: requireType ? Boolean(machineTypeId) : true,
    queryFn: async () => {
      const result = await catalogueApi.models({
        machineTypeId,
        limit: 200,
        isActive: true,
      });
      return result.data;
    },
    staleTime: 60_000,
  });
}

export function useCreateMachineMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (values: MachineFormValues, key: string) => {
      const result = await machinesApi.create(toCreateDto(values), key);
      return result.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: machineKeys.all });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateMachineMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (values: MachineFormValues, key: string) => {
      const result = await machinesApi.update(id, toUpdateDto(values), key);
      return result.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: machineKeys.all });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCreateMaintenanceOrderMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (
      body: { machineId: string; locationId: string; reportedFault: string; sentAt: string; notes?: string },
      key: string,
    ) => {
      const result = await api.post(endpoints.maintenance.list, body, key);
      return result.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: machineKeys.all });
      void qc.invalidateQueries({ queryKey: ['maintenance'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export { toCreateDto, toUpdateDto };
