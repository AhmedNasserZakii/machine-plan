import { AuditAction, AuditEntityType } from '../enums/audit.enum';

/**
 * What a caller passes to `AuditService.record()`. `before`/`after` are full entity snapshots,
 * not pre-computed diffs — `record()` reduces them to changed keys and redacts them itself
 * (`21`, `2.2`), so a call site never has to remember to do either.
 *
 * `requestId`/`ipAddress`/`userAgent` are optional here on purpose: within a request they are
 * filled in automatically from `AuditInterceptor`'s ambient context (`audit-context.ts`), so
 * ordinary call sites only ever need the five business fields. Passing them explicitly is for the
 * rare caller that runs outside a request (a cron job, a queue consumer) and still wants them
 * recorded.
 */
export interface AuditRecordInput {
  userId: string | null;
  action: AuditAction;
  entityType?: AuditEntityType | null;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** The fully-resolved row handed to the queue and, from there, to the database. */
export interface AuditRecordRow {
  id: string;
  createdAt: string;
  userId: string | null;
  action: AuditAction;
  entityType: AuditEntityType | null;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}
