import type { MachinesListParams } from '../model';

export const machineKeys = {
  all: ['machines'] as const,
  lists: () => [...machineKeys.all, 'list'] as const,
  list: (params: MachinesListParams) => [...machineKeys.lists(), params] as const,
  details: () => [...machineKeys.all, 'detail'] as const,
  detail: (id: string) => [...machineKeys.details(), id] as const,
  timeline: (id: string) => [...machineKeys.detail(id), 'timeline'] as const,
  costs: (id: string) => [...machineKeys.detail(id), 'costs'] as const,
  maintenance: (id: string, params?: { page?: number; limit?: number }) =>
    [...machineKeys.detail(id), 'maintenance', params ?? {}] as const,
  chain: (id: string) => [...machineKeys.detail(id), 'chain'] as const,
  lookup: (q: string) => [...machineKeys.all, 'lookup', q] as const,
  bySerial: (serial: string) => [...machineKeys.all, 'by-serial', serial] as const,
};

export const catalogueKeys = {
  all: ['catalogue'] as const,
  types: (params?: Record<string, unknown>) => [...catalogueKeys.all, 'types', params ?? {}] as const,
  models: (params?: Record<string, unknown>) =>
    [...catalogueKeys.all, 'models', params ?? {}] as const,
};
