# Backend Code Review — Findings & Fix Plan

Full review performed on 2026-09-08 (4 parallel deep reviews: auth/security, infrastructure,
machines/transfers/violations/merchants, finance/users/roles/organization).

Baseline at review time: typecheck ✅ · 81/81 unit tests ✅ · 1 lint error (formatting).

**Status: all 50 tracked items fixed.** After the fix pass: typecheck ✅ · lint ✅ ·
174/174 unit tests ✅ (25 added, covering the new guards). Three items are deferred as
feature work rather than fixes — the S3 storage driver (B7), the audit-log module (D18) and
a global rate limiter (D19); each is marked ⏩ inline with its reasoning.

Legend: ☐ pending · ☑ fixed · ⏩ deferred (feature work, tracked but not part of this pass)

---

## PHASE A — Privilege escalation & auth (HIGH)

- ☑ **A1. Role-assignment escalation** — `users.service.ts` `create()`/`update()` accept any
  `roleId` incl. DIRECTOR. Anyone with `users.create`/`users.update` can mint a Director.
  Fix: actor may only assign a role whose permission set is a subset of the actor's own
  effective permissions; revoke target's sessions on role change.
- ☑ **A2. Password-reset takeover** — `POST /users/:id/reset-password` (gated only by
  `users.update`) returns a temp password for ANY account incl. Directors.
  Fix: same privilege-subset rule as A1; revoke target sessions on reset.
- ☑ **A3. Role permission self-escalation** — `PUT /roles/:id/permissions` lets the actor edit
  their own role's permissions, and can strip the DIRECTOR role to an empty set.
  Fix: reject editing own role; protect DIRECTOR system role permissions.
- ☑ **A4. Missing `trust proxy`** — behind a reverse proxy the phone+IP login throttle becomes a
  per-phone global lock (attacker can lock out any user). Fix: `TRUST_PROXY` env → `app.set('trust proxy', …)`.
- ☑ **A5. Unthrottled `/auth/change-password`** — stolen access token → brute-force current
  password. Fix: throttle attempts keyed by user id.
- ☑ **A6. Swagger UI exposed in production** — `SwaggerModule.setup` runs unconditionally.
  Fix: skip docs UI when `isProduction`.
- ☑ **A7. DB TLS `rejectUnauthorized: false`** (app.module.ts + data-source.ts). Fix: verify by
  default, explicit `DB_SSL_REJECT_UNAUTHORIZED=false` opt-out.

## PHASE B — Media / storage (HIGH)

- ☑ **B1. Unbounded `PUT /media/blob`** — whole body buffered in memory, no size cap (size only
  checked at confirm). Fix: enforce Content-Length + streaming cap, destroy socket on overflow.
- ☑ **B2. Unbounded multipart `POST /media/upload`** — no `limits` on FileInterceptor.
  Fix: `limits: { fileSize, files: 1 }` + map LIMIT_FILE_SIZE → UPLOAD_TOO_LARGE.
