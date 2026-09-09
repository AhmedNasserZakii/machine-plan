import { AuditLog } from 'src/common/audit';
import { AuditLogResponse } from '../dto/responses/audit-log.response';

export function toAuditLogResponse(row: AuditLog): AuditLogResponse {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    userId: row.userId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    before: row.before,
    after: row.after,
    requestId: row.requestId,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
  };
}
