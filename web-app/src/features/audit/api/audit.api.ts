import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import type { ListMeta } from '@/lib/api/pagination';
import type { QueryParams } from '@/lib/api/query';

import type { AuditListParams, AuditLog } from '../model';

function query(params: AuditListParams): QueryParams {
  return {
    limit: params.limit,
    cursor: params.cursor ?? undefined,
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    requestId: params.requestId,
  };
}

export const auditApi = {
  list(params: AuditListParams = {}) {
    return api.get<AuditLog[], ListMeta>(endpoints.audit.list, query(params));
  },
  byEntity(type: string, id: string, params: AuditListParams = {}) {
    return api.get<AuditLog[], ListMeta>(endpoints.audit.entity(type, id), query(params));
  },
  byUser(userId: string, params: AuditListParams = {}) {
    return api.get<AuditLog[], ListMeta>(endpoints.audit.user(userId), query(params));
  },
};
