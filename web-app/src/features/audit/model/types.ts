import type { Schema } from '@/lib/api/types';

export type AuditLog = Schema<'AuditLogResponse'>;
export type AuditAction = AuditLog['action'];
export type AuditEntityType = NonNullable<AuditLog['entityType']>;

export type AuditListParams = {
  limit?: number;
  cursor?: string | null;
  userId?: string;
  action?: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  requestId?: string;
};
