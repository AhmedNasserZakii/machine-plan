import type { MerchantsListParams } from '../model';

export const merchantKeys = {
  all: ['merchants'] as const,
  lists: () => [...merchantKeys.all, 'list'] as const,
  list: (params: MerchantsListParams) => [...merchantKeys.lists(), params] as const,
  details: () => [...merchantKeys.all, 'detail'] as const,
  detail: (id: string) => [...merchantKeys.details(), id] as const,
  machines: (id: string, params?: { page?: number; limit?: number }) =>
    [...merchantKeys.detail(id), 'machines', params ?? {}] as const,
  subscriptions: (id: string) => [...merchantKeys.detail(id), 'subscriptions'] as const,
  timeline: (id: string) => [...merchantKeys.detail(id), 'timeline'] as const,
};

export const financeKeys = {
  all: ['finance'] as const,
};

export const transferKeys = {
  all: ['transfers'] as const,
};

export const dashboardKeys = {
  all: ['dashboard'] as const,
};
