# 05 — API Client & Error Handling

> The counterpart of `mobile-app/lib/core/network_services/`. Same envelope, same error codes,
> same headers, same pagination. The only structural difference is the BFF hop (`06`).

## Base

Browser → `\`/api/bff/<path>\`` (same origin) → Next.js route handler → `${API_BASE_URL}/<path>`.

No CORS, no `API_BASE_URL` in the bundle, no refresh token in JavaScript. The `<path>` after
`/api/bff/` is **identical** to the NestJS path after `/api/v1/`, so
`endpoints.machines = 'machines'` produces `/api/bff/machines` → `…/api/v1/machines`.

## Headers on every request

Attached by the BFF handler, not by feature code:

| Header | Value |
|---|---|
| `Authorization` | `Bearer <access token from httpOnly cookie>` |
| `Accept-Language` | `ar` \| `en`, from the locale cookie |
| `X-Client-Version` | `NEXT_PUBLIC_CLIENT_VERSION` |
| `Idempotency-Key` | forwarded from the client on every mutation (see below) |
| `Content-Type` | `application/json`, except multipart uploads |

There is no `X-Device-Id` — that header ties a signature to a physical device and is mobile-only.
Web signatures are attributed by user and session; see `12`.

## `endpoints.ts`

Mirrors `WebConstant`. **No path string appears anywhere else in the codebase.**

```ts
export const endpoints = {
  auth: {
    login: 'auth/login', logout: 'auth/logout', refresh: 'auth/refresh',
    me: 'auth/me', changePassword: 'auth/change-password',
  },
  machines: {
    list: 'machines',
    byId:  (id: string) => `machines/${id}`,
    bySerial: (s: string) => `machines/by-serial/${encodeURIComponent(s)}`,
    bulk: 'machines/bulk',
    lookup: 'machines/lookup',
    timeline: (id: string) => `machines/${id}/timeline`,
    costSummary: (id: string) => `machines/${id}/cost-summary`,
    maintenanceHistory: (id: string) => `machines/${id}/maintenance-history`,
    replacementChain: (id: string) => `machines/${id}/replacement-chain`,
    replace: (id: string) => `machines/${id}/replace`,
    decommission: (id: string) => `machines/${id}/decommission`,
    decommissionRevert: (id: string) => `machines/${id}/decommission/revert`,
    decommissionCandidates: 'machines/decommission-candidates',
  },
  // …one group per module; the full list is in 22-endpoint-map.md
} as const;
```

Every path segment that interpolates user data uses `encodeURIComponent`. A serial can contain
a `/`.

## Types — generated, never written

```bash
# scripts/generate-api-types.sh
npx openapi-typescript ../backend/api/openapi.json -o src/lib/api/generated/schema.d.ts
```

```ts
// src/lib/api/types.ts
import type { paths, components } from './generated/schema';

export type Schema<K extends keyof components['schemas']> = components['schemas'][K];

/** Response body of a GET, unwrapped from the success envelope. */
export type GetData<P extends keyof paths> =
  paths[P] extends { get: { responses: { 200: { content: { 'application/json': infer R } } } } }
    ? R extends { data: infer D } ? D : R
    : never;
```

`src/lib/api/generated/` is in `.gitignore`-adjacent CI terms: it **is** committed (so a fresh
clone typechecks) but regenerating it must produce no diff. CI runs `npm run api:types` and fails
on a dirty tree — the same discipline as the backend's `check:openapi`.

Feature `model/*.types.ts` files **re-export** from the generated schema. They never redeclare a
shape. Redeclaring is how the mobile app and the backend drifted before, and it is the failure
this rule exists to prevent.

## The client

```ts
// src/lib/api/client.ts
export type ApiSuccess<T, M = unknown> = { success: true; data: T; meta?: M };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,               // SCREAMING_SNAKE, stable, switched on
    message: string,                     // localized by the server
    readonly details?: FieldError[],     // validation only
    readonly requestId?: string,
  ) { super(message); }
}

export type FieldError = { field: string; value?: unknown; constraint?: string };

export async function apiFetch<T, M = unknown>(
  path: string,
  init: RequestInit & { query?: QueryParams; idempotencyKey?: string } = {},
): Promise<ApiSuccess<T, M>>;
```

Behaviour:

1. Builds the query string with `buildQuery()` (below).
2. Adds `Idempotency-Key` when `init.method` is not `GET`/`HEAD`.
3. Parses the envelope. `success: false` → throw `ApiError` carrying `code`, `message`,
   `details`, `requestId`.
4. Non-JSON or malformed body → `ApiError(status, 'UNEXPECTED_RESPONSE', …)`. Never `JSON.parse`
   a body without a try/catch; a proxy returning an HTML error page is a real scenario.
5. Network failure → `ApiError(0, 'NETWORK_ERROR', …)`.
6. `401` → handled by the BFF (refresh once, retry once, else clear session and redirect). The
   client never sees a transient 401.
