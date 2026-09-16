export const orgKeys = {
  all: ['organization'] as const,
  branches: () => [...orgKeys.all, 'branches'] as const,
  branchesList: (params: object = {}) => [...orgKeys.branches(), 'list', params] as const,
  branch: (id: string) => [...orgKeys.branches(), 'detail', id] as const,
  branchSummary: (id: string) => [...orgKeys.branch(id), 'summary'] as const,
  warehouses: () => [...orgKeys.all, 'warehouses'] as const,
  warehousesList: (params: object = {}) => [...orgKeys.warehouses(), 'list', params] as const,
  lookups: () => [...orgKeys.all, 'lookups'] as const,
  lookup: (tab: string) => [...orgKeys.lookups(), tab] as const,
  sync: () => [...orgKeys.all, 'sync'] as const,
};
