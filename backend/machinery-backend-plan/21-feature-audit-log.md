# 21 — Feature: Audit Log

## Goal

Every meaningful change is attributable: who did it, when, from which device, what the values were
before and after. With signatures, violations and money in the system, this is not optional.

## What gets audited

**Always:**
- any create/update/delete on machines, batteries, merchants, users, roles, permissions, branches
- every transfer creation, confirmation, rejection, cancellation
- every signature captured
- every maintenance order state change and cost entry
- every replacement and decommission (and any revert)
- every finance transaction create/update/void
- every budget create/update/delete
- every violation create/charge/waive
- login success, login failure, password change, permission change

**Never:** read operations (too noisy). Exception: reading finance data is logged at a summary level
because access to money data is itself sensitive — one row per `finance.*` read endpoint hit, no
payload.

## Implementation

A global `AuditInterceptor` plus an explicit `AuditService.record()` for cases where the interceptor
cannot know the semantic action.

```ts
await this.auditService.record({
  userId: user.id,
  action: 'TRANSFER_CONFIRMED',
  entityType: 'transfer',
  entityId: transfer.id,
  before: { status: 'PENDING' },
  after:  { status: 'CONFIRMED', confirmedBy: user.id },
  requestId: req.id,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});
```

Audit writes are **fire-and-forget through a BullMQ queue** so they never slow down or fail a
business transaction. The queue is durable; a lost audit entry is a bug, but a failed business
operation because of audit is worse.

## Diffing

For updates, store only the changed keys, not the whole entity:

```json
{
  "before": { "cost": 0, "status": "RETURNED" },
  "after":  { "cost": 450.00, "status": "CLOSED" }
}
```

**Redaction:** never store `password_hash`, tokens, or full national IDs. A `REDACTED_FIELDS`
constant list is applied before writing.

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/audit-logs` | `audit.read` |
| GET | `/audit-logs/entity/:type/:id` | `audit.read` |
| GET | `/audit-logs/user/:userId` | `audit.read` |

Filters: `userId`, `action`, `entityType`, `entityId`, `dateFrom`, `dateTo`, `requestId`.
Keyset pagination only — this table gets large.

`GET /audit-logs/entity/machine/:id` is the "who touched this machine" view that supports any
dispute about custody or condition.

## Retention & volume

- Estimated volume: ~1,000 machines × a few events per month + finance rows ≈ tens of thousands of
  rows per year. Small, but it only grows.
- Partition `audit_logs` by month (`PARTITION BY RANGE (created_at)`) from day one — retrofitting
  partitioning later is painful.
- Retain 5 years online, then archive to cold storage. Never delete audit rows for an entity that
  still exists.

```sql
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_user   ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs (action, created_at DESC);
```

## Tamper resistance

Audit rows are insert-only. Revoke `UPDATE` and `DELETE` on `audit_logs` from the application
database role:

```sql
REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
```

This is a five-second change that makes the log meaningfully trustworthy.