7. `426` → `CLIENT_UPGRADE_REQUIRED`; show a blocking dialog telling the user to hard-reload. The
   web equivalent of the mobile forced-upgrade path, and much simpler because the fix is `Ctrl+Shift+R`.

## Query string conventions

Must match `22-api-conventions-errors.md` exactly:

```ts
buildQuery({ status: ['WITH_MERCHANT', 'IN_TRANSIT'], page: 2, search: 'SN-003' })
// → ?status=WITH_MERCHANT&status=IN_TRANSIT&page=2&search=SN-003
```

- **Arrays are repeated keys**, never comma-joined and never `status[]`.
- `undefined`, `null` and `''` are dropped — an empty filter must not become `&search=`.
- Dates: `yyyy-MM-dd` for date fields, full ISO-8601 for timestamps.
- Sorting: `sortBy=<field>&sortDir=asc|desc`, where `<field>` is from the endpoint's documented
  whitelist. The table's sortable columns are configured from that whitelist, so an unsortable
  column is not clickable.

## Pagination

Two shapes, both from the backend plan:

```ts
export type PageMeta   = { page: number; limit: number; total: number;
                           totalPages: number; hasNext: boolean };
export type CursorMeta = { limit: number; nextCursor: string | null; hasNext: boolean };
```

Offset (`page`/`limit`, default 20, max 100) is the default for every list screen and drives a
numbered pager. Keyset (`cursor`, up to 500) is used by sync, audit and report endpoints that
offer it, and drives "load more" / infinite scroll instead.

`src/lib/api/pagination.ts` exposes `isCursorMeta(meta)` so a shared table component can render
the right pager without the feature caring.

## Idempotency

```ts
// src/lib/api/idempotency.ts
export function newIdempotencyKey(): string { return crypto.randomUUID(); }
```

The rule that matters: **one key per user intent, reused across retries of that intent.**

- A form generates its key when the user first submits, stores it in a ref, and sends the same key
  if they hit submit again after a network error. That is what makes the retry safe.
- The key resets when the form's payload changes meaningfully, or after a successful submit.
- Sending a **new** key on a retry defeats the whole mechanism and can double-create a transfer.
- Sending the **same** key with a **different** payload gets a deliberate rejection from the
  server (`IDEMPOTENCY_KEY_REUSED`); surface it as "this action was already submitted differently
  — reload and check".

`useIdempotentMutation` in `07` encapsulates all of this. Feature code should not call
`newIdempotencyKey()` directly.

## Error codes

`src/lib/api/error-codes.ts` is a transliteration of the canonical catalogue in
`backend/machinery-backend-plan/22-api-conventions-errors.md`:

