# 22 — API Conventions & Error Handling

## Base

```
https://api.<domain>/api/v1
```

Headers on every request:

| Header | Required | Notes |
|---|---|---|
| `Authorization: Bearer <accessToken>` | yes (except `@Public()`) | |
| `Accept-Language: ar \| en` | no | defaults to `ar` |
| `Idempotency-Key: <uuid>` | on all mutations | see `20` |
| `X-Client-Version` | recommended | enables forced-upgrade responses |
| `X-Device-Id` | on mobile | ties signatures and push tokens to a device |

## Success envelope

```json
{ "success": true, "data": { }, "meta": { } }
```

`meta` for paginated responses:
```json
{ "page": 1, "limit": 20, "total": 143, "totalPages": 8, "hasNext": true }
```

Keyset pagination instead returns:
```json
{ "limit": 50, "nextCursor": "eyJpZCI6…", "hasNext": true }
```

## Error envelope

```json
{
  "success": false,
  "error": {
    "code": "MACHINE_ALREADY_IN_TRANSIT",
    "message": "الماكينة SN-00341 مرتبطة بعملية تسليم قيد الانتظار",
    "details": [ { "field": "items[0].machineId", "value": "…", "constraint": "…" } ],
    "requestId": "01J…",
    "timestamp": "2026-09-07T12:00:00Z"
  }
}
```

Rules:
- `code` is a stable, machine-readable `SCREAMING_SNAKE` string. The Flutter app switches on it.
  **Never** change a code's meaning; add a new one.
- `message` is localized to the request locale, meant for humans.
- `details` is only populated for validation errors.
- `requestId` matches the logged request id — support can find the exact log line.

## HTTP status usage

| Status | When |
|---|---|
| 200 | successful read or update |
| 201 | resource created |
| 202 | accepted, processing async (report exports) |
| 400 | malformed request / validation failure |
| 401 | missing or invalid token |
| 403 | authenticated but lacks permission or branch scope |
| 404 | entity does not exist, or exists outside the caller's scope (do not leak existence) |
| 409 | conflict with current state (duplicate serial, already confirmed, has custody) |
| 422 | semantically invalid business operation (wrong status transition, kind mismatch) |
| 429 | rate limited |
| 500 | unexpected — never leak stack traces |

> The 409 / 422 split matters: **409** = "this collides with something that exists",
> **422** = "this operation is not legal right now". The mobile app treats them differently —
> 409 often means refresh and retry, 422 means the user must change something.

## Canonical error codes

```
# auth
INVALID_CREDENTIALS, ACCOUNT_INACTIVE, ACCOUNT_LOCKED, TOKEN_EXPIRED,
TOKEN_REVOKED, PASSWORD_CHANGE_REQUIRED, INSUFFICIENT_PERMISSIONS, BRANCH_SCOPE_VIOLATION

# machines
SERIAL_EXISTS, BATTERY_SERIAL_EXISTS, SIM_SERIAL_EXISTS, BOX_SERIAL_EXISTS,
SERIAL_IMMUTABLE, MACHINE_NOT_FOUND, MACHINE_RETIRED, MACHINE_ALREADY_REPLACED

# transfers
INVALID_MACHINE_STATUS, NOT_IN_YOUR_CUSTODY, MACHINE_ALREADY_IN_TRANSIT,
TRANSFER_NOT_PENDING, PAYLOAD_CHANGED, INVALID_TRANSFER_TYPE,
INTER_BRANCH_DIRECT_TRANSFER_NOT_ALLOWED, SIGNATURE_REQUIRED, CANCEL_WINDOW_EXPIRED

# maintenance
MACHINE_ALREADY_IN_MAINTENANCE, ORDER_ALREADY_CLOSED, COST_REQUIRED,
REPLACEMENT_PAYLOAD_REQUIRED

# decommission
MACHINE_NOT_IN_WAREHOUSE, OPEN_MAINTENANCE_ORDER, ALREADY_DECOMMISSIONED

# merchants
MERCHANT_HAS_MACHINES, DUPLICATE_NATIONAL_ID

# finance
CATEGORY_KIND_MISMATCH, CATEGORY_HAS_CHILDREN, CATEGORY_HAS_TRANSACTIONS,
CIRCULAR_CATEGORY_REFERENCE, SYSTEM_CATEGORY_PROTECTED, FUTURE_DATE_NOT_ALLOWED,
BACKDATE_LIMIT_EXCEEDED, AUTO_TRANSACTION_IMMUTABLE, TRANSACTION_ALREADY_VOIDED,
OVERLAPPING_BUDGET, BUDGET_ON_INCOME_CATEGORY

# violations
ALREADY_CHARGED, AUTO_VIOLATION_IMMUTABLE

# users
USER_HAS_CUSTODY, LAST_DIRECTOR, CANNOT_EDIT_OWN_PERMISSIONS

# sync / media
IDEMPOTENCY_KEY_REUSED, INVALID_OCCURRED_AT, SCHEMA_VERSION_MISMATCH,
TOO_MANY_PHOTOS, MEDIA_NOT_CONFIRMED, UPLOAD_TOO_LARGE
```

## Pagination defaults

`page=1`, `limit=20`, max `limit=100`. Reports and sync endpoints allow `limit=500` with keyset
cursors.

## Filtering & sorting conventions

- Arrays in query strings: repeated keys — `?status=WITH_MERCHANT&status=IN_TRANSIT`.
- Dates: ISO-8601 date (`2026-09-07`) for date fields, full ISO datetime for timestamps.
- `sortBy=field&sortDir=asc|desc`. Whitelist sortable fields per endpoint — never interpolate.
- `search` performs a case-insensitive partial match over a documented field set per endpoint.

## Rate limiting

| Scope | Limit |
|---|---|
| login | 10 / 15 min per phone + IP |
| general authenticated | 300 / min per user |
| `/sync/batch` | 20 / min per user |
| `/media/presign` | 100 / min per user |
| report exports | 10 / hour per user |

Return `429` with `Retry-After`.

## Validation

Global pipe:
```ts
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: false },
})
```
`forbidNonWhitelisted` is important — it turns a client sending `branchId` on a scoped endpoint into
a loud 400 rather than a silent security hole.

## Swagger

Every DTO decorated with `@ApiProperty`. Every endpoint documents its error codes with
`@ApiResponse`. The generated spec is committed to the repo so the Flutter team can generate models
from it.

## Health & ops

| Path | Purpose |
|---|---|
| `GET /health` | liveness — always 200 if the process is up |
| `GET /health/ready` | readiness — checks DB, Redis, storage |
| `GET /metrics` | Prometheus |

## Forced upgrade

If `X-Client-Version` is below `MIN_CLIENT_VERSION`, return `426 Upgrade Required` with
`{ "error": { "code": "CLIENT_UPGRADE_REQUIRED", "minVersion": "2.1.0" } }`. The app shows a
blocking dialog. This matters because offline clients can be months out of date.
