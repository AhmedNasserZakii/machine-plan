'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';

import type { QueryParams } from '@/lib/api/query';
import { useIdempotentMutation } from '@/lib/query/use-idempotent-mutation';

import { organizationApi } from '../api/organization.api';
import type {
  CreateBranchDto,
  CreateMachineTypeDto,
  CreateNameLookupDto,
  CreateSupplierDto,
  CreateViolationTypeDto,
  CreateWarehouseDto,
  LookupTab,
  UpdateBranchDto,
  UpdateMachineTypeDto,
  UpdateNameLookupDto,
  UpdateViolationTypeDto,
} from '../model';
import { orgKeys } from './query-keys';

export function useBranchesList(params: QueryParams = {}) {
  return useQuery({
    queryKey: orgKeys.branchesList(params),
    queryFn: () => organizationApi.branches(params),
    placeholderData: keepPreviousData,
  });
}

export function useBranchDetail(id: string) {
  return useQuery({
    queryKey: orgKeys.branch(id),
    queryFn: async () => (await organizationApi.branch(id)).data,
    enabled: Boolean(id),
  });
}

export function useBranchSummary(id: string) {
  return useQuery({
    queryKey: orgKeys.branchSummary(id),
    queryFn: async () => (await organizationApi.branchSummary(id)).data,
    enabled: Boolean(id),
  });
}

export function useWarehousesList(params: QueryParams = {}) {
  return useQuery({
    queryKey: orgKeys.warehousesList(params),
    queryFn: () => organizationApi.warehouses(params),
    placeholderData: keepPreviousData,
  });
}

export function useLookupTab(tab: LookupTab) {
  return useQuery({
    queryKey: orgKeys.lookup(tab),
    queryFn: async () => {
      switch (tab) {
        case 'types':
          return (await organizationApi.machineTypes()).data ?? [];
        case 'models':
          return (await organizationApi.machineModels()).data ?? [];
        case 'suppliers':
          return (await organizationApi.suppliers()).data ?? [];
        case 'payment-methods':
          return (await organizationApi.paymentMethods()).data ?? [];
        case 'maintenance-locations':
          return (await organizationApi.maintenanceLocations()).data ?? [];
        case 'violation-types':
          return (await organizationApi.violationTypes()).data ?? [];
        case 'decommission-reasons':
          return (await organizationApi.decommissionReasons()).data ?? [];
      }
    },
  });
}

export function useSyncStatus() {
  return useQuery({
    queryKey: orgKeys.sync(),
    queryFn: async () => (await organizationApi.syncStatus()).data,
  });
}

export function useCreateBranchMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: CreateBranchDto, key: string) =>
      (await organizationApi.createBranch(body, key)).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: orgKeys.branches() });
    },
  });
}

export function useUpdateBranchMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: UpdateBranchDto, key: string) =>
      (await organizationApi.updateBranch(id, body, key)).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: orgKeys.branches() });
      await qc.invalidateQueries({ queryKey: orgKeys.branch(id) });
    },
  });
}

export function useActivateBranchMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (_: void, key: string) => (await organizationApi.activateBranch(id, key)).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: orgKeys.branches() });
      await qc.invalidateQueries({ queryKey: orgKeys.branch(id) });
    },
  });
}

export function useDeactivateBranchMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (_: void, key: string) => (await organizationApi.deactivateBranch(id, key)).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: orgKeys.branches() });
      await qc.invalidateQueries({ queryKey: orgKeys.branch(id) });
    },
  });
}

export function useCreateWarehouseMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: CreateWarehouseDto, key: string) =>
      (await organizationApi.createWarehouse(body, key)).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: orgKeys.warehouses() });
    },
  });
}

export function useCreateLookupMutation(tab: LookupTab) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: Record<string, unknown>, key: string) => {
      switch (tab) {
        case 'types':
          return (await organizationApi.createMachineType(body as CreateMachineTypeDto, key)).data;
        case 'models':
          return (await organizationApi.createMachineModel(body, key)).data;
        case 'suppliers':
          return (await organizationApi.createSupplier(body as CreateSupplierDto, key)).data;
        case 'payment-methods':
          return (await organizationApi.createPaymentMethod(body as CreateNameLookupDto, key)).data;
        case 'maintenance-locations':
          return (await organizationApi.createMaintenanceLocation(body as CreateNameLookupDto, key)).data;
        case 'violation-types':
          return (await organizationApi.createViolationType(body as CreateViolationTypeDto, key)).data;
        case 'decommission-reasons':
          return (await organizationApi.createDecommissionReason(body as CreateNameLookupDto, key)).data;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: orgKeys.lookup(tab) });
    },
  });
}

export function useUpdateLookupMutation(tab: LookupTab) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (vars: { id: string; body: Record<string, unknown> }, key: string) => {
      switch (tab) {
        case 'types':
          return (await organizationApi.updateMachineType(vars.id, vars.body as UpdateMachineTypeDto, key)).data;
        case 'models':
          return (await organizationApi.updateMachineModel(vars.id, vars.body, key)).data;
        case 'payment-methods':
          return (await organizationApi.updatePaymentMethod(vars.id, vars.body as UpdateNameLookupDto, key)).data;
        case 'violation-types':
          return (await organizationApi.updateViolationType(vars.id, vars.body as UpdateViolationTypeDto, key)).data;
        default:
          throw new Error('Lookup update not supported');
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: orgKeys.lookup(tab) });
    },
  });
}
