import type { CustodyParams, UsersListParams } from '../model';

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params: UsersListParams) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  permissions: (id: string) => [...userKeys.detail(id), 'permissions'] as const,
  custody: (id: string, params: CustodyParams = {}) =>
    [...userKeys.detail(id), 'custody', params] as const,
  catalogue: () => [...userKeys.all, 'permissions-catalogue'] as const,
  roles: () => [...userKeys.all, 'roles-options'] as const,
  branches: () => [...userKeys.all, 'branches-options'] as const,
};

export const roleKeys = {
  all: ['roles'] as const,
};

export const sessionKeys = {
  all: ['session'] as const,
};
