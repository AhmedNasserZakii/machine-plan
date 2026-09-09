# 20 — Feature: Offline Support & Sync (backend side)

## The problem

Representatives hand over machines in shops, basements and industrial areas with no usable data
connection. The hand-off must be recordable, signable and photographable **entirely offline**, then
pushed when a connection returns — possibly hours later, possibly out of order, possibly twice
because the app was killed mid-upload.

The backend's job is to make that safe.

## Three mechanisms

### 1. Client-generated UUIDs

Every client-created entity carries a `clientUuid` (UUID v4) generated **on the device**, before
any network call. It is stored as a unique column:

```sql
ALTER TABLE transfers            ADD COLUMN client_uuid UUID UNIQUE;
ALTER TABLE finance_transactions ADD COLUMN client_uuid UUID UNIQUE;
ALTER TABLE merchants            ADD COLUMN client_uuid UUID UNIQUE;
ALTER TABLE media                ADD COLUMN client_uuid UUID UNIQUE;
```

On create, the service first looks up `client_uuid`. If found, it returns the existing record with
`200` instead of creating a duplicate. This survives retries, app restarts and duplicate taps.

### 2. Idempotency-Key header

Every mutating endpoint accepts `Idempotency-Key: <uuid>`. An interceptor:

1. hashes the request body → `request_hash`;
2. looks up `idempotency_keys` by `key`;
3. if found **and** `request_hash` matches → replay the stored response verbatim;
4. if found **and** the hash differs → `409 IDEMPOTENCY_KEY_REUSED`;
5. if not found → process, then store `{key, user_id, endpoint, request_hash, response_body, status_code, expires_at = now() + 7 days}`.

```ts
// src/common/interceptors/idempotency.interceptor.ts
```

Keys expire after 7 days — long enough for any realistic offline gap.

### 3. `occurredAt` vs `createdAt`

The device sends `occurredAt` — the real-world moment of the hand-off. The server records
`created_at` — when it learned about it. **Never** conflate them:

- Reports and timelines order by `occurred_at`.
- Audit and debugging use `created_at`.
- A hand-off synced 6 hours late still appears in the timeline at the right moment.

Guard against clock skew: reject `occurredAt` more than 24h in the future
(`422 INVALID_OCCURRED_AT`), and more than 30 days in the past unless the caller has an elevated
permission.

## Sync endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/sync/bootstrap` | full reference data for first launch |
| GET | `/sync/delta?since=<iso>` | everything changed since a timestamp |
| POST | `/sync/batch` | push a queue of offline operations |
| GET | `/sync/status` | server time + schema version |

### `GET /sync/bootstrap`

Returns everything the app needs to work offline:

```json
{
  "serverTime":"2026-09-07T12:00:00Z",
  "schemaVersion": 4,
  "lookups": {
    "machineTypes":[…], "machineModels":[…], "paymentMethods":[…],
    "violationTypes":[…], "maintenanceLocations":[…], "decommissionReasons":[…],
    "financeCategories":[…], "branches":[…]
  },
  "myMachines":[…],          // machines currently in the caller's custody
  "myMerchants":[…],         // merchants the caller can see
  "pendingTransfers":[…],    // awaiting the caller's signature
  "permissions":[…]
}
```

Localized per the request locale. The app stores this in its local DB (see Flutter `07`).

### `GET /sync/delta?since=`

Same shape, but only rows with `updated_at > since`, plus a `deleted` array of ids per collection so
the client can purge. Requires `updated_at` indexes on every synced table.

```sql
CREATE INDEX idx_machines_updated ON machines (updated_at);
CREATE INDEX idx_merchants_updated ON merchants (updated_at);
```

Response includes `nextSince` — always use the **server's** timestamp, never the client's clock.

### `POST /sync/batch`

```json
{
  "operations": [
    { "clientUuid":"…", "type":"CREATE_TRANSFER", "occurredAt":"…", "payload": { … } },
    { "clientUuid":"…", "type":"CONFIRM_TRANSFER", "occurredAt":"…", "payload": { … } },
    { "clientUuid":"…", "type":"CREATE_MERCHANT", "occurredAt":"…", "payload": { … } },
    { "clientUuid":"…", "type":"CREATE_FINANCE_TRANSACTION", "occurredAt":"…", "payload": { … } }
  ]
}
```

Processing rules:

1. Operations are processed **in the order given** — the client queue is causally ordered.
2. Each operation runs in **its own transaction**. One failure does not roll back the others.
3. The response reports every operation individually:

```json
{
  "results": [
    { "clientUuid":"…", "status":"SUCCESS", "serverId":"…" },
    { "clientUuid":"…", "status":"DUPLICATE", "serverId":"…" },
    { "clientUuid":"…", "status":"CONFLICT",
      "error": { "code":"MACHINE_ALREADY_IN_TRANSIT", "message":"…" },
      "resolution":"MANUAL" },
    { "clientUuid":"…", "status":"FAILED",
      "error": { "code":"VALIDATION_ERROR", "details":[…] }, "resolution":"DISCARD" }
  ],
  "serverTime":"…"
}
```

`resolution` tells the app what to do with the queued item: `DISCARD` (permanent failure — show the
user), `RETRY` (transient), `MANUAL` (needs a human decision).

## Conflict cases and how they resolve

| Conflict | Server behaviour |
|---|---|
| Machine moved by someone else while the rep was offline | `409 MACHINE_ALREADY_IN_TRANSIT` / `422 NOT_IN_YOUR_CUSTODY`, resolution `MANUAL`. The app shows the rep what actually happened. |
| Same transfer pushed twice | second returns `DUPLICATE` with the original id, no side effects |
| Merchant created offline that already exists (same phone) | created anyway; duplicate detection is a warning, not a block (`08`) |
| Transfer confirmed offline after the sender cancelled it | `409 TRANSFER_NOT_PENDING`, resolution `MANUAL` |
| Finance transaction with a category deleted meanwhile | `422 CATEGORY_NOT_FOUND`, resolution `MANUAL` |

**The server is always the authority on machine custody.** The client never wins a custody conflict.
This is deliberate: two people cannot both be holding the same machine.

## Media in offline mode

Photos and signatures are captured to local storage with their `clientUuid`. On sync, media uploads
run **first**, then the operations that reference them. The `POST /sync/batch` payload references
media by `clientUuid`; the server resolves them to real ids. If a referenced media has not arrived,
the operation returns `RETRY`.

## Schema versioning

`GET /sync/status` returns `schemaVersion`. If the client's stored version is older, it must run a
full `bootstrap` instead of a `delta`. Bump the version whenever a synced table's shape changes.

## Tests

- pushing the same `clientUuid` twice creates one row, returns `DUPLICATE` the second time
- an `Idempotency-Key` replay returns the identical response body and status
- the same key with a different body → 409
- a batch with one invalid operation still commits the valid ones
- a custody conflict returns `MANUAL` and changes nothing
- `occurredAt` 3 days in the future → 422
