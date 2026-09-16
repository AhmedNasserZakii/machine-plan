import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import type { ListMeta } from '@/lib/api/pagination';
import type { QueryParams } from '@/lib/api/query';

import type {
  Branch,
  BranchSummary,
  CreateBranchDto,
  CreateMachineTypeDto,
  CreateNameLookupDto,
  CreateSupplierDto,
  CreateViolationTypeDto,
  CreateWarehouseDto,
  LookupItem,
  MachineModel,
  MachineType,
  Supplier,
  SyncStatus,
  UpdateBranchDto,
  UpdateMachineTypeDto,
  UpdateNameLookupDto,
  UpdateViolationTypeDto,
  ViolationType,
  Warehouse,
} from '../model';

const raw = { rawTranslations: true } as QueryParams;

export const organizationApi = {
  branches(params: QueryParams = {}) {
    return api.get<Branch[], ListMeta>(endpoints.branches.list, params);
  },
  branch(id: string) {
    return api.get<Branch>(endpoints.branches.byId(id));
  },
  branchSummary(id: string) {
    return api.get<BranchSummary>(endpoints.branches.summary(id));
  },
  createBranch(body: CreateBranchDto, key: string) {
    return api.post<Branch>(endpoints.branches.list, body, key);
  },
  updateBranch(id: string, body: UpdateBranchDto, key: string) {
    return api.patch<Branch>(endpoints.branches.byId(id), body, key);
  },
  activateBranch(id: string, key: string) {
    return api.patch<Branch>(endpoints.branches.activate(id), {}, key);
  },
  deactivateBranch(id: string, key: string) {
    return api.patch<Branch>(endpoints.branches.deactivate(id), {}, key);
  },
  warehouses(params: QueryParams = {}) {
    return api.get<Warehouse[], ListMeta>(endpoints.warehouses.list, params);
  },
  createWarehouse(body: CreateWarehouseDto, key: string) {
    return api.post<Warehouse>(endpoints.warehouses.list, body, key);
  },
  machineTypes() {
    return api.get<MachineType[]>(endpoints.machineTypes.list, raw);
  },
  createMachineType(body: CreateMachineTypeDto, key: string) {
    return api.post<MachineType>(endpoints.machineTypes.list, body, key);
  },
  updateMachineType(id: string, body: UpdateMachineTypeDto, key: string) {
    return api.patch<MachineType>(endpoints.machineTypes.byId(id), body, key);
  },
  machineModels() {
    return api.get<MachineModel[]>(endpoints.machineModels.list, raw);
  },
  createMachineModel(body: Record<string, unknown>, key: string) {
    return api.post<MachineModel>(endpoints.machineModels.list, body, key);
  },
  updateMachineModel(id: string, body: Record<string, unknown>, key: string) {
    return api.patch<MachineModel>(endpoints.machineModels.byId(id), body, key);
  },
  paymentMethods() {
    return api.get<LookupItem[]>(endpoints.lookups.paymentMethods, raw);
  },
  createPaymentMethod(body: CreateNameLookupDto, key: string) {
    return api.post<LookupItem>(endpoints.lookups.paymentMethods, body, key);
  },
  updatePaymentMethod(id: string, body: UpdateNameLookupDto, key: string) {
    return api.patch<LookupItem>(endpoints.lookups.paymentMethod(id), body, key);
  },
  maintenanceLocations() {
    return api.get<LookupItem[]>(endpoints.lookups.maintenanceLocations, raw);
  },
  createMaintenanceLocation(body: CreateNameLookupDto, key: string) {
    return api.post<LookupItem>(endpoints.lookups.maintenanceLocations, body, key);
  },
  decommissionReasons() {
    return api.get<LookupItem[]>(endpoints.lookups.decommissionReasons, raw);
  },
  createDecommissionReason(body: CreateNameLookupDto, key: string) {
    return api.post<LookupItem>(endpoints.lookups.decommissionReasons, body, key);
  },
  violationTypes() {
    return api.get<ViolationType[]>(endpoints.lookups.violationTypes, raw);
  },
  createViolationType(body: CreateViolationTypeDto, key: string) {
    return api.post<ViolationType>(endpoints.lookups.violationTypes, body, key);
  },
  updateViolationType(id: string, body: UpdateViolationTypeDto, key: string) {
    return api.patch<ViolationType>(endpoints.lookups.violationType(id), body, key);
  },
  suppliers() {
    return api.get<Supplier[]>(endpoints.lookups.suppliers);
  },
  createSupplier(body: CreateSupplierDto, key: string) {
    return api.post<Supplier>(endpoints.lookups.suppliers, body, key);
  },
  syncStatus() {
    return api.get<SyncStatus>(endpoints.sync.status);
  },
};
