import type {
  DecommissionsListParams,
  MaintenanceListParams,
  ReplacementsListParams,
} from '../model';

export const maintenanceKeys = {
  all: ['maintenance'] as const,
  lists: () => [...maintenanceKeys.all, 'list'] as const,
  list: (params: MaintenanceListParams) => [...maintenanceKeys.lists(), params] as const,
  details: () => [...maintenanceKeys.all, 'detail'] as const,
  detail: (id: string) => [...maintenanceKeys.details(), id] as const,
};

export const replacementKeys = {
  all: ['replacements'] as const,
  lists: () => [...replacementKeys.all, 'list'] as const,
  list: (params: ReplacementsListParams) => [...replacementKeys.lists(), params] as const,
};

export const decommissionKeys = {
  all: ['decommissions'] as const,
  lists: () => [...decommissionKeys.all, 'list'] as const,
  list: (params: DecommissionsListParams) => [...decommissionKeys.lists(), params] as const,
  candidates: (params?: { page?: number; limit?: number }) =>
    [...decommissionKeys.all, 'candidates', params ?? {}] as const,
};

export const financeKeys = {
  all: ['finance'] as const,
};

export const machineKeys = {
  all: ['machines'] as const,
};

export const transferKeys = {
  all: ['transfers'] as const,
};

export const dashboardKeys = {
  all: ['dashboard'] as const,
};