```ts
export const ErrorCode = {
  // auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  BRANCH_SCOPE_VIOLATION: 'BRANCH_SCOPE_VIOLATION',
  // machines
  SERIAL_EXISTS: 'SERIAL_EXISTS', BATTERY_SERIAL_EXISTS: 'BATTERY_SERIAL_EXISTS',
  SIM_SERIAL_EXISTS: 'SIM_SERIAL_EXISTS', BOX_SERIAL_EXISTS: 'BOX_SERIAL_EXISTS',
  SERIAL_IMMUTABLE: 'SERIAL_IMMUTABLE', MACHINE_NOT_FOUND: 'MACHINE_NOT_FOUND',
  MACHINE_RETIRED: 'MACHINE_RETIRED', MACHINE_ALREADY_REPLACED: 'MACHINE_ALREADY_REPLACED',
  // transfers
  INVALID_MACHINE_STATUS: 'INVALID_MACHINE_STATUS', NOT_IN_YOUR_CUSTODY: 'NOT_IN_YOUR_CUSTODY',
  MACHINE_ALREADY_IN_TRANSIT: 'MACHINE_ALREADY_IN_TRANSIT',
  TRANSFER_NOT_PENDING: 'TRANSFER_NOT_PENDING', PAYLOAD_CHANGED: 'PAYLOAD_CHANGED',
  INVALID_TRANSFER_TYPE: 'INVALID_TRANSFER_TYPE', SIGNATURE_REQUIRED: 'SIGNATURE_REQUIRED',
  INTER_BRANCH_DIRECT_TRANSFER_NOT_ALLOWED: 'INTER_BRANCH_DIRECT_TRANSFER_NOT_ALLOWED',
  CANCEL_WINDOW_EXPIRED: 'CANCEL_WINDOW_EXPIRED',
  // maintenance / decommission
  MACHINE_ALREADY_IN_MAINTENANCE: 'MACHINE_ALREADY_IN_MAINTENANCE',
  ORDER_ALREADY_CLOSED: 'ORDER_ALREADY_CLOSED', COST_REQUIRED: 'COST_REQUIRED',
  REPLACEMENT_PAYLOAD_REQUIRED: 'REPLACEMENT_PAYLOAD_REQUIRED',
  MACHINE_NOT_IN_WAREHOUSE: 'MACHINE_NOT_IN_WAREHOUSE',
  OPEN_MAINTENANCE_ORDER: 'OPEN_MAINTENANCE_ORDER',
  ALREADY_DECOMMISSIONED: 'ALREADY_DECOMMISSIONED',
  // merchants
  MERCHANT_HAS_MACHINES: 'MERCHANT_HAS_MACHINES', DUPLICATE_NATIONAL_ID: 'DUPLICATE_NATIONAL_ID',
  // finance
  CATEGORY_KIND_MISMATCH: 'CATEGORY_KIND_MISMATCH', CATEGORY_HAS_CHILDREN: 'CATEGORY_HAS_CHILDREN',
  CATEGORY_HAS_TRANSACTIONS: 'CATEGORY_HAS_TRANSACTIONS',
  CIRCULAR_CATEGORY_REFERENCE: 'CIRCULAR_CATEGORY_REFERENCE',
  SYSTEM_CATEGORY_PROTECTED: 'SYSTEM_CATEGORY_PROTECTED',
  FUTURE_DATE_NOT_ALLOWED: 'FUTURE_DATE_NOT_ALLOWED',
  BACKDATE_LIMIT_EXCEEDED: 'BACKDATE_LIMIT_EXCEEDED',
  AUTO_TRANSACTION_IMMUTABLE: 'AUTO_TRANSACTION_IMMUTABLE',
  TRANSACTION_ALREADY_VOIDED: 'TRANSACTION_ALREADY_VOIDED',
  OVERLAPPING_BUDGET: 'OVERLAPPING_BUDGET', BUDGET_ON_INCOME_CATEGORY: 'BUDGET_ON_INCOME_CATEGORY',
  // violations / users
  ALREADY_CHARGED: 'ALREADY_CHARGED', AUTO_VIOLATION_IMMUTABLE: 'AUTO_VIOLATION_IMMUTABLE',
  USER_HAS_CUSTODY: 'USER_HAS_CUSTODY', LAST_DIRECTOR: 'LAST_DIRECTOR',
  CANNOT_EDIT_OWN_PERMISSIONS: 'CANNOT_EDIT_OWN_PERMISSIONS',
  // sync / media
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED', INVALID_OCCURRED_AT: 'INVALID_OCCURRED_AT',
  SCHEMA_VERSION_MISMATCH: 'SCHEMA_VERSION_MISMATCH', TOO_MANY_PHOTOS: 'TOO_MANY_PHOTOS',
  MEDIA_NOT_CONFIRMED: 'MEDIA_NOT_CONFIRMED', UPLOAD_TOO_LARGE: 'UPLOAD_TOO_LARGE',
  // client-side only
  NETWORK_ERROR: 'NETWORK_ERROR', UNEXPECTED_RESPONSE: 'UNEXPECTED_RESPONSE',
  CLIENT_UPGRADE_REQUIRED: 'CLIENT_UPGRADE_REQUIRED',
} as const;
```

**Never** change a code's meaning; add a new one. The mobile app switches on these too.

## How errors surface

| Status | Presentation |
|---|---|
| 400 with `details` | map each `details[].field` onto the matching form field via `setError` — the path `items[0].machineId` maps to that exact RHF field name. A field-level error never becomes a toast. |
| 400 without `details` | inline form-level alert |
| 401 | never reaches the UI (BFF refreshes); a hard 401 logs out with a "session expired" toast |
| 403 | full-page `NoAccess` on a route, inline "you don't have permission" on an action. Never a toast — the user needs to understand it is permanent, not transient. |
| 404 | full-page `NotFound` with a back link. Note the backend returns 404 for out-of-scope entities too, deliberately; do not phrase the message as "deleted". |
| 409 | **conflict.** Dialog: "this changed while you were working" + a *Refresh* action that refetches. This is the recoverable one. |
| 422 | **illegal operation.** Inline alert with the specific localized message; the user must change something. No retry button. |
| 429 | toast with the `Retry-After` countdown; disable the submit control until it elapses |
| 5xx | error boundary with the `requestId` shown and copyable — support finds the exact log line from it |
| `NETWORK_ERROR` | offline banner + retry; mutation controls disabled while `!navigator.onLine` |

The 409/422 split is the one most likely to be implemented sloppily. **409 = collides with
something that exists → refresh and retry. 422 = not legal right now → change something.**
They get different UI. Do not collapse them into one "error" toast.

## Retry policy

- `GET`: retry twice with exponential backoff on network errors and 5xx. **Never** on 4xx.
- Mutations: **no automatic retry**, ever. The user retries explicitly, reusing the idempotency key.
- The one exception is the BFF's single silent token refresh on 401.

## Uploads

`POST /media/presign` → `PUT` the blob to the returned URL → `POST /media/confirm`, or the direct
`POST /media/upload` for small files. Always compress client-side before upload: `<canvas>`
re-encode to JPEG ≤ 1600px on the long edge, quality 0.8. A 12MP photo from a desktop file picker
will hit `UPLOAD_TOO_LARGE` otherwise. Show real progress via `XMLHttpRequest.upload.onprogress`
(`fetch` still cannot report upload progress reliably).
