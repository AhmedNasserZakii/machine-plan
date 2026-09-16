import type { AuditListParams } from '../model';

export const auditKeys = {
  all: ['audit'] as const,
  lists: () => [...auditKeys.all, 'list'] as const,
  list: (params: AuditListParams) => [...auditKeys.lists(), params] as const,
  entity: (type: string, id: string, params: AuditListParams = {}) =>
    [...auditKeys.all, 'entity', type, id, params] as const,
  user: (userId: string, params: AuditListParams = {}) =>
    [...auditKeys.all, 'user', userId, params] as const,
};
