import type { ViolationsListParams } from '../api/violations.api';

export const violationKeys = {
  all: ['violations'] as const,
  lists: () => [...violationKeys.all, 'list'] as const,
  list: (params: ViolationsListParams) => [...violationKeys.lists(), params] as const,
  details: () => [...violationKeys.all, 'detail'] as const,
  detail: (id: string) => [...violationKeys.details(), id] as const,
  types: () => [...violationKeys.all, 'types'] as const,
  paymentMethods: () => [...violationKeys.all, 'payment-methods'] as const,
  forUser: (userId: string, params?: ViolationsListParams) =>
    [...violationKeys.all, 'user', userId, params ?? {}] as const,
  summaryForUser: (userId: string) =>
    [...violationKeys.all, 'user-summary', userId] as const,
};

export const userKeys = {
  all: ['users'] as const,
  detail: (id: string) => [...userKeys.all, 'detail', id] as const,
};
