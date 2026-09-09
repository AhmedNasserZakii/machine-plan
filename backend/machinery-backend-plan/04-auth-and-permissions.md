# 04 — Auth & Permissions

## Principles

- Accounts are **created by the Director only**. There is no public sign-up.
- Login identifier is **phone number** (field staff don't reliably have email).
- Authorization is **permission-based**, not role-based, at the check site. Roles are just
  permission bundles. This is what lets the Director hand the finance module to one specific
  supervisor without redesigning roles.
- Every list endpoint is additionally **branch-scoped** unless the user has a `*.read.all` permission.

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/login` | public | phone + password → tokens |
| POST | `/api/v1/auth/refresh` | public | rotate refresh token |
| POST | `/api/v1/auth/logout` | user | revoke current refresh token |
| POST | `/api/v1/auth/change-password` | user | required on first login |
| GET | `/api/v1/auth/me` | user | profile + effective permissions + branch |
| POST | `/api/v1/auth/biometric/enroll` | user | register device for biometric confirmation |
| POST | `/api/v1/auth/devices` | user | register push token + device id |

### `GET /auth/me` response

```json
{
  "id": "…", "fullName": "…", "phone": "…",
  "role": { "code": "REPRESENTATIVE", "name": "مندوب" },
  "branch": { "id": "…", "name": "فرع الإسكندرية" },
  "permissions": ["machines.read", "transfers.confirm", "merchants.create", "…"],
  "mustChangePassword": false,
  "biometricEnabled": true
}
```

The mobile app caches `permissions` and drives all UI visibility from it (see Flutter `21`).

## Tokens

| Token | Lifetime | Storage |
|---|---|---|
| access | 30 min | memory / secure storage |
| refresh | 30 days, rotating | secure storage, hashed server-side |

Refresh rotation: on every refresh, the old token is revoked and a new one issued. Re-use of a
revoked token revokes the whole device chain (theft detection).

**Offline consideration:** field staff may be offline past the 30-minute access token expiry. The
mobile client keeps working offline against the local DB and only needs a valid token at sync time.
Do **not** design any flow that requires a live token to record a hand-off.

## Permission catalogue (seed data)

```
# Machines
machines.read            machines.read.all        machines.create
machines.update          machines.delete          machines.import

# Transfers
transfers.read           transfers.read.all       transfers.create
transfers.confirm        transfers.reject         transfers.cancel

# Merchants
merchants.read           merchants.read.all       merchants.create
merchants.update         merchants.delete

# Maintenance
maintenance.read         maintenance.create       maintenance.update
maintenance.close        maintenance.set_cost

# Violations
violations.read          violations.read.all      violations.create
violations.resolve       violations.waive

# Decommission
machines.decommission

# Finance  ← the Director gates these individually
finance.read             finance.read.all         finance.create
finance.update           finance.void             finance.categories.manage
finance.budgets.manage

# Reports
reports.machines         reports.transfers        reports.violations
reports.finance          reports.export

# Admin
users.read               users.create             users.update
users.deactivate         roles.manage             branches.manage
audit.read               settings.manage
```

## Default role → permission mapping (seed)

| Role | Gets |
|---|---|
| `DIRECTOR` | **all** permissions |
| `BRANCH_SUPERVISOR` | machines.read/update, transfers.* (own branch), merchants.read, maintenance.read/create, violations.read/create, reports.machines/transfers/violations, users.read |
| `REPRESENTATIVE` | machines.read (own custody), transfers.read/create/confirm, merchants.read/create/update, violations.read (own) |
| `ACCOUNTANT` | finance.* , reports.finance, reports.export, machines.read |
| `VIEWER` | *.read only |

> Note: no role gets finance permissions by default except `ACCOUNTANT` and `DIRECTOR`.
> Anyone else who needs it gets a `user_permission_overrides` row with effect `ALLOW`.

## Effective permission resolution

```
effective = (role_permissions ∪ overrides[ALLOW]) \ overrides[DENY]
```

Cache per user in Redis with key `perm:{userId}`, TTL 15 min, invalidated on any role/override change.

## Guards

1. `JwtAuthGuard` — global, opt out with `@Public()`.
2. `PermissionsGuard` — reads `@Permissions('machines.create')` metadata, checks effective set.
3. `BranchScopeGuard` — if the user lacks the matching `*.read.all`, injects
   `branchId = user.branchId` into the query filter. Services must consume `req.branchScope`
   rather than trusting a client-supplied `branchId`.

```ts
@Permissions('transfers.create')
@Post()
create(@CurrentUser() user: AuthUser, @Body() dto: CreateTransferDto) { … }
```

## Password policy

argon2id. Minimum 8 chars. `must_change_password = true` on creation and on admin reset.
Lockout: 5 failed attempts → 15 min lock, tracked in Redis by phone + IP.

## Biometric confirmation — what it actually is

The device performs local biometric authentication (fingerprint/face). The server **cannot verify a
fingerprint**. What the client sends is an assertion:

```json
{ "method": "BIOMETRIC", "deviceId": "…", "verifiedAt": "…", "payloadHash": "…" }
```

Server-side requirements:
- the `deviceId` must be an enrolled device for that user,
- the request must be authenticated by that user's JWT,
- `payloadHash` must equal the server's own hash of the transfer snapshot.

Treat biometric as "the enrolled device confirmed this user's presence", and store it as evidence.
For legally stronger proof, the drawn signature image is captured as well — the mobile app should
offer both and record whichever the user used.