- ☑ **B3. `DELETE /media/:id` destroys referenced evidence** — physical delete bypasses
  `ON DELETE RESTRICT` (soft delete doesn't trigger FKs). Fix: refuse when referenced by
  transfer photos/signatures (`MEDIA_ALREADY_USED`).
- ☑ **B4. Any authenticated user can read/claim anyone's media** — `GET /media/:id` and
  `claim()` have no ownership check. Fix: uploader-or-permission check on both.
- ☑ **B5. Confirmed media silently replaceable** within signature TTL. Fix: write-once put for
  confirmed media.
- ☑ **B6. Client MIME trusted** — no magic-byte validation; fix: sniff magic bytes for
  png/jpeg/webp/pdf at upload/confirm; explicit Content-Disposition + nosniff on readBlob.
- ⏩ **B7. S3 backend does not exist** — all `S3_*` config/MinIO/health are decoration; files go
  to local disk (`process.cwd()/storage`). Real S3/MinIO driver is feature work — DEFERRED.
  Interim in this pass: honest health indicator + startup warning in production.

## PHASE C — Transfers / custody (HIGH)

- ☑ **C1. Sender signature hashed against empty item list** — `storeSignature` fallback reads
  items via the default connection while the insert is uncommitted → `sha256([])` stored as
  evidence hash. Fix: compute hash from inserted items via the tx manager.
- ☑ **C2. Warehouse receivers not type-checked** — branch-to-branch moves constructible via
  another branch's warehouse; scrap/maintenance/company mixups. Fix: expected warehouse type
  per transfer rule, enforced in `resolveReceiver` + `recipientsFor`.
- ☑ **C3. Merchant-return authorization hole** — any rep can "return" any WITH_MERCHANT machine
  and hand custody to another rep who never signed. Fix: auto-confirm user-receiver must be the
  actor; verify machine actually held by an accessible merchant.
- ☑ **C4. Merchant never recorded on returns** — `from_party_id = NULL` breaks merchant
  timelines forever. Fix: persist merchant id from `machine.currentHolderId` (validate single
  merchant per transfer).

## PHASE D — Medium severity

- ☑ **D1. Factory intake accepts machines in any status** (custody teleport). Fix: only when no
  live custody holder.
- ☑ **D2. Unvalidated `toPartyId` persisted for abstract receivers** → dangling holder ids.
- ☑ **D3. Idempotency replay leaks foreign transfers + unique-race 500.** Fix: scope by
  initiator, catch unique violation → replay.
- ☑ **D4. Violation charge/waive check-then-act race.** Fix: pessimistic lock in transaction.
- ☑ **D5. Subscription clash check broken** (TypeORM drops null where) + reactivation bypasses
  clash check and leaves `nextDueDate` null (billing silently stops).
- ☑ **D6. National-ID duplicate check leaks other branches' merchants.**
- ☑ **D7. Float money arithmetic on `totalCollected`.** Fix: SQL-side addition.
- ☑ **D8. Machine PATCH + manual violation creation not branch-scoped.**
- ☑ **D9. LATE_RETURN misfires on normal merchant returns.** Fix: skip when fromParty=MERCHANT.
- ☑ **D10. Company-wide budget unique index void** (nullable branch_id) → NULLS NOT DISTINCT migration.
- ☑ **D11. Branch summary: no branch scoping + wrong finance permission (`finance.read` vs `finance.read.all`).**
- ☑ **D12. User re-activation skips branch/role validation** (active staff on deactivated branch).
- ☑ **D13. Last-director & branch-deactivation guards racy.** Fix: transaction + row locks.
- ☑ **D14. Redis `incr` TTL race** (immortal lockout keys) + cache reads don't degrade on Redis
  errors. Fix: atomic incr, try/catch reads as miss.
- ☑ **D15. Storage signing secret falls back to JWT secret**; env validation should require a
  dedicated secret in prod + reject placeholder/equal JWT secrets.
- ☑ **D16. `nextReferenceNo` interpolates prefix into raw SQL + per-call DDL.** Fix: validate
  prefix, move sequence creation out of hot path.
- ☑ **D17. Amount DTOs missing `@Max`** (values ≥ 10^12 → raw DB 500).
- ⏩ **D18. No audit-log module** (catalogue has `audit.read`, nothing implemented) — feature
  work, DEFERRED (schema/plan exists in machinery-backend-plan/21).
- ⏩ **D19. No global rate limiter (@nestjs/throttler)** — distributed brute force ceiling —
  DEFERRED to deployment hardening (interim: per-phone ceiling added in A4/A5 scope).

## PHASE E — Low severity (quick wins)

- ☑ **E1.** Pin JWT algorithm HS256 (sign + verify).
- ☑ **E2.** `@MaxLength(128)` on login/create passwords (argon2 CPU amplification).
- ☑ **E3.** Temp password 12 chars (`randomBytes(9)`).
- ☑ **E4.** Validate inbound `x-request-id` (`/^[\w-]{1,64}$/`).
- ☑ **E5.** Atomic refresh rotation (conditional UPDATE, affected=0 → reuse).
- ☑ **E6.** Branch-scope `GET /users/:id/permissions`.
- ☑ **E7.** Escape ILIKE wildcards in all search filters (shared util).
- ☑ **E8.** `@IsInt @Max(200)` on merchant timeline limit.
- ☑ **E9.** `ORDER BY id` in `lockMachinesByIds` (deadlock window).
- ☑ **E10.** Fix prettier error in `finance/budget-rules.ts`.
- ☑ **E11.** Dev seeds: allowlist envs (`development`/`test`) instead of blocking only production.
- ☑ **E12.** Remove dead `JWT_REFRESH_SECRET` config + validate secrets differ / not placeholder.
- ☑ **E13.** `assertSerialsAreFree`: drop `withDeleted`, map unique violations → 409.
- ☑ **E14.** Extensions migration `down()` → no-op (don't drop shared extensions).
- ☑ **E15.** Violation acknowledge restricted to subject; forbid CLOSED→ACKNOWLEDGED.
- ☑ **E16.** `DB_PASSWORD` `@IsNotEmpty`; require storage signing secret in prod.

## Noted, not code fixes

- **No git repository** — the project has no version control. Strongly recommend `git init` +
  initial commit before/after this fix pass.
- `.env` exists locally with real-looking secrets; `.gitignore` already covers it for when git
  is initialized.
- docker-compose uses default credentials and host-exposed ports — dev-only file today, use
  `${VAR:?required}` before any shared deployment.
- The finance module was entities/DTOs only when the review started; its services and
  controllers landed *during* this pass (Phase 7). They were included where they touched a
  finding (media claim ownership, ILIKE escaping, `@Max` on amounts), but the money-write
  logic has not had a dedicated review of its own and should get one.
- Verification was static: typecheck, lint and unit tests. The concurrency fixes (conditional
  UPDATEs, `FOR UPDATE` locks, `NULLS NOT DISTINCT`) and the migration are only exercised
  against a real Postgres, so they need an integration run before deployment.

## Done well (do not regress)

argon2id params + dummy-verify timing defense; opaque rotating refresh tokens (hashed, reuse
detection); default-deny global guard stack; principal rebuilt from DB per request; whitelist
ValidationPipe; parameterized queries + sort whitelists everywhere; hand-written migrations with
complete down()s and partial unique indexes; pessimistic locking on transfer state transitions;
pino redaction of credentials.
