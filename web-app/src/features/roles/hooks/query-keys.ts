export const roleKeys = {
  all: ['roles'] as const,
  lists: () => [...roleKeys.all, 'list'] as const,
  list: () => [...roleKeys.lists()] as const,
  details: () => [...roleKeys.all, 'detail'] as const,
  detail: (id: string) => [...roleKeys.details(), id] as const,
  catalogue: () => [...roleKeys.all, 'catalogue'] as const,
};

export const userKeys = {
  all: ['users'] as const,
};

export const sessionKeys = {
  all: ['session'] as const,
};
