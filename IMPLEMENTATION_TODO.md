# Machinery System — Remaining Implementation TODO

This checklist tracks the work still required to satisfy:

- `backend/machinery-backend-plan/`
- `mobile-app/machinery-flutter-plan/`

Items are ordered by dependency and risk. Complete them from top to bottom unless a task explicitly
says it can be done in parallel. Do not mark an item complete until its acceptance checks pass.

## Working rules

- [ ] Keep the backend API contract and Flutter models synchronized.
- [ ] Add Arabic and English translations for every user-visible string.
- [ ] Apply permission checks at API, route/navigation, and widget/action levels.
- [ ] Add loading, empty, error, and offline states to every new mobile screen.
- [ ] Add unit tests and the main happy/failure-path integration tests with every feature.
- [ ] Keep all migrations reversible and update the committed OpenAPI document after API changes.
- [ ] Run backend lint, typecheck, unit tests, and E2E tests before closing a backend item.
- [ ] Run `flutter analyze`, unit/widget tests, and relevant Maestro flows before closing a mobile item.

---

## 1. Backend correctness blockers

**Status: complete**, verified 2026-09-08. `NullCustodyAdapter` had already been replaced by a
real `MachineCustodyAdapter` (`src/modules/users/custody.port.ts`, wired in `users.module.ts`) and
idempotency was already enforced by default on every mutation via `IdempotencyInterceptor`, from
an earlier fix pass (`backend/CODE_REVIEW_PLAN.md`). This session closed the one remaining gap —
missing permission/cross-branch E2E coverage on the custody and violations endpoints — and
verified the rest with a full test run. See "How to continue" at the end of this section.

### 1.1 Replace the user custody stub

- [x] Implement a real `CustodyPort` adapter backed by the machines table.
- [x] Wire the real adapter into `UsersModule` instead of `NullCustodyAdapter`.
- [x] Ensure deactivation returns `USER_HAS_CUSTODY` when the user holds one or more machines.
- [x] Add tests for zero, one, and multiple held machines. (Zero/one via the new
      `GET /users/:id/custody` E2E cases below; multiple, mixed direct+merchant custody, via the
      existing `refuses to deactivate a user accountable for machine custody` E2E test.)
- [x] Add an E2E test proving a user with custody cannot be deactivated.

Acceptance:

- [x] `NullCustodyAdapter` is not used by the running application (the type no longer exists;
      `MachineCustodyAdapter` is the only `CUSTODY_PORT` provider).
- [x] User deactivation cannot bypass the custody rule (`users.service.ts` checks
      `custody.countHeldByUser` inside the same transaction as the guard and the write).

### 1.2 Add the missing user custody endpoints

- [x] Implement `GET /users/:id/custody` with `machines.read` and branch scoping.
- [x] Return the response shape specified in backend plan file `05`.
- [x] Implement `GET /users/:id/violations` (`UserViolationsController`) — a dedicated route, not
      just the filtered `/violations?userId=` query, with its own `summary` endpoint alongside it.
- [x] Add Swagger documentation and E2E tests for permissions and cross-branch access. (Added in
      this session: `test/users.e2e-spec.ts` — `GET /users/:id/custody` describe block covers a
      zero-custody user, a one-machine user, a caller missing `machines.read` (403), and an
      out-of-branch supervisor (404); `GET /users/:id/violations` gained the equivalent
      `violations.read` 403 case and a cross-branch case. Note: `/violations` filters by the
      violation's own `branchId` rather than rejecting an out-of-scope subject, so its cross-branch
      case asserts an empty page rather than a 404 — documented inline in the test.)

### 1.3 Enforce idempotency on every mutation

- [x] Inventory every `POST`, `PUT`, `PATCH`, and `DELETE` endpoint (28 controllers reviewed).
- [x] Apply idempotency to every write endpoint required by plan files `20` and `22`. Implemented
      as a stronger form than "apply the decorator everywhere": `IdempotencyInterceptor`
      (`src/common/interceptors/idempotency.interceptor.ts`) protects every authenticated
      `POST`/`PUT`/`PATCH`/`DELETE` by default, so a newly added controller cannot silently omit
      the rule; `@Idempotent()` remains as an explicit, redundant marker on a few routes.
- [x] Define deliberate exceptions, if any, in one documented allowlist —
      `IDEMPOTENCY_EXEMPTIONS` in the same file (`/auth/login`, `/auth/refresh`,
      `/merchants/check`, `/transfers/validate`, `PUT /media/blob`), each with an inline reason.
- [x] Test same-key replay, same-key/different-payload rejection, concurrent replay, and expiry —
      `src/common/idempotency/__tests__/idempotency.service.spec.ts` and
      `src/common/interceptors/__tests__/idempotency.interceptor.spec.ts` (the latter also
      parametrizes over every entry in `IDEMPOTENCY_EXEMPTIONS`).
- [x] Confirm sync-batch operations remain deduplicated independently by `clientUuid` —
      `sync-batch.service.ts` looks up by `clientUuid` per operation type; covered by
      `test/sync.e2e-spec.ts` (duplicate `clientUuid` push, duplicate signature push, and a whole
      batch replayed under one `Idempotency-Key`).

Acceptance:

- [x] Repeating any supported mutation with the same idempotency key cannot create a second effect.

**Verification run (2026-09-08):** `npm run typecheck` ✅ · `npm run lint` ✅ ·
`npm test` — 337/337 unit tests ✅ · `./scripts/run-e2e.sh` — 541/541 E2E tests across 17 suites ✅
(local Postgres needed a non-empty `DB_PASSWORD` env override to pass `env.validation.ts`; the
committed `.env` has it blank for trust-auth local Postgres — not a code change, just how this
machine's e2e run was invoked).

**How to continue:** Section 1 needed no new production code — only test coverage. Section 2
(Backend audit log) is genuinely unimplemented: there is no `AuditModule`/`AuditService`, no
`audit_logs` table/migration, and `audit.read` in the permissions catalogue has nothing behind it
(tracked as deferred item **D18** in `backend/CODE_REVIEW_PLAN.md`). Start at 2.1.

---

## 2. Backend audit log

**Status: complete**, built 2026-09-08. Previously there was no `AuditModule`, no `audit_logs`
table, and `audit.read` in the permissions catalogue had nothing behind it (deferred item **D18**
in `backend/CODE_REVIEW_PLAN.md`). This session implemented the full feature: schema, redaction/
diffing, a durable queue-backed recorder, explicit audit calls across every module the plan names,
and a read API with tamper resistance. See "How to continue" at the end of this section for the
handful of deliberate scope boundaries.

### 2.1 Add the audit database model

- [x] Create the partitioned `audit_logs` table described in backend plan file `21`
      (`src/database/migrations/1789900000000-AuditLog.ts`).
- [x] Add monthly range partitions (a rolling 6-months-back/30-months-forward window computed at
      migration time, plus an `audit_logs_default` catch-all so a write is never rejected for
      landing outside it — an operator must still provision new partitions ahead of time; see
      `backend/AUDIT_RETENTION.md`) and the required entity/user/action indexes, plus a partial
      index on `request_id`.
- [x] Store actor, action, entity type/id, before/after diff, request ID, IP, user agent, and
      timestamp (`src/common/audit/audit-log.entity.ts`).
- [x] Add safe handling for unauthenticated events such as failed login attempts (`user_id` is
      nullable; `AuthService.login()` records `LOGIN_FAILED` with `userId: null` when the phone is
      unknown).
- [x] Add a reversible migration (verified up/down against a scratch database in this session).

### 2.2 Implement redaction and diffing

- [x] Create a centralized `REDACTED_FIELDS` list (`src/common/audit/redaction.ts`), matched
      case-insensitively with underscores stripped so `passwordHash`/`password_hash` are one entry.
- [x] Redact passwords, password hashes, tokens, secrets, and full national IDs.
- [x] Store only changed keys for updates (`src/common/audit/audit-diff.ts`, `diffSnapshots()`).
- [x] Add tests for nested values, null changes, arrays, and redacted fields
      (`src/common/audit/__tests__/redaction.spec.ts`, `audit-diff.spec.ts` — 17 tests).

### 2.3 Implement durable audit recording

- [x] Create `AuditModule`, `AuditService`, and a global `AuditInterceptor`
      (`src/common/audit/`, `src/common/interceptors/audit.interceptor.ts`). The interceptor's
      job is ambient request-context propagation (request id/IP/user agent, via
      `AsyncLocalStorage`, so a service three layers deep can call `record()` without being
      handed the raw request) plus the one fully-generic event it can describe on its own
      (`@AuditFinanceRead()`) — not generic CRUD detection, which cannot know a "before" state for
      an arbitrary entity. Every semantic event is an explicit `AuditService.record()` call.
- [x] Add explicit semantic audit calls for transfers, signatures, maintenance, replacements,
      decommission, finance, permissions, and authentication events (see 2.4).
- [x] Queue audit writes durably using Redis/BullMQ (`src/common/audit/audit-queue.service.ts`,
      same broker-with-inline-fallback shape as `ReportQueueService` — a write runs inline when no
      broker is configured, e.g. this dev machine and the e2e suite, rather than being dropped).
- [x] Define retry and dead-letter behavior so failed audit writes are observable (`attempts: 5`
      with exponential backoff; failed jobs are kept, not discarded, as the nearest thing to a
      dead-letter queue without a second queue to manage; a `Logger.error` fires on final failure).
- [x] Audit finance read endpoints once per request without storing response payloads
      (`@AuditFinanceRead()` on the money-bearing `GET` routes in `finance-transactions.controller.ts`
      and `budgets.controller.ts`; records `FINANCE_READ_ACCESSED` with no `before`/`after`).

### 2.4 Cover every required event

- [x] Machines and batteries: create/update. (Battery has create only — there is no battery-update
      endpoint in the API today; `AuditAction.BATTERY_UPDATED` is defined for when one exists.)
- [x] Merchants: create/update/deactivate.
- [x] Users, roles, permissions, and branches: every mutation (users: create/update/deactivate/
      activate/reset-password/set-permissions; roles: create/update/set-permissions; branches:
      create/update/deactivate/activate; warehouses: create).
- [x] Transfers: create/confirm/reject/cancel and every signature (one `record()` call inside
      `storeSignature()`, shared by the create and confirm paths, rather than duplicated per caller).
- [x] Maintenance: create/update/send/receive/close/cancel and cost changes (cost changes are
      captured as part of `update`'s and `close`'s before/after diff, not a separate action).
- [x] Replacements and decommission/revert (`ReplacementsService.perform()` is the one place a
      swap is written, shared by the dedicated `/replace` route and a maintenance close-with-swap,
      so it is audited once centrally rather than at each caller).
- [x] Finance transactions: create/update/void.
- [x] Budgets and categories: create/update/move/delete.
- [x] Violations: create/acknowledge/update/charge/waive.
- [x] Login success/failure, logout, password change/reset, and biometric enrolment.
- [x] Finance read access.

**Deliberately out of scope** (not named by 2.4, not wired): suppliers, and the lookup/catalogue
admin CRUD (machine types/models, payment methods, violation types, maintenance locations,
decommission reasons). `GET /branches/:id/summary`'s conditional finance block is also not
`@AuditFinanceRead()`-tagged — it is a branch dashboard that *includes* a finance section rather
than a `finance.*` endpoint, and the decorator has no way to fire only when that section is present.

### 2.5 Add audit APIs and tamper resistance

- [x] Implement `GET /audit-logs` with keyset pagination and all planned filters (`userId`,
      `action`, `entityType`, `entityId`, `dateFrom`, `dateTo`, `requestId`) —
      `src/modules/audit/`.
- [x] Implement `GET /audit-logs/entity/:type/:id`.
- [x] Implement `GET /audit-logs/user/:userId`.
- [x] Protect all routes with `audit.read`. Not branch-scoped: like `/roles` and `/settings`,
      `audit.read` is a company-wide administrative capability (only Director holds it) — there is
      no `audit.read.all` variant in the permissions catalogue, and no branch-scoped role is meant
      to reach this endpoint at all.
- [x] Revoke `UPDATE` and `DELETE` on audit rows from the application DB role (`REVOKE ... FROM
      CURRENT_USER` in the same migration as 2.1 — this assumes, as the rest of this single-role
      project does, that the migration-running role and the app's runtime role are the same one).
- [x] Document five-year retention and archival handling (`backend/AUDIT_RETENTION.md` — also notes
      that new partitions are not yet created automatically and names that as follow-up work).
- [x] Add permission, filtering, pagination, redaction, and immutability E2E tests
      (`test/audit-logs.e2e-spec.ts`, 6 tests). The immutability test reads Postgres's actual
      stored ACL (`pg_class.relacl` via `aclexplode`) rather than attempting a live `UPDATE`/
      `DELETE`: this machine's Postgres role is a superuser, which bypasses ACL checks entirely,
      so a real mutation attempt would misleadingly succeed even after the `REVOKE` — see
      `backend/AUDIT_RETENTION.md` for why that matters in production.

**Verification run (2026-09-08):** `npm run typecheck` ✅ · `npm run lint` ✅ ·
`npm test` — 364/364 unit tests ✅ (17 new, covering redaction/diffing/the interceptor/the service)
· `./scripts/run-e2e.sh` — 547/547 E2E tests across 18 suites ✅ (541 pre-existing + 6 new).

**How to continue:** Section 3 (Backend media completion) is next. `3.1` (S3/MinIO storage) and
part of `4.2` (rate limiting) are the other two items this backend deliberately deferred as
feature work during the earlier correctness pass — see items **B7** and **D19** in
`backend/CODE_REVIEW_PLAN.md` for the reasoning already recorded there before starting.

---

## 3. Backend media completion

**Status: complete**, built and verified 2026-09-08. All three subsections were genuinely
unimplemented before this session (S3 was decorative config only — deferred item **B7** in
`backend/CODE_REVIEW_PLAN.md` — and `MediaService.purgeOrphans()` existed but nothing ever called
it). A local MinIO server (`brew install minio`) was installed and used to run real integration
tests against S3-compatible storage, not just the local-disk fallback — see 3.1's notes and
`scripts/run-integration.sh`. See "How to continue" at the end of this section.

### 3.1 Implement production object storage — done 2026-09-08

- [x] Introduce a storage interface with local and S3/MinIO adapters
      (`src/modules/media/storage/storage.types.ts` — `StorageAdapter`; `local-disk-storage.adapter.ts`
      and `s3-storage.adapter.ts` implement it; `storage.service.ts` is now a thin facade that
      picks one at construction time and is the only thing anything else in the app injects).
- [x] Implement private S3/MinIO upload, HEAD, download, delete, and presigned URLs
      (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`). `head()` fetches the object rather
      than issuing a bare `HeadObjectCommand`: S3's `ETag` is an MD5 digest for a normal upload,
      not the SHA-256 the client declares at presign and the local adapter also produces, so it
      cannot be compared against `media.checksum` as-is — every media purpose caps at 5 MB, so
      downloading once at confirm time is cheap and correct instead.
- [x] Select the adapter through validated environment configuration (`storage.enabled` = bucket +
      access key both set); boot-time env validation now hard-refuses to start in production
      without `S3_BUCKET`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`, upgraded from the interim
      "warn and fall back to local disk" behavior noted in `CODE_REVIEW_PLAN.md` item B7.
- [x] Update readiness checks to verify the configured production adapter
      (`storage.health.ts` reports `this.storage.backend` truthfully and probes whichever adapter
      is actually active, rather than the previous hardcoded `'local-disk'`).
- [x] Add integration tests against MinIO (`test/storage-s3.integration-spec.ts`, a separate Jest
      config/npm script — `npm run test:integration` — kept out of the main unit/e2e runs since it
      needs a live S3-compatible server; defaults point at a local MinIO. Verified in this session
      against a real MinIO instance: presign issues a genuine bucket URL, PUT/GET round-trip
      bytes correctly, a checksum mismatch is caught, and delete actually removes the object —
      checked by reading the bucket directly, not just trusting a 404 from the API).

### 3.2 Implement image optimization — done 2026-09-08

- [x] Add a `media-optimize` queue and worker (`media-optimize-queue.service.ts`, same
      broker-with-inline-fallback shape as the audit and report queues; `media-optimize.service.ts`
      is the worker body, started from `OnModuleInit`).
- [x] Re-encode supported images to WebP at the planned quality (80). Skipped for `SIGNATURE`
      media and for `application/pdf` invoices — sharp cannot process a PDF, and a signature must
      not be touched at all (see below).
- [x] Strip metadata while preserving orientation: `.rotate()` with no argument bakes the EXIF
      orientation into the pixels once, before the WebP re-encode, which carries no metadata at
      all by default (sharp only keeps it if `.withMetadata()` is called, which nothing here does).
- [x] Generate the 320 px thumbnail variant (`fit: 'inside'`, `withoutEnlargement: true`, so a
      source already smaller than 320px is never upscaled).
- [x] Store width, height, checksum, optimized size, and variant metadata. Migration
      `1790000000000-MediaOptimization.ts` adds `thumbnail_key`, `is_optimized`, `optimized_at` to
      `media` (`width`/`height`/`checksum` already existed, unused until now); `storage_key` and
      `size_bytes` are overwritten in place with the optimized object's values rather than tracked
      in a second column, since the pre-optimization object is deleted, not kept.
- [x] Support `?variant=thumb` without exposing permanent object URLs (`GET /media/:id?variant=thumb`
      — still a fresh signed URL each call; falls back to the full variant when no thumbnail exists
      yet, e.g. optimization still queued, rather than 404ing).
- [x] Preserve original signature PNGs as immutable evidence — `MediaOptimizeService.isEligible()`
      excludes `MediaPurpose.SIGNATURE` unconditionally; verified in both the unit test (bytes never
      touched, `storage.put` never called) and the e2e test (downloaded bytes still equal the
      exact uploaded PNG).

**Verification:** `src/modules/media/__tests__/media-optimize.service.spec.ts` (10 tests, using
real `sharp`-generated JPEGs — not mocked image processing — to check actual output format,
dimensions, and no-upscale behavior) plus two new cases in `test/media.e2e-spec.ts` covering the
full confirm → optimize → thumb-variant path and the signature exemption end to end.

### 3.3 Schedule media cleanup — done 2026-09-08

- [x] Schedule `MediaService.purgeOrphans()` nightly. Implemented as an hourly `setInterval` sweep
      (`OnModuleInit`/`OnModuleDestroy` on `MediaService`, same shape as `ReportJobsService`'s
      retention sweep) rather than a specific wall-clock time: hourly comfortably satisfies
      "nightly" while self-healing a missed run within the hour. Gated by `storage.config.ts`'s
      `cleanupEnabled` (`MEDIA_CLEANUP_ENABLED`), which defaults on outside `NODE_ENV=test` and off
      under it — the same convention the report/notification sweeps already use, for the same
      reason: a clock deleting rows underneath a suite's assertions is a flake nobody can reproduce.
- [x] Ensure only unconfirmed, unattached media older than 24 hours is removed. True by
      construction, not by a second check: `MediaService.claim()` refuses to attach anything
      unconfirmed to a transfer/signature/invoice, so `purgeOrphans()`'s `isConfirmed: false` filter
      can never see a row that is — or ever was — attached to anything.
- [x] Never remove transfer photos, signatures, or invoices attached to records — see above; a
      confirmed row is not a candidate at any age, verified directly in both the unit and e2e tests.
- [x] Add cleanup metrics/logging and failure alerts. No Prometheus endpoint exists yet in this
      backend (that is section `4.4`, not built), so this is structured `pino` logging in the shape
      log-based alerting can key off: a summary line with `removed`/`failed`/`durationMs` per
      sweep, a per-row `logger.error` naming the exact media id and storage key when a delete
      fails, and one dedicated `logger.error` line when a sweep ends with `failed > 0` — that last
      line is the one an ops alert on "media cleanup" error-rate should watch. `purgeOrphans()`
      itself was hardened alongside this: previously a single failed `storage.delete()` aborted the
      whole batch via an unhandled throw, leaving *every* row — including ones already deleted from
      storage — un-soft-deleted; it now isolates each row's failure, soft-deletes everything that
      did succeed, and leaves only the failed ones for the next hourly retry.
- [x] Test the time boundary and protected-media cases.
      `src/modules/media/__tests__/media-cleanup.spec.ts` (7 unit tests: batch success, the exact
      query filter/cutoff computation, the no-orphans no-op, partial-batch storage-failure
      isolation, all-fail isolation, and the timer start/stop wiring) plus
      `test/media-cleanup.e2e-spec.ts` (5 e2e tests against a real database with `created_at`
      pushed back by hand: well-past-cutoff removed, well-inside-window kept, one minute short of
      the cutoff kept, one minute past it removed, and a confirmed upload 30 days old never
      touched).

**Verification run (2026-09-08):** `npm run typecheck` ✅ · `npm run lint` ✅ ·
`npm test` — 382/382 unit tests ✅ · `./scripts/run-e2e.sh` — 554/554 E2E tests across 19 suites ✅.

**How to continue:** Section 4 is next. `4.1` (PDF exports) is genuinely unimplemented — check
`src/modules/reports/services/report-export.service.ts` for the CSV/XLSX renderers this needs to
sit alongside. `4.2` (rate limiting) is partially done: the login phone+IP lockout exists
(`LoginThrottleService`), but the four general/sync-batch/media-presign/report-export ceilings are
the deferred item **D19** in `backend/CODE_REVIEW_PLAN.md` and still need `@nestjs/throttler`
wired in. `4.3` (forced client upgrades) and `4.4` (metrics/`/health/ready`) have not been
started — check for `MIN_CLIENT_VERSION`/`X-Client-Version` handling and a `/metrics` route before
assuming otherwise. A local MinIO server was left running for this session (check for a `minio server` process on
ports 9000/9001, e.g. `lsof -i :9000`) — stop it if it is not wanted between sessions; it was
started directly (`/opt/homebrew/opt/minio/bin/minio server ...`), not via `brew services`. The
integration suite (`npm run test:integration`) does not start MinIO itself — it needs one already
running and reachable (defaults assume `localhost:9000`, bucket `machinery-media`, credentials
`minioadmin`/`minioadmin`) and will fail with connection errors, not a clean skip, if none answers.

---

## 4. Backend reports and API hardening

### 4.1 Implement PDF exports — done 2026-09-08

- [x] Add the planned PDF renderer: headless Chromium via `puppeteer`
      (`src/common/export/pdf-renderer.service.ts`), rendering an HTML template
      (`pdf-template.ts`) — exactly the mechanism plan `17` names, one shared browser process
      reused across renders rather than launched per export.
- [x] Embed an Arabic-capable font and verify shaping and RTL layout. Cairo (SIL OFL, chosen for
      its full Latin coverage too — one font serves both locales) is bundled under
      `src/common/export/assets/fonts/` and embedded as a base64 `@font-face` data URI, so
      rendering never depends on a font being installed on the host. **Verified visually, not
      just structurally**: rendered a sample Arabic and English report, converted each PDF to a
      PNG with `pdftoppm` (`brew install poppler`), and read the images directly — correct glyph
      shaping/joining, right-to-left column order, and serials/amounts/dates staying
      left-to-right inside the RTL page all confirmed by eye during this session.
- [x] Add report title, generation time, filters, headers, totals, and page numbering. Title/
      generated-at/filters reuse the same `table.meta` block CSV/XLSX already build; a totals row
      is summed per numeric column (added specifically for PDF — xlsx/csv don't have one); page
      numbers are localized ("Page X of Y" / "صفحة X من Y") via Puppeteer's footer template.
- [x] Make PDF use the same asynchronous export-job flow as CSV/XLSX. Literally the same code
      path — `ReportFormat.PDF` was removed from `ReportJobsService.create()`'s early-rejection
      list (only `JSON`, the live-response shape, is refused now) and `ReportExportService.render()`
      dispatches to the new renderer exactly like it already did for `toCsv`/`toXlsx`.
- [x] Test Arabic and English PDFs visually (see above) and through an export E2E test
      (`test/reports.e2e-spec.ts`, `describe('pdf')`): the job reaches `READY` through the real
      queue-or-inline flow, the downloaded bytes are a structurally valid PDF (`%PDF-`/`%%EOF`),
      and — for English specifically — `pdf-parse` extracts the title, labels, and page-number
      text in correct reading order. The Arabic case is checked structurally (parses as a
      multi-page PDF, non-trivial size) rather than by extracted-text matching: Chromium writes
      correct Arabic *glyphs* into the PDF (confirmed visually) but as shaped presentation-form
      codepoints, which a text extractor reads back reordered and transformed — a property of PDF
      text extraction for shaped Arabic, not a rendering defect, so asserting extracted-text
      equality there would be testing the wrong layer.

**Dependency notes, both load-bearing for the test suite specifically:**
- `puppeteer` is pinned to `24.43.1` (exact), not the newer `25.x` line: from `25.x` on the
  package is ESM-only, which this project's `module: commonjs` build cannot statically import,
  and which Jest cannot even dynamically `import()` without `--experimental-vm-modules`. `npm
  audit` flags a high-severity advisory in `extract-zip` (a transitive dependency of
  `@puppeteer/browsers`, used only to unpack the Chromium binary Puppeteer downloads from
  Google's own CDN at install/first-launch time) whose only fix is upgrading to `25.x` — not
  reachable through any request this API serves, so the pin was judged the safer trade-off over
  taking on the ESM migration. Revisit if the project ever moves to native ESM.
- `pdf-parse` (dev-only, test-verification of English PDF content) transitively needs
  `--experimental-vm-modules` too, for an unrelated reason (`pdfjs-dist`'s own worker setup).
  `scripts/run-e2e.sh` now sets this on `NODE_OPTIONS` for the whole e2e run — it only *widens*
  what Jest's VM contexts may do and changed nothing else across the full 556-test e2e run
  verified in this session.

### 4.2 Complete rate limiting — done 2026-09-08

- [x] Add general authenticated limiting: 300 requests/minute/user. `@nestjs/throttler`'s
      `'default'` named throttler (`src/common/throttler/throttler.module.ts`), backed by
      `CacheThrottlerStorage` (`src/common/throttler/cache-throttler-storage.ts`) — a
      `ThrottlerStorage` implementation over the existing `CacheService` (Redis in production,
      in-memory otherwise, same driver permission caching already uses), so no new
      infrastructure was introduced for this.
- [x] Add sync-batch limiting: 20 requests/minute/user. `@Throttle({ 'sync-batch': { limit: 20,
      ttl: 60_000 } })` on `POST /sync/batch` (`src/modules/sync/sync.controller.ts`).
- [x] Add media-presign limiting: 100 requests/minute/user. `@Throttle({ 'media-presign': {
      limit: 100, ttl: 60_000 } })` on `POST /media/presign` (`src/modules/media/media.controller.ts`).
- [x] Add report-export limiting: 10 requests/hour/user. Report exports fan out across 17
      routes behind one `ReportJobsService.create()` (`reports.controller.ts`'s `deliver()`),
      so rather than decorating every route this is a direct `CacheService.incr()` check
      (`assertExportRateLimit`, same fixed-window counter shape as `CacheThrottlerStorage`,
      hand-rolled because the two call sites want different return shapes) inside `create()`,
      throwing `AppException.tooManyRequests()` over the limit.
- [x] Retain the login phone+IP lockout behavior. Untouched — `LoginThrottleService`
      (`src/modules/auth/services/login-throttle.service.ts`) is a separate mechanism (lockout,
      not a rolling ceiling) and was not modified; `auth.e2e-spec.ts` still passes in full.
- [x] Return `429` with a correct `Retry-After` header and canonical error envelope. `429` was
      already mapped to `ErrorCode.RATE_LIMITED` via `AllExceptionsFilter`'s generic
      status-code fallback (pre-existing). Two additions this session:
      `AppException` gained an optional `headers` field and a `tooManyRequests()` factory
      (`src/common/errors/app.exception.ts`) so the report-export path can carry a
      `Retry-After` header on a thrown exception, and `AllExceptionsFilter.catch()`
      (`src/common/filters/all-exceptions.filter.ts`) now applies `resolved.headers` to the
      response before writing the JSON body. For the `@nestjs/throttler` path,
      `AppThrottlerGuard.throwThrottlingException()` (`src/common/throttler/app-throttler.guard.ts`)
      sets an **unsuffixed** `Retry-After` itself — the base guard suffixes it per named
      throttler (`Retry-After-media-presign`), which is correct for its own `X-RateLimit-*`
      headers but invisible to any client/proxy reading the registered `Retry-After` header.
- [x] Make limits work correctly behind the configured trusted proxy. `AppThrottlerGuard.getTracker()`
      tracks by authenticated user id (falling back to `request.ip` only for the one
      unauthenticated route this guard still runs on), and `request.ip` is already what
      `main.ts`'s `trust proxy` setting (`appConfig.trustProxy`) resolves it to — the same
      resolution the pre-existing phone+IP login lockout relies on, so this is correct behind
      the configured proxy for free rather than by new code.

**Test-suite safety valve**, the same idiom used for report/media sweeps this session:
`app.config.ts`'s `throttleEnabled` defaults **off** under `NODE_ENV=test` (dozens of e2e specs
share one seeded Director across hundreds of requests within a single Jest run — a real ceiling
tripping mid-suite would be an unreproducible flake) and only forces on via `THROTTLE_ENABLED=true`
in an isolated app instance.

**Verification:**
- New `test/rate-limiting.e2e-spec.ts` (2 tests) force-enables `THROTTLE_ENABLED=true` for its
  own `createTestApp()` instance and proves: the 21st `POST /sync/batch` call in a minute gets a
  `429` with `success: false`, `error.code: 'RATE_LIMITED'`, and a numeric, unsuffixed
  `Retry-After` header ≤ 60s; and that a second, distinct user (provisioned via `provisionUser`)
  is unaffected by the first user already being throttled, confirming tracking is per-user, not
  per-route-global or per-IP.
- `npm run typecheck` — clean. `npm run lint` — clean.
- `npm test` — 395/395 unit tests passed (37 suites).
- `DB_PASSWORD=localtest ./scripts/run-e2e.sh` — **558/558 e2e tests passed (20 suites)**, up
  from 556/19 before this subsection — confirming the newly-installed global
  `AppThrottlerGuard` broke nothing in the existing suite (thanks to `throttleEnabled` defaulting
  off under test) while the new dedicated spec proves the feature actually works when forced on.

### 4.3 Implement forced client upgrades — done 2026-09-08

- [x] Validate `MIN_CLIENT_VERSION` in backend configuration. `env.validation.ts`'s
      `EnvironmentVariables.MIN_CLIENT_VERSION` now requires a dotted `major.minor[.patch]`
      shape via `@Matches` when set (`@emptyToUndefined()` added alongside it — an unset `.env`
      entry is `''`, not `undefined`, and `@IsOptional()` only skips the latter; the same
      transform pattern this file already uses for `toNumber()`/`toBoolean()`).
- [x] Inspect `X-Client-Version` on mobile API requests. New `ClientVersionGuard`
      (`src/common/guards/client-version.guard.ts`), global via `APP_GUARD`.
- [x] Return HTTP 426 with `CLIENT_UPGRADE_REQUIRED` when below the minimum. Comparison via a
      new `src/common/utils/version.util.ts` (`isVersionBelow`, plain dotted-integer compare —
      not full semver, since neither side ever carries a pre-release/build suffix). The 426
      status was already the default for this code (`app.exception.ts`'s
      `DEFAULT_STATUS_BY_CODE`); the guard throws with both `params: { minVersion }` (message
      interpolation) and `extra: { minVersion }` (the top-level `error.minVersion` field plan
      `22` specifies).
- [x] Exempt health checks and any endpoints required to display/update the client safely. New
      `@SkipVersionCheck()` decorator (`src/common/decorators/skip-version-check.decorator.ts`)
      — deliberately separate from `@Public()`: the forced-upgrade check *should* still apply to
      `/auth/login`/`/auth/refresh`, since that is the one request a months-stale app is
      guaranteed to make before anything else, which is exactly where the blocking dialog needs
      to fire. Applied to `HealthController` (class-level) and to `MediaController`'s `GET/PUT
      /media/blob` (low-level object bytes, not an "app" request — a browser `<img>` tag or the
      local-disk adapter's raw PUT never sends the header).
- [x] Add version comparison and E2E tests. `ClientVersionGuard` is the very first global guard
      (`app.module.ts`, ahead of `JwtAuthGuard`) so a stale client is rejected before any
      auth/throttle/permission work runs. New `test/client-version.e2e-spec.ts` (7 tests): below
      minimum → 426 with the correct `error.code`/`error.minVersion`; at/above minimum →
      allowed; header omitted → allowed (recommended, not required, per plan `22`); a header
      that doesn't parse as a version → allowed (fail-open — this is a product nudge, not a
      security control); an unauthenticated `POST /auth/login` with a stale header → still 426,
      proving it runs ahead of authentication; `GET /health` with a stale header → still 200.

**Test-suite safety valve:** the committed `.env` ships `MIN_CLIENT_VERSION=` empty (feature
off) for the whole existing suite, same as `throttleEnabled`/`sweepEnabled`/`cleanupEnabled`;
the new spec forces it on (`MIN_CLIENT_VERSION=2.1.0`) for its own isolated `createTestApp()`
instance, set in `beforeAll` before that call and restored in `afterAll`.

**Verification:** `npm run typecheck` ✅ · `npm run lint` ✅ · `npm test` — 395/395 unit tests ✅
· `DB_PASSWORD=localtest ./scripts/run-e2e.sh` — **565/565 e2e tests across 21 suites** ✅ (up
from 558/20 before this subsection).

### 4.4 Implement metrics and operational health — done 2026-09-08

- [x] Implement `GET /metrics` in Prometheus format. New `MetricsModule`
      (`src/modules/metrics/`), backed by `prom-client` (the long-standing, battle-tested
      package; its very recent, minimal-adoption successor `@prometheus-io/client` was
      considered and rejected as too new to depend on for this). One process-wide `Registry`
      (`src/common/metrics/registry.ts`, with `collectDefaultMetrics` for free CPU/heap/event-loop
      metrics) and a set of module-level metric instances anything can `import`/`.inc()` with no
      DI wiring (`src/common/metrics/metrics.ts`) — deliberately *not* a service a caller
      injects, since the metric objects themselves have no dependencies.
- [x] Add request duration, error count, queue depth/failure, sync outcome, push delivery, report
      job, and media cleanup metrics.
      - Request duration/count/errors: `MetricsInterceptor` (`src/common/interceptors/`), global,
        labeled by method/matched-route-template/status code — the *template*
        (`/api/v1/machines/:id`), never the raw URL, so one caller hammering random paths cannot
        blow up label cardinality; an unmatched route is bucketed under the fixed label
        `'unmatched'`. Counts a thrown `AppException` too, since an interceptor's error channel
        fires before `AllExceptionsFilter` ever runs.
      - Queue depth: sampled at scrape time (Prometheus is pull-based) from each of the three
        BullMQ queues' live `getJobCounts()` — `depth()` added to `AuditQueueService`/
        `MediaOptimizeQueueService`/`ReportQueueService`, returning `null` when running inline
        (no broker) rather than a misleading `0`. Reading them from `MetricsController` required
        exporting the three services from their modules (previously private).
      - Queue failure: a counter increment alongside each queue's existing `worker.on('failed',
        ...)` log line.
      - Sync outcome: incremented once per operation in `SyncBatchService.process()`, labeled by
        operation type and the same `SyncOperationStatus` the client already sees.
      - Push delivery: incremented in `NotificationDispatcherService.recordPush()` — the one
        place every push attempt's final status (`SENT`/`FAILED`/`SKIPPED`) is written, whichever
        of the three exit paths in `deliverPushes()` got there.
      - Report job: incremented in `ReportJobsService.execute()`'s `READY` and `FAILED` branches,
        labeled by format.
      - Media cleanup: incremented in `MediaService`'s existing hourly sweep, alongside its
        pre-existing structured-log summary line.
- [x] Ensure `/health/ready` accurately checks PostgreSQL, Redis, and production object storage.
      Already true from section `3.1`/pre-existing work — `TypeOrmHealthIndicator.pingCheck`,
      `CacheHealthIndicator` (real `PING`), and `StorageHealthIndicator` (a genuine
      write-read-delete probe against whichever adapter is actually active, downgrading to
      unhealthy if production is somehow still on local disk). Verified as still correct; no
      change needed here.
- [x] Protect or network-restrict operational endpoints as appropriate. New `MetricsAuthGuard`
      (`src/modules/metrics/metrics-auth.guard.ts`) — a constant-time bearer-token check against
      `METRICS_TOKEN`, separate from the normal user JWT scheme since a Prometheus scraper has
      neither a session nor permissions. `env.validation.ts` hard-requires `METRICS_TOKEN` in
      production (same pattern as `S3_*`/`STORAGE_URL_SIGNING_SECRET`); left open outside it for
      a local Prometheus/curl during development. `/health` and `/health/ready` stay
      intentionally unauthenticated, as the plan's own comment on `HealthController` already
      says — an uptime monitor has no credentials to present either.

**Verification:** `npm run typecheck` ✅ · `npm run lint` ✅ · `npm test` — 397/397 unit tests ✅
(2 new, covering the `MIN_CLIENT_VERSION`/`METRICS_TOKEN` production-validation rules added
alongside this and `4.3`) · new `test/metrics.e2e-spec.ts` (4 tests: open-by-default scrape
contains the expected metric families including a default `prom-client` process metric; and,
with `METRICS_TOKEN` forced on for an isolated app instance, refuses no-token/wrong-token and
allows the correct one) · `DB_PASSWORD=localtest ./scripts/run-e2e.sh` — **569/569 e2e tests
across 22 suites** ✅ (up from 565/21 before this subsection).

**How to continue:** Section 4 is now fully complete. Section 5 (Backend delivery and
production operations) is next, starting at 5.1. Note before starting 5.3: this session's
`prom-client`-based `/metrics` (`4.4`) already covers metrics-based alerting inputs (queue
failure, high error rate via `http_request_errors_total`, media cleanup failures) — 5.3's
"Sentry or equivalent" is for *error-reporting* (stack traces or wire an alert rule against the
metrics already exposed), a genuinely separate, still-unstarted piece of work.

---

## 5. Backend delivery and production operations

### 5.1 CI and local quality gates — done 2026-09-08

**This repo had no git history at all before this session** — `.gitignore` and
`.github/workflows/backend-ci.yml` already existed (from an earlier session) but `git init` was
never run, so that workflow could never actually have executed. Per explicit user instruction:
initialized git, fixed `.gitignore`, and left everything staged/ready **without making the first
commit** — that is the user's to make. A private GitHub repo (`machinery-system`) is to be
created via `gh repo create` once the user finishes `gh auth login` interactively (not something
I can do on their behalf) — flagged to the user, not yet done as of this write-up.

- [x] Add CI for lint, typecheck, unit tests, build, migration validation, and E2E tests.
      `.github/workflows/backend-ci.yml` rewritten: the pre-existing version was missing
      `SEED_DIRECTOR_PASSWORD` (required by `src/database/seeds/seed-identity.ts` — without it
      `npm run e2e:db:reset`, and therefore every e2e spec, refuses to start) and set a
      `JWT_REFRESH_SECRET` env var that corresponds to no real setting (there is only
      `JWT_ACCESS_SECRET`) — both fixed. Steps, in order: install, lint, typecheck, no-TODO
      check, migration up/down/up check, unit tests, e2e tests, build, OpenAPI drift check.
- [x] Add Husky/pre-commit checks or document the chosen equivalent. Documented equivalent,
      not the Husky package itself: this is a two-language monorepo where `.git` lives two
      directories above the only `package.json` (`backend/api`'s), which does not fit Husky's
      assumption that they are the same directory. Instead: `scripts/git-hooks/pre-commit` (repo
      root, tracked) is installed into `.git/hooks/pre-commit` by
      `backend/api/scripts/install-git-hooks.sh`, wired to fire automatically from that
      package's `npm install` via a new `"prepare"` script — so `git clone` + `npm install` is
      the entire setup, the same promise Husky makes. The hook only gates the subtree(s) with
      staged changes: backend `*.ts` files run through `lint-staged` (`eslint --fix
      --max-warnings=0`, new devDependency), mobile `*.dart` files run through
      `dart format --set-exit-if-changed`. Deliberately does **not** also run `flutter analyze`
      in the hook — the mobile app currently has genuine, pre-existing analyzer errors (section
      `13`, Finance, is mid-build) unrelated to any given commit, so that stays a per-mobile-item
      gate (the working rules already require it) rather than a blanket pre-commit one.
      **Verified for real**: staged a clean backend file (hook passes, 0), staged one with a
      deliberate `no-explicit-any` violation (hook blocks, exit 1, file left untouched — nothing
      was ever committed), and staged a clean mobile `.dart` file (hook passes) — each reset
      immediately after, per "don't commit."
- [x] Fail CI on lint warnings, TypeScript `any`, unresolved TODOs, or OpenAPI drift.
      `no-explicit-any` was already an `eslint.config.mjs` *error* (not new); `npm run lint`
      itself now carries `--max-warnings=0` (`package.json`), so the three `warn`-level rules
      (unsafe assignment/member-access, missing explicit return types) fail the build too,
      locally and in CI alike — confirmed zero warnings exist today. New CI step greps
      `src`/`test` for `TODO|FIXME|XXX` (word-bounded, so it doesn't false-positive on the
      `01XXXXXXXXX` phone-format placeholder in a docstring) — confirmed clean today. OpenAPI
      drift: `buildOpenApiDocument()` extracted from `src/bootstrap/swagger.setup.ts` so a new
      `scripts/check-openapi-drift.ts` can build the exact same document (same prefix,
      versioning, `operationIdFactory`) without booting an HTTP listener, and diff it against
      the committed `openapi.json` — `npm run check:openapi` (CI's last step) / `npm run
      docs:generate` to update it. Regenerated `openapi.json` in this session (it had drifted —
      `setupSwagger`'s disk-write only ever fires from a real `main.ts` boot outside production,
      which nothing in the test/CI path does, so it silently goes stale between real server
      runs) and confirmed `check:openapi` now reports a match.
- [x] Verify every migration can apply and revert in a clean database. New
      `scripts/check-migrations.sh` (`npm run check:migrations`): creates a scratch database
      (never the dev or e2e one), runs all migrations up, reverts all 14 one at a time back to
      empty (confirmed via `SELECT count(*) FROM migrations` = 0, not just "the command exited
      0"), then runs them all up again — a `down()` that is missing, wrong, or that cannot
      re-apply cleanly after its own revert fails here. **Run for real against local Postgres in
      this session**: all 14 migrations applied, reverted one-by-one, and re-applied without
      error.

**Verification:** `npm run lint` ✅ (0 warnings) · `npm run typecheck` ✅ · `npm run build` ✅ ·
`DB_PASSWORD=localtest npm run check:migrations` ✅ (14/14 up→down→up) · `DB_PASSWORD=localtest
npm run check:openapi` ✅ · pre-commit hook manually exercised pass/fail/pass as described above.
Full unit (397/397) and e2e (569/569) suites re-confirmed green after these changes.

**Not yet done, tracked explicitly:**
- Creating the actual private GitHub repo and pushing — blocked on the user completing
  `gh auth login` interactively; `gh` (CLI) is installed and ready.
- The first git commit — intentionally left to the user per their explicit instruction.
- A mobile CI workflow was **not** added: 5.1 is scoped to the backend by its own section
  heading, and `flutter analyze` is not currently clean (see above), so a mobile CI workflow
  would be red on day one through no fault of a given PR. Revisit once section `13` (Finance) or
  the section `6` work below lands.

### 5.2 Load and concurrency testing — done 2026-09-08

**Found and fixed one real race** while building this (see below) — not a hypothetical, it
reproduced on the first attempt at a true-concurrency probe against real Postgres.

- [x] Add dedicated concurrent custody-transfer tests. A concurrent-**create** test already
      existed (`test/transfers.e2e-spec.ts`, "serializes concurrent dispatches of the same
      machine" — 5 concurrent `POST /transfers` for one machine, exactly 1 succeeds, backed by
      the existing `SELECT … FOR UPDATE` in `lockMachinesByIds`). New this session, in
      `test/concurrency-and-load.e2e-spec.ts`: the **confirm**-side equivalent — 5 concurrent
      `POST /transfers/:id/confirm` on the one transfer a representative is receiving, exactly 1
      returns 200, the machine ends up `WITH_REPRESENTATIVE` (never double-posted or left
      ambiguous), backed by the existing `lockTransfer`'s `pessimistic_write`.
- [x] Add a load scenario for 40 representatives syncing 20-machine batches. Implemented as 40
      concurrently-provisioned representatives, each pushing one `POST /sync/batch` of 20
      operations (800 total) — using `CREATE_MERCHANT` rather than literal machine transfers as
      the operation payload: provisioning 800 real machines through real custody chains just to
      generate load would be slow and fragile, and `POST /sync/batch` handling N concurrent
      20-item batches is the same code path regardless of which operation type fills them; the
      machine-custody-specific race is already covered by the dedicated tests above. **Result,
      recorded as the threshold**: 800/800 operations succeeded, 0 failures, ~700–800ms wall time
      on this development machine's local Postgres (asserted ceiling: under 30s — a generous
      smoke-level regression guard, not a tuned SLA, since CI/production hardware will differ).
- [x] Test triple replay of identical offline batches. New test sends one 3-operation batch
      three times **sequentially** with no `Idempotency-Key` (a truer simulation of "the device
      never saw the response and is retrying" than the HTTP-layer idempotency-key replay
      `1.3` already covers, which never re-executes business logic at all): attempt 1 succeeds on
      all 3 operations, attempts 2 and 3 both report `DUPLICATE` against the exact same
      `serverId`s as attempt 1, and the database ends with exactly 3 rows — not 6 or 9 — for
      those `client_uuid`s.
- [x] Define and record response-time/error-rate thresholds. Recorded in the new test file's
      top-of-file doc comment and above: 800-operation concurrent load in <30s with 0% error
      rate; every concurrency scenario tested (identical-write race, custody-confirm race) must
      produce 0% *unexpected* failures — every racing request must resolve to a well-defined
      outcome (the winner's success, or a clean `DUPLICATE`) rather than a bare error.
- [x] Fix any deadlocks, duplicate postings, or custody races found. **Found one**: a true
      concurrent replay of the identical offline operation (same `clientUuid`, two requests
      racing rather than one after the other) could lose the race between `SyncBatchService`'s
      own `findDuplicate()` pre-check and the underlying create service's insert — the loser's
      `INSERT` then hit the real `UNIQUE(client_uuid)` constraint (`1789700000000-OfflineSync.ts`)
      and surfaced as a raw `FAILED`/`INTERNAL_ERROR`/`RETRY` result instead of a clean
      `DUPLICATE`. No data was ever actually duplicated (the constraint did its job — this was a
      client-facing error-reporting bug, not a correctness bug), but a real offline client taking
      `RETRY` literally would burn an extra round trip only to hit the same race again. **Fixed**
      in `SyncBatchService.runOne()` (`src/modules/sync/sync-batch.service.ts`): catches a
      Postgres unique-violation (`23505`) specifically, re-runs the now-safe `findDuplicate()`
      read (the winner has since committed), and returns `DUPLICATE` with the winner's real id.
      Reproduced the bug against real Postgres before fixing it (10 concurrent identical pushes,
      ~1-in-3 runs showed at least one spurious `FAILED`) and confirmed 0 occurrences across 10
      further runs after the fix, plus a permanent regression test asserting no batch result may
      ever be a bare failure for this scenario.

**Verification:** `npm run typecheck` ✅ · `npm run lint` ✅ (0 warnings) · `npm test` —
397/397 unit tests ✅ · `DB_PASSWORD=localtest ./scripts/run-e2e.sh` — **573/573 e2e tests across
23 suites** ✅ (up from 569/22), including 4 new tests in `test/concurrency-and-load.e2e-spec.ts`
each re-run several times individually to confirm they are not flaky (the concurrency ones are
inherently timing-sensitive by nature).

### 5.3 Monitoring and error reporting — done 2026-09-08

**Found and fixed a second real, unrelated bug while verifying this session's work** (see below)
— a genuine timezone bug in every date-range report, caught only because this machine's local
clock happened to cross midnight mid-session. Full account in `backend/MONITORING.md`.

- [x] Integrate Sentry or the selected error-reporting service. `@sentry/node`
      (`src/common/observability/sentry.ts`), off unless `SENTRY_DSN` is set — the same "off
      unless configured" shape as every other optional integration this session touched. Reports
      every genuine 5xx (`AllExceptionsFilter`, never a 4xx — validation/permission failures are
      expected traffic, not incidents), every queue job that exhausted all 5 retries (audit-log,
      media-optimize, report-exports), the media-cleanup sweep's own failure, a swallowed
      notification-dispatch failure, and process-level `uncaughtException`/`unhandledRejection`
      (which never reach `AllExceptionsFilter` at all, since they are not HTTP-request-scoped).
- [x] Configure uptime monitoring for liveness and readiness. Nothing to provision from inside
      this repo — no uptime-monitoring account exists here to create one on the user's behalf —
      so this is the complete, ready-to-use spec instead: `backend/MONITORING.md` names exactly
      which endpoints (`/health`, `/health/ready`), poll intervals, and failure-count thresholds
      to configure in whichever service (UptimeRobot, Better Uptime, Pingdom, …) is chosen.
      `/health/ready` already runs genuine dependency probes (Postgres `pingCheck`, a real Redis
      `PING`, a real storage write-read-delete round trip) from earlier work — verified as still
      correct, not re-implemented.
- [x] Define structured-log retention and sensitive-data redaction. Verified **for real** rather
      than by reading the config: ran a live login + authenticated request through the app with
      `LOG_LEVEL=debug` and read the actual JSON log lines — the `Authorization` header is
      genuinely replaced with `[redacted]`, confirming `pinoHttp.redact` works as configured.
      Also discovered the pre-existing `req.body.password`/`req.body.newPassword`/
      `req.body.currentPassword` redact paths were **dead code**: pino-http's default request
      serializer never includes a body at all, so those paths were "redacting" a field that was
      never logged in the first place — removed them (no behavior change; they did nothing) and
      documented the real, current behavior — bodies are never logged, only method/URL/route/
      status/timing/redacted-headers — in `backend/MONITORING.md`, along with a recommended
      30-day-hot / 1-year-archived retention policy (host/platform configuration, not enforced by
      this repo, since it writes structured JSON to `stdout` only and does not manage log files).
- [x] Alert on failed queues, repeated sync failures, storage failure, and high API error rate.
      New `backend/alerting-rules.yml` (Prometheus rule file) covering the first, second, and
      fourth directly via `4.4`'s metrics (`MachineryQueueJobsFailing`,
      `MachinerySyncOperationsFailing` — a >10% ratio over 15 min, not a raw count, to filter out
      one user's isolated mistake — and `MachineryHighApiErrorRate` — 5xx-only, >5% over 5 min).
      "Storage failure" is deliberately **not** a `/metrics` counter — it is exactly what
      `GET /health/ready`'s uptime-monitor readiness check (above) already answers, and
      `backend/MONITORING.md` says so explicitly rather than inventing a redundant metric for it.
      A bonus fifth rule, `MachineryMediaCleanupFailing`, covers `3.3`'s cleanup sweep the same
      way. **Verified for real, not just `promtool`-syntax-checked**: installed a local
      Prometheus (`brew install prometheus`), pointed it at a real running instance of this API's
      `/metrics`, loaded the rule file, and confirmed via Prometheus's own `/api/v1/rules` and
      `/api/v1/targets` endpoints that the target scraped successfully and all 4 rules evaluated
      with `health: ok` (no PromQL/label errors) — then stopped and removed the temporary
      Prometheus instance and data directory.

**Bug found and fixed during this verification (unrelated to Sentry/metrics, discovered by
accident): every date-range report was silently dropping "today"'s data for roughly 3 hours a
day.** `resolvePeriod()` (`src/modules/reports/report-filters.ts`) computes the default 90-day
report window's boundaries as UTC calendar dates (`toDateOnly()`, `.toISOString().slice(0, 10)`),
but the raw-SQL report queries cast those date strings to Postgres `::date` and compare them
against `timestamptz` columns — an implicit cast that resolves at **midnight in the database
session's own timezone**, not UTC. This machine's Postgres session timezone defaults to the OS's
zone (`Africa/Cairo`, UTC+3), so for the ~3 hours after local midnight but before UTC's calendar
date catches up, the report's `to` boundary was a full day earlier than intended, silently
excluding every row created in that window. **Reproduced live**: `test/reports.e2e-spec.ts`
started failing 5 of its 66 tests, with zero code changes of mine touching reports, the moment
this session's wall clock crossed local midnight while UTC had not yet rolled over — confirmed
via `psql`'s own `now()` showing the exact 3-hour offset. **Fixed** by forcing every pooled
Postgres connection to a UTC session timezone (`extra: { options: '-c timezone=UTC' }` in both
`app.module.ts`'s runtime `TypeOrmModule.forRootAsync` and `src/database/data-source.ts`'s
CLI/migration connection), so `::date` casts and the app's own UTC-based date math always agree —
the standard fix for this class of bug (store and reason in UTC everywhere; convert to a
business/display timezone only at the edge, which this app already does separately for
notification quiet hours via `localUtcOffsetMinutes`). All 66 report tests pass again after the
fix, confirmed both immediately and across a full suite re-run.

**Verification:** `npm run typecheck` ✅ · `npm run lint` ✅ (0 warnings) · `npm test` —
404/404 unit tests ✅ (7 new, `src/common/observability/__tests__/sentry.spec.ts`, using
`jest.isolateModules()` so each case gets Sentry's module-level "initialized" state fresh rather
than leaking across tests) · `DB_PASSWORD=localtest ./scripts/run-e2e.sh` — **573/573 e2e tests
across 23 suites** ✅ · `DB_PASSWORD=localtest npm run check:migrations` ✅ ·
`DB_PASSWORD=localtest npm run check:openapi` ✅ (regenerated once more here — no new routes, but
`openapi.json` had drifted since `5.1`'s regeneration; confirmed stable/reproducible across
several repeated regenerations afterward) · `promtool check rules backend/alerting-rules.yml` ✅
· live local-Prometheus rule evaluation ✅ (see above).

### 5.4 Backup and recovery — done 2026-09-09

- [x] Configure nightly PostgreSQL backups. `backend/api/scripts/backup-db.sh`: `pg_dump -Fc -Z 9`.
      Scheduling (cron/systemd) documented in `backend/BACKUP_RECOVERY.md` §1; the script itself is
      scheduler-agnostic, matching how `5.1`'s CI and `5.3`'s alerting were kept host-config-free.
- [x] Configure point-in-time recovery where supported. Documented in `backend/BACKUP_RECOVERY.md`
      §3: managed-Postgres platforms (RDS/Cloud SQL/Supabase/Neon) get PITR from the platform
      itself — recommended for real deployments; self-managed Postgres needs continuous WAL
      archiving, full config given. Deliberately **not** demonstrated live against this project's
      shared local dev Postgres server — that would mean reconfiguring `archive_mode`/`wal_level`
      on an instance still in active use for unrelated work, for a feature with no dev-environment
      purpose; the documented procedure is the complete, correct spec for whoever provisions a real
      self-managed host.
- [x] Encrypt backups and define retention. `openssl enc -aes-256-cbc -pbkdf2 -salt`,
      `BACKUP_ENCRYPTION_KEY` env var only (fails closed — refuses to run without it, same pattern
      as `METRICS_TOKEN`/`SENTRY_DSN`). `BACKUP_RETENTION_DAYS` (default 35), pruned automatically
      on every run. Plaintext dump exists on disk only for the few seconds between dump and
      encrypt, then deleted unconditionally.
- [x] Document the restore procedure. `backend/BACKUP_RECOVERY.md` (new) — full nightly-backup
      scheduling, encryption/key-handling, PITR (managed + self-managed), retention, and a
      step-by-step incident restore procedure (`restore-db.sh` restores into a **new** database
      name only — refuses outright if the target name already exists, so a rehearsal or a real
      restore can never clobber a database still in use by accident).
- [x] Perform and record a real restore rehearsal. Executed for real against the local dev
      database (`machinery`: 9 users, 11 machines, 2 branches, 1 transfer, 8 migrations) — not a
      dry read of the scripts:
      1. `backup-db.sh` run for real → 192K AES-256-encrypted `.dump.enc` file produced.
      2. `restore-db.sh` run for real into a fresh `machinery_restore_rehearsal_20260909` database →
         `CREATE DATABASE` + `pg_restore` both completed with zero errors.
      3. Verified row-for-row: `users`/`machines`/`branches`/`transfers`/`migrations` counts
         identical on both sides (9/11/2/1/8), **and** an order-independent MD5 checksum of the
         entire `users` table's content (`SELECT md5(string_agg(t::text,'' ORDER BY id)) FROM users
         t`) was byte-identical between source and restored database
         (`d3324dee1b8281bdd0b5f8100fccbd21`), proving actual content fidelity, not just row counts.
      4. Cleanup: scratch database dropped, rehearsal backup file deleted. Non-destructive
         throughout — the source `machinery` database was never written to. Full narrative and the
         repeat-this-periodically recommendation recorded in `backend/BACKUP_RECOVERY.md` §6.

---

## 6. Flutter offline foundation — complete before more feature work — done 2026-09-09

Built against the **real** backend sync contract read from source (`backend/api/src/sync/*`), not
the plan file's more generic sketch — most notably, `SyncOperationType` has exactly four values
(`CREATE_TRANSFER`, `CONFIRM_TRANSFER`, `CREATE_MERCHANT`, `CREATE_FINANCE_TRANSACTION`; there is no
`uploadMedia` type). Media upload is a separate, independent mechanism (`POST /media/upload` with a
`clientUuid`) that the server resolves against queued operation payloads itself
(`collectMediaReferences`/`resolveClientUuids`), so the client never rewrites payloads to swap local
media ids for server ones.

The app's actual architecture (not the plan's aspirational one) is `flutter_bloc` Cubits + `get_it`
DI + `dartz` `Either<ServerFailure, T>` + manual JSON models — no freezed/json_serializable/
build_runner anywhere in this codebase, and no `datasources/` layer (repos talk to `Dio` directly
via `ApiService`). Everything below matches that, not the plan's sealed `ApiResult`/datasource-layer
sketch.

### 6.1 Create the local database

- [x] Add the Sqflite database bootstrap and schema versioning.
      `lib/core/local_db/app_database.dart` — `AppDatabase`, `currentVersion = 2`, a
      `Map<int, List<String>> _migrations` executed sequentially by one shared `_upgrade()` used by
      both `onCreate` (from version 0) and `onUpgrade`, so there is exactly one code path that ever
      runs schema SQL. `sqflite_common_ffi` added as a **dev dependency** so schema/DAO tests run
      for real against the Dart VM's sqlite instead of being skipped on desktop.
- [x] Add cached tables for lookups, branches, machines, merchants, pending transfers, and
      permissions. `cached_lookups`, `cached_branches`, `cached_machines`, `cached_merchants`,
      `cached_transfers` (permissions reuse the existing `PermissionService`/`LocalStorage`
      persistence, not a new table). Deliberate storage design: each row stores the exact server
      JSON blob plus a handful of indexed scalar columns (id, name/phone/shop_name, status,
      updated_at) rather than a fully normalized relational schema — chosen because the existing
      `*ResponseModel.fromJson()` parsers already tolerate both partial (list-row) and full-detail
      JSON shapes, so reconstructing entities from the stored blob via those same parsers needed no
      new parsing logic and can never drift from what the live API returns.
- [x] Add `sync_queue` and `pending_media` tables matching plan file `07`.
      `lib/core/local_db/daos/sync_queue_dao.dart` / `pending_media_dao.dart`, schema in
      `_v2SyncQueueAndMedia`. `sync_queue`: `client_uuid` (PK), `type`, `payload`, `occurred_at`,
      `created_at`, `attempt_count`, `last_attempt_at`, `next_retry_at`, `status`, `error_code`,
      `error_message`, `server_state`, `server_id`, `priority`, `depends_on`. `pending_media`:
      `client_uuid` (PK), `local_path`, `purpose`, `mime_type`, `size_bytes`, `checksum`,
      `upload_state`, `server_media_id`.
- [x] Add indexes needed for serial search, ownership, status, queue order, and retry time.
      `idx_cached_machines_serial`, `idx_cached_machines_holder`, `idx_cached_merchants_phone`,
      `idx_sync_queue_order (status, priority, created_at)`, `idx_sync_queue_next_retry
      (next_retry_at)` — the last two exist specifically so `SyncQueueService._nextReadyBatch()`'s
      scan doesn't degrade as the queue grows.
- [x] Implement safe schema migrations and migration tests.
      `test/local_db_schema_test.dart`: a real v1→v2 upgrade test seeds v1-shaped cached-reference
      data, runs `_upgrade`, and asserts both that the new `sync_queue`/`pending_media` tables exist
      **and** that the pre-existing v1 data survived untouched — not just that `onCreate` builds a
      fresh v2 database correctly.

### 6.2 Implement DAOs and local-first repositories

- [x] Create DAOs for every cached entity, sync operations, and pending media.
      `lib/core/local_db/daos/`: `cached_machines_dao.dart`, `cached_merchants_dao.dart`,
      `cached_branches_dao.dart`, `cached_lookups_dao.dart`, `cached_transfers_dao.dart`,
      `sync_queue_dao.dart`, `pending_media_dao.dart`.
- [x] Change supported read repositories to render from the database rather than directly from Dio.
      `MachinesRepoImpl`, `MerchantsRepoImpl`, `TransfersRepoImpl` (incoming scope only — see below)
      rewritten to a "network-when-connected, cache-fallback-when-offline-or-failed" pattern: try
      the live call first (existing online UX is unchanged), write the response through to cache on
      success, and fall back to the cached DAO on `DioException`/`OfflineFailure`/generic error.
      Deliberately **not** the plan's literal "always read cache first, then reconcile" — the
      existing cubits weren't built for a two-phase cache-then-network emission, and network-first
      keeps zero risk to already-shipped online behavior while still satisfying the acceptance
      criterion ("network can be disabled, and supported screens still render").
      `TransfersRepoImpl.fetchTransfers`: only `TransfersScope.incoming` (the hand-offs waiting on
      this rep's signature) is cached — `outgoing`/`all` return `OfflineFailure` when offline. This
      is deliberate, not an oversight: `incoming` is the only scope a rep needs to *act* on offline
      (confirm a hand-off), and caching every scope would mean caching data this app has no offline
      write path for anyway.
- [x] Save network results transactionally before exposing them to the UI.
      Every write-through uses `Dao.upsertOne()`/`upsertAll()`, which runs as a single `Batch`
      commit (`_db.batch()...commit(noResult: true)`) — a fetch can never leave the cache
      half-written.
- [x] Preserve cached data during temporary network failures.
      Verified live (see acceptance evidence below): with the emulator's wifi and mobile data both
      disabled (`adb shell svc wifi disable` / `svc data disable`, confirmed via
      `dumpsys connectivity | grep -c NetworkAgentInfo` returning `0` — the `airplane_mode_on`
      settings-broadcast approach was tried first and rejected by Android with a
      `SecurityException: Permission Denial`, so this pair of `svc` calls is the one that actually
      works from `adb shell`), machines/merchants/incoming-transfers screens continued rendering
      from cache with the `OfflineBanner` visible.
- [x] Replace `EmptyPendingSyncCounter` with the real queue-backed implementation.
      `SyncQueueService implements PendingSyncCounter`, composed with the pre-existing finance queue
      via `CompositePendingSyncCounter` — see 6.4 for why the two queues are not merged.

### 6.3 Consume bootstrap and delta sync

- [x] Implement `/sync/status` schema-version checking.
      `SyncApi.status()` → `SyncCoordinator._pullLatest()` compares the server's `schemaVersion`
      against `LocalStorage.getSchemaVersion()`; a mismatch (or no stored version at all) forces a
      full `_runBootstrap()` instead of a delta.
- [x] Implement `/sync/bootstrap` consumption on initial authenticated setup.
      `SyncApi.bootstrap()` / `SyncCoordinator._runBootstrap()`. `SyncApi.parsePull()` (made a
      public static method specifically so it is unit-testable outside the Dio client) parses the
      full payload shape: `lookups` (7 categories), a separate top-level `branches` field (branches
      are cached via their own DAO, not folded into the `lookups` map — a real bug caught by a test
      that assumed otherwise, fixed by giving `SyncPullResult` its own `branches` field), plus
      `myMachines`/`myMerchants`/`pendingTransfers`/`permissions`/`deleted`/`schemaVersion`/
      `serverTime`.
- [x] Implement `/sync/delta` using a durable cursor.
      `LocalStorage.getLastSyncedAt()`/`setLastSyncedAt()`. Bootstrap has no `nextSince` of its own —
      its `serverTime` **is** the correct starting cursor for the very next delta call, which
      `_applyPull()` accounts for explicitly (`result.nextSince ?? result.serverTime`).
- [x] Apply updates and deletions transactionally.
      `SyncCoordinator._applyPull()` upserts every changed row and then deletes every id in
      `result.deleted*`, per entity, each via one DAO batch call.
- [x] Refresh cached permissions and force the navigation UI to react.
      `_applyPull()` calls `permissionService.update(result.permissions)` on every pull (not only
      bootstrap) — this is what lets a Director's permission change reach an already-offline device
      the moment it next gets a signal, without waiting for the next explicit login. Also wired into
      `LocaleService.registerCacheInvalidator`: an Arabic/English switch drops every cached
      name-bearing table and forces a re-bootstrap, since a mixed-language cache is worse than a
      brief reload.
- [x] Add manual refresh, reconnect, foreground, and periodic sync triggers.
      `SyncCoordinator.start()`: `Connectivity().onConnectivityChanged` → flush on reconnect;
      `AppLifecycleListener.onResume` → flush + restart the periodic timer; a 15-minute
      `Timer.periodic` while foregrounded catches flaky connections a push/pull wouldn't otherwise
      notice dropped. A real bug was caught and fixed here during live testing: every one of these
      triggers fires regardless of whether anyone is signed in, including at first app launch on the
      login screen — an unauthenticated `/sync/bootstrap` call returned a real backend `401`, which
      tripped the app's global `UnauthorizedSessionHandler` and popped a bogus "session expired"
      dialog *on the login screen itself*. Fixed by adding
      `if ((await LocalStorage.getAccessToken()).isEmpty) return;` as the first line of `flush()`;
      verified fixed by clearing app data and relaunching — the dialog no longer appears.

### 6.4 Implement the write queue

- [x] Create typed `SyncQueueItem` payloads with `clientUuid`, idempotency key, dependencies,
      `occurredAt`, attempts, next retry, and status.
      `lib/core/services/sync/sync_queue_item.dart` — `clientUuid` doubles as the batch idempotency
      key (matches backend's `SyncBatchDto` item shape exactly), plus `dependsOn` (media
      `clientUuid`s this operation is gated on), `attemptCount`, `nextRetryAt`, `status`
      (`SyncItemStatus`, extended this section with a new `conflict` value).
- [x] Queue supported writes locally before attempting upload.
      `MerchantsRepoImpl._queueCreateMerchant()`, `TransfersRepoImpl._queueCreateTransfer()` /
      `_queueConfirmTransfer()`: when offline, each writes an optimistic row into the relevant
      cache DAO (keyed by the client-generated UUID), enqueues the matching `SyncQueueItem`, and
      calls `syncCoordinator.notifyChange()` so any listening UI (the sync summary bar) updates
      immediately without waiting for a flush.
- [x] Push ordered operations to `/sync/batch`.
      `SyncQueueService.pushPending()` → `_nextReadyBatch()` (FIFO, respects `nextRetryAt` and
      media-dependency gating, capped at the backend's `@ArrayMaxSize(50)`) → `_pushOneBatch()` →
      `SyncApi.pushBatch()`.
- [x] Implement exponential backoff and retry classification.
      `_backoffSchedule = [1m, 5m, 15m, 1h, 6h]` (capped), `_maxAutoRetries = 10`.
      `_applyResult()` handles all four `SyncBatchOutcome`s: `SUCCESS`/`DUPLICATE` clear the item,
      `CONFLICT` is kept and marked `conflict` (never auto-retried — always surfaced for manual
      resolution), `FAILED` branches on the server's `SyncResolution` (`RETRY` schedules backoff up
      to the cap then gives up to `failed`; `DISCARD` fails immediately). Unit-tested in
      `test/sync_queue_service_test.dart` for every one of these transitions, including the
      max-retries-exhausted case.
- [x] Resolve local IDs/media references to server IDs.
      Handled entirely server-side: the app sends the operation payload with a bare `clientUuid` for
      any referenced media, and the backend's `resolveClientUuids` resolves it against
      already-uploaded media rows — confirmed against backend source, no client-side payload
      rewriting exists or is needed.
- [x] Ensure replaying the same queue does not duplicate records.
      **A real duplication bug was found live and fixed this section**, not just guarded against in
      theory. `_applyResult()` originally assumed the row a successful push produced would
      "overwrite" the optimistic cache entry on the very next pull — false, because the optimistic
      row is keyed by the client-generated `clientUuid` while the pull upserts by the **server's**
      id, a different primary key. Caught live: created a merchant offline, reconnected, and found
      **two** rows for the same merchant in `cached_merchants` (one under each id) even though
      `sync_queue` correctly emptied and the backend correctly held only one row. Fixed by having
      `SyncQueueService._applyResult()` explicitly delete the optimistic row
      (`cachedMerchantsDao.deleteByIds([item.clientUuid])` / `cachedTransfersDao...`) for the two
      operation types that create one, on `SUCCESS`/`DUPLICATE`, before deleting the queue item
      itself. `CONFIRM_TRANSFER`/`CREATE_FINANCE_TRANSACTION` never create such a row, so nothing
      further is needed for them. Added a regression test
      (`sync_queue_service_test.dart`: "a SUCCESS on CREATE_MERCHANT drops the optimistic cache row,
      not just the queue item") and **re-verified live end-to-end after the fix**: repeated the
      exact same offline-create → reconnect cycle with a second test merchant — `cached_merchants`
      held exactly one row, matching exactly one row in the real Postgres `merchants` table, with
      `sync_queue` empty.

### 6.5 Implement offline media staging

- [x] Persist captured files under an app-owned directory.
      `lib/core/services/sync/media_staging_service.dart` — `MediaStagingService.stage()` copies the
      captured file into local app storage and records a `PendingMediaItem` row.
- [x] Store checksum, purpose, MIME type, size, parent operation, and upload state.
      `pending_media` columns: `checksum`, `purpose`, `mime_type`, `size_bytes`,
      `upload_state` (`MediaUploadState`: staged/uploading/uploaded/failed), `server_media_id`. The
      "parent operation" link is the reverse relationship: a `SyncQueueItem.dependsOn` list of media
      `clientUuid`s, not a column on `pending_media` itself.
- [x] Upload media before operations that reference it.
      `SyncCoordinator.flush()` always runs `mediaStaging.uploadAllPending()` before
      `syncQueueService.pushPending()`; `SyncQueueService._dependenciesReady()` additionally refuses
      to push any operation whose `dependsOn` media isn't yet `uploaded`, so a photo/signature upload
      racing a slow connection can never let the referencing operation go out ahead of it. Unit
      tested (`sync_queue_service_test.dart`, "an item depending on an unfinished media upload is
      not pushed yet").
- [x] Resume interrupted uploads.
      `MediaStagingService.uploadAllPending()` re-scans every `staged`/`failed`-transient row on each
      flush call (triggered by reconnect/resume/periodic timer), so an upload interrupted mid-flight
      is simply retried on the next trigger rather than needing explicit resume logic.
- [x] Remove staged files only after the server operation succeeds.
      `SyncQueueService.delete()` (used both for the sync-queue screen's explicit delete action and
      as part of the 6.4 duplication-fix's queue-item cleanup path) cascades to
      `mediaStaging.deleteStaged()` for every `dependsOn` entry — deletion only ever follows a
      terminal queue outcome, never happens speculatively.
- [x] Clean abandoned local media safely.
      Same cascade as above covers the abandoned case: if the operation that depended on a piece of
      staged media is discarded (`FAILED` + `DISCARD`, or a user's explicit delete on a `conflict`/
      `failed` item), the media it depended on and nothing else references is cleaned up with it.
      Unit tested (`sync_queue_service_test.dart`, "deleting a queue item also cleans up any media it
      depended on" — asserts both the DB row and the actual file on disk are gone).

### 6.6 Implement sync conflicts and UI

- [x] Build the real sync-queue screen.
      `lib/feature/sync/`: `SyncQueueCubit`/`SyncQueueState` (data/logic), `SyncQueueScreen`,
      `SyncQueueTile`, `SyncConflictDialog`. Reachable from the pre-existing "More" tab tile (whose
      `onTap` previously pointed at a placeholder `_openNotReady(...)`, now
      `AppRoute.goToSyncQueue`) and from tapping the new `SyncSummaryBar`.
- [x] Show pending, syncing, retryable, blocked, conflict, and completed states.
      `SyncItemStatus` extended with `conflict` (`{pending, inFlight, failed, conflict, synced}`);
      `SyncStatusBadge`'s three switch expressions (label/color/icon) updated for the new case.
      `SyncQueueTile` renders attempt count and the last error for `failed`/`conflict` rows.
- [x] Implement blocking conflict dialogs with server state and explicit resolution actions.
      `SyncConflictDialog.show()` (built on the existing `AppConfirmDialog`) surfaces the server's
      `serverState` payload and offers only explicit actions — view details or discard — never an
      auto-retry option for a `conflict` row.
- [x] Never resolve custody or signed-transfer conflicts silently.
      Structural, not just UI-level: `SyncQueueService._applyResult()` routes every `CONFLICT`
      outcome to `SyncItemStatus.conflict` unconditionally — there is no code path from `CONFLICT` to
      `pending`/auto-retry. The only way a `conflict` item leaves that state is the user's explicit
      "retry now" (which simply clears backoff and re-attempts — if the server-side blocker is still
      there it will conflict again) or explicit delete.
- [x] Connect `OfflineBanner` and `SyncStatusBadge` to live state.
      `OfflineBanner` already existed and reacts to `networkConnectionStatus`, itself now fed by
      `SyncCoordinator.start()`'s `Connectivity().onConnectivityChanged` subscription. New
      `SyncSummaryBar` (`lib/core/shared_widgets/sync_summary_bar.dart`) added below it in
      `MainScaffold`, listening to `SyncCoordinator.onChange` for pending count + conflict indicator,
      renders nothing when the queue is empty (same "no permanent chrome for an unused feature"
      pattern as `OfflineBanner`).
- [x] Warn accurately about pending work during logout.
      `PendingSyncCounter` binding rebuilt as `CompositePendingSyncCounter([SyncQueueService,
      FinanceSyncQueue])` — sums both queues into the one number the pre-existing logout-warning
      dialog needs, without merging the new general-purpose queue with the pre-existing, separately
      shipped and tested `FinanceSyncQueue` (`CREATE_FINANCE_TRANSACTION` keeps its own queue; that
      feature is section 13, out of this section's scope, and merging would have meant re-testing
      already-working finance sync code for no behavioral gain).

Acceptance:

- [x] Bootstrap completes, the network can be disabled, and supported screens still render.
      Verified live end-to-end against a real backend and a real Android emulator (not just unit
      tests): logged in as the seeded Cairo representative (`01000000003`), confirmed a real
      `/sync/bootstrap` call, then pulled the on-device sqlite file
      (`adb shell run-as com.machinery.machinery cat .../machinery_local.db`) and inspected it with
      `sqlite3` directly — 4 cached machines with correct `holder_type`/`holder_id`, 2 branches, 25
      lookups across 5 categories, matching what that representative should see. Then disabled the
      emulator's wifi and mobile data (`svc wifi disable` / `svc data disable`, verified via
      `dumpsys connectivity | grep -c NetworkAgentInfo` → `0`) and confirmed the Merchants,
      Machines, and incoming-Transfers screens continued rendering from cache with the
      `OfflineBanner` correctly showing "أنت شغال أوفلاين".
      Along the way, found and fixed one genuinely pre-existing, unrelated backend bug that blocked
      this verification until resolved: the local dev Postgres database had 7 unapplied TypeORM
      migrations (`npm run migration:show` listed them; `GET /auth/me` was failing with
      `relation "audit_logs" does not exist` then `column User.preferred_locale does not exist`).
      Fixed with `npm run migration:run` (all 7 applied cleanly) — a dev-environment drift issue, not
      a defect introduced by this section's work.
- [x] An offline write can be queued, survive restart, reconnect, sync once, and disappear from the
      pending queue without duplication.
      Verified live, twice, including the exact "survive restart" wording:
      1. **Offline write + reconnect + no duplication** (after the 6.4 bug-fix above): created a
         merchant while genuinely offline via the real registration form → confirmed the optimistic
         row and a `CREATE_MERCHANT` `sync_queue` row on disk, both keyed by the same client UUID →
         re-enabled connectivity → confirmed via the on-device sqlite file **and** a direct
         `psql` query against the real `machinery` Postgres database that exactly one merchant row
         existed, `sync_queue` was empty, and the app's UI showed no duplicate list entry.
      2. **Survives an actual process restart** (not just cold-start-after-`pm clear`, which is a
         different, weaker claim): with the app still logged in and the emulator genuinely offline,
         created another merchant, confirmed the queue row on disk, then `adb shell am force-stop`'d
         the app process outright (and separately, restarted the Android emulator process itself)
         before ever going back online. Relaunching showed the sync summary bar still reporting "1
         في انتظار المزامنة" and the identical `client_uuid` row still present in `sync_queue` on
         disk — proving the queue is genuinely durable across process death, not merely
         in-memory-plus-lucky-timing. Re-enabling connectivity then flushed it automatically on
         launch: `sync_queue` emptied, and `psql` confirmed exactly one corresponding row in the real
         backend database.
      A third scenario (offline transfer creation exercising the `dependsOn` media-gating path) was
      attempted live but the "attach a machine" step requires scanning a real QR/barcode with no
      manual-entry fallback in the UI, which isn't reproducible in an emulator without external
      tooling; that path is instead covered by the dedicated unit test in
      `sync_queue_service_test.dart` ("an item depending on an unfinished media upload is not pushed
      yet"), which exercises the identical `SyncQueueService`/`_applyResult` machinery the two live
      merchant runs above already proved end-to-end.

Verification commands run: `flutter analyze` (0 issues) · `flutter test` (**102/102 passing**,
including 20 new tests added this section across `local_db_schema_test.dart` (5),
`sync_contract_parsing_test.dart` (6), and `sync_queue_service_test.dart` (9, incl. the 6.4
duplication regression test)) · repeated on-device sqlite inspection via
`adb shell run-as com.machinery.machinery cat .../machinery_local.db` + `sqlite3` · direct `psql`
queries against the real local `machinery` Postgres database to confirm server-side state
independent of what the app itself reports.

---

## 7. Flutter home dashboard — done 2026-09-09

Every tile reuses the same repository its own feature tab already uses (`MachinesRepo`,
`TransfersRepo`, `MerchantsRepo`, `ViolationsRepo`, `FinanceRepo`), called with `limit: 1` and read
only for `meta.total` — so a tile's number is always exactly what tapping through to that screen
would show, and each tile inherits that repository's own already-tested network-first/cache-fallback
behaviour for free instead of a second, subtly different implementation of it. Maintenance has no
repository yet (section 11 is not built), so its tile reads the same `GET /maintenance-orders` list
endpoint directly through `ApiService` for its `meta.total` alone. Section 6 only mirrors
machines/transfers/merchants locally, so violations/maintenance/finance/budgets have no offline
story — the dashboard says so plainly (`غير متاح دون اتصال` / "Unavailable offline") instead of
guessing.

- [x] Replace the Home placeholder with the planned dashboard.
      `nav_tabs_builder.dart`'s `_buildHome()` returned a `NavPlaceholderPage` (a static empty-state
      widget with no data). It now returns `HomeDashboardScreen` wrapped in its own
      `BlocProvider<HomeDashboardCubit>`. The now-unused `NavPlaceholderPage` widget was deleted
      (nothing else referenced it — confirmed with a repo-wide grep before removing).

- [x] Implement permission-driven dashboard blocks for Director, supervisor, representative, and
      accountant access patterns without hardcoded role checks.
      `HomeDashboardCubit.load()` gates every one of the seven tiles on a `PermissionService.has(...)`
      check (`P.machinesRead`, `P.transfersRead`, `P.merchantsRead`, `P.violationsRead`,
      `P.maintenanceRead`, `P.financeRead` for both the finance and budgets tiles — there is no
      separate `budgets.read` permission, matching how the Finance tab itself gates its own budget
      alerts card). A permission the caller lacks leaves that field `null` in `HomeDashboardLoaded`,
      which `HomeDashboardScreen` reads as "do not render this card" — never as a failure — and the
      repo method for that tile is never even called (verified in
      `home_dashboard_cubit_test.dart`: `repo.merchantsCalls == 0` etc. for a representative-shaped
      permission set). No role name (`SystemRole.DIRECTOR`, `"representative"`, ...) appears anywhere
      in the dashboard code; only permission strings do. Live-verified against the real backend with
      two real seeded accounts holding genuinely different permission sets (below).

- [x] Add machine, transfer, merchant, violation, maintenance, finance, and budget summary blocks as
      permitted.
      - **Machines** — `MachinesRepo.fetchMachines(limit: 1).meta.total`, labelled "in your scope"
        (the server already narrows this to one branch unless the caller holds `machines.read.all`,
        so the number is never pretended to be "the whole fleet").
      - **Transfers** — `TransfersRepo.fetchTransfers(scope: incoming, limit: 1).meta.total`,
        labelled "awaiting your signature" — the one transfer scope section 6's cache also holds, so
        this tile is the one that stays meaningful with no connection.
      - **Merchants** — `MerchantsRepo.fetchMerchants(limit: 1).meta.total`, "in your scope".
      - **Violations** — `ViolationsRepo.fetchViolations(statuses: [OPEN], limit: 1).meta.total`. No
        `userId` is passed — the backend's `GET /violations` already auto-scopes a caller without
        `violations.read.all` to just their own record (confirmed by reading
        `violations.controller.ts`: "a representative always sees his own file"), so the number is
        correct for both a rep and a supervisor from the same query.
      - **Maintenance** — direct `GET /maintenance-orders?status=OPEN,IN_PROGRESS,RETURNED&limit=1`
        (mirrors the backend's own `OPEN_MAINTENANCE_STATUSES`), read for `meta.total`. No feature
        screen exists for this yet, so tapping the tile opens the same `FeatureNotReadyScreen`
        placeholder the "Notifications" tile in More already uses for an unbuilt feature, named
        "Maintenance" (`LocaleKeys.homeMaintenanceTitle`) rather than pretending a real screen exists.
      - **Finance** — `FinanceRepo.summary(const FinanceQuery())`, showing net (coloured by sign) with
        income/expense as the caption — the exact same call and default period the Finance tab itself
        uses with no filter applied.
      - **Budgets** — `FinanceRepo.budgetStatus(const FinanceQuery())`, showing
        `warningCount + exceededCount`, colour-escalated to danger when any budget is exceeded — reuses
        the same numbers the Finance tab's own "Budget alerts" card computes.
      Each tile is one `HomeBlock<T>` (`lib/feature/home/domain/entities/home_block.dart`): a small
      sum type over `loading | ready(data, isFromCache) | offline | error(message)`, so the widget
      layer never has to guess what a `null`/`0`/empty value means.

- [x] Add permission-filtered quick actions.
      `HomeQuickActions` renders a `Wrap` of buttons built from a list `HomeDashboardScreen` assembles
      per-permission: "Scan a code" (`machines.read`), "New transfer" (`transfers.create`), "Register
      merchant" (`merchants.create`), "Register a machine" (`machines.create`), "Add transaction"
      (`finance.create`) — reusing the exact same button labels (`LocaleKeys.scanTitle`,
      `transferCreateTitle`, `merchantRegisterTitle`, `machineAddTitle`, `financeAddTransaction`) and
      navigation targets (`AppRoute.goToScanner`/`goToCreateTransfer`/`goToMerchantForm`/
      `goToMachineForm`, and `TransactionFormScreen` pushed directly) that the corresponding feature
      screens already use, rather than inventing a second set of strings/routes. An empty list (a
      read-only/auditor role with none of these five permissions) renders nothing at all — no empty
      "Quick actions" header — proven by a dedicated widget test.

- [x] Render cached data offline with last-updated information.
      Because every list-backed tile goes through the feature's own repository, the *existing*
      network-first/cache-fallback logic from `6.2` already does this — the dashboard did not need a
      second cache-reading path. `HomeRepoImpl` records `wasOffline` (checked once, right before the
      call) and marks the returned `HomeBlock.ready(..., isFromCache: wasOffline)`. `HomeBlockCard`
      then shows `LocalStorage.getLastSyncedAt()` formatted via the existing `Formatters.relative()`
      ("Updated 6 minutes ago" / "آخر تحديث من 6 دقيقة") **in place of**, not stacked under, the
      normal "in your scope" subtitle — live testing on a real grid cell caught that showing both
      lines at once overflowed a two-column card by 8px; the fix (one caption line, last-updated wins
      when present) is also pinned by a widget test so it cannot regress silently. Violations,
      maintenance, finance and budgets have no cache to fall back to (by section 6's own design) and
      say `Unavailable offline` instead of showing a stale or fabricated number.

- [x] Add pull-to-refresh and partial-failure handling.
      The whole screen is one `RefreshIndicator` (`AlwaysScrollableScrollPhysics` so the pull works
      even when the loaded content is shorter than the viewport) calling `HomeDashboardCubit.load()`,
      which re-fetches every permitted tile concurrently via a 7-way record `.wait` and always
      resolves to a `HomeDashboardLoaded` — one tile's failure/offline result never blocks or discards
      another's success, because `HomeRepoImpl`'s methods never throw and never return a bare
      `Either` the cubit would have to short-circuit on. A tile that came back `error` also gets its
      own inline retry icon (`HomeDashboardCubit.retry(HomeBlockKind)`) that re-fetches only that one
      tile and leaves the other six state fields untouched — proven directly in
      `home_dashboard_cubit_test.dart` (`identical(afterRetry.machines, machinesBeforeRetry)`) rather
      than merely asserting the visible number was right.

- [x] Add RTL/LTR widget tests for the main role/permission combinations.
      Bootstrapping real `easy_localization` inside a `flutter_test` widget test was tried first
      (`EasyLocalization.ensureInitialized()` + a full `MaterialApp` tree) and hung for the entire
      10-minute test timeout — no asset-bundle I/O completes inside the plain test binding, which is
      also presumably why nothing else in this test suite attempts it. Rather than accept that cost,
      `HomeBlockCard` was refactored to take every string it shows — including the offline notice and
      the retry tooltip — pre-resolved from the caller, the same way its `title`/`subtitle`/
      `errorMessage` already worked; it now carries no localization dependency of its own and is cheap
      to mount directly. RTL vs LTR is exercised the same way `report_phone_layout_test.dart` exercises
      a phone viewport: wrap the widget in the exact ambient condition being tested
      (`Directionality(textDirection: ...)`) and nothing more — 5 widget tests × 2 directions in
      `home_block_card_widget_test.dart` (loading/ready/offline/error rendering, tap and retry
      callbacks) and 3 × 2 in `home_quick_actions_widget_test.dart` (a representative-shaped action
      list, an empty list for a role with no create permission, and a Director-shaped full list).
      Permission-combination coverage that needs the real permission/repo wiring — which blocks a
      Director vs. a representative vs. a no-permissions role actually get fetched, and that one
      tile's failure never touches another's data — lives in `home_dashboard_cubit_test.dart` instead,
      against a fake `HomeRepo` and a real `PermissionService` backed by `SharedPreferences`'
      mock-values API (`SharedPreferences.setMockInitialValues`), covering: full-permission set (all 7
      tiles fetched and ready), machines+transfers-only set (exactly those 2 fetched, the other 5
      repo methods never called), zero-permission set (all 7 fields `null`, no crash), one tile
      offline while the other six stay ready, and a per-tile retry leaving the untouched tiles
      `identical`.

**Files added**: `lib/feature/home/` (`domain/entities/home_block.dart`, `home_summaries.dart`;
`domain/repos/home_repo.dart`, `home_repo_impl.dart`; `data/logic/home_block_kind.dart`,
`home_dashboard_cubit.dart`, `home_dashboard_state.dart`; `presentation/pages/home_dashboard_screen.dart`;
`presentation/widgets/home_block_card.dart`, `home_quick_actions.dart`); tests
`test/home_dashboard_cubit_test.dart`, `test/home_block_card_widget_test.dart`,
`test/home_quick_actions_widget_test.dart`.

**Files changed**: `lib/feature/nav_bar/presentation/helpers/nav_tabs_builder.dart` (`_buildHome`);
`lib/core/di/service_locator.dart` (`HomeRepo`/`HomeDashboardCubit` registration);
`lib/core/constants/locale_keys.dart` + `assets/translations/{en,ar}.json` (new `home_*` keys, reusing
existing keys — `nav_machines`, `nav_transfers`, `nav_merchants`, `nav_finance`, `violations_title`,
`finance_budgets`, `scan_title`, `transfer_create_title`, `merchant_register_title`,
`machine_add_title`, `finance_add_transaction` — everywhere a block/action title duplicates an
existing screen's own title, rather than adding a second string for the same concept).

**Files deleted**: `lib/feature/nav_bar/presentation/widgets/nav_placeholder_page.dart` (dead once
Home no longer used it; nothing else did).

**Live verification** (real backend, real Android emulator, both directions of the offline test from
`6`'s Acceptance criteria repeated here for the new screen specifically):
- Logged in as the seeded dev Director (`01000000001` / `Dev#12345`, full permission set). All seven
  tiles rendered with real numbers matching the actual database (10 machines, 21 merchants, 1 open
  violation, 0 pending transfers, `ج.م 0.00` net, 0 open maintenance orders, 0 budget alerts) and all
  five quick actions were visible. Tapped the Machines tile → pushed the real `MachinesListScreen`
  showing exactly 10 rows. Tapped the Maintenance tile → opened the "still being built" placeholder.
- Disabled wifi+data on the emulator (`svc wifi disable`/`svc data disable`, confirmed via
  `dumpsys connectivity | grep -c NetworkAgentInfo` returning `0`) and force-restarted the app
  process. Machines/Transfers/Merchants tiles kept their last-known numbers and each showed "Updated
  X minutes ago"; Violations/Maintenance/Finance/Budgets all showed "Unavailable offline" with the
  cloud-off icon — exactly the split the design intends, not a blanket offline screen. Re-enabled the
  network and restarted again: all seven tiles returned to live `ready` values.
- Confirmed via `adb logcat` that a pull-to-refresh gesture produces a fresh, correctly-parameterised
  batch of all seven requests (`machines?limit=1`, `transfers/pending/incoming?limit=1`,
  `merchants?limit=1`, `violations?limit=1&status=OPEN`,
  `maintenance-orders?limit=1&status=OPEN&status=IN_PROGRESS&status=RETURNED`, `finance/summary`,
  `finance/budgets/status`) within about a second of the gesture — an earlier attempt to eyeball this
  from screenshots looked like the refresh was doing nothing, which turned out to be because the dev
  database's numbers for that account do not change between refreshes, not a bug.
- Logged out and back in as the seeded dev representative (`01000000003` "مندوب القاهرة",
  branch-scoped, holding `machines.read`/`transfers.read`/`merchants.read`/`violations.read`/
  `transfers.create`/`merchants.create` but not `machines.create`, `finance.*`, or `maintenance.read`).
  The same build produced exactly four tiles (Transfers, Machines, Violations, Merchants — Finance,
  Budgets and Maintenance absent, not blank) and exactly three quick actions (Scan, New transfer,
  Register merchant — Register a machine and Add transaction absent), with the header additionally
  showing the representative's branch ("فرع القاهرة") via the reused `MoreProfileHeader`. Machines
  correctly read 4 (in this rep's custody) rather than the Director's 10 (the whole branch/company
  scope), proving the identical query genuinely re-scopes per caller rather than the UI hiding a
  shared number.
- Cleaned up afterwards: reverted a temporary `DevicePreview(enabled: false)` override used only to
  get reliable synthetic-swipe coordinates for the pull-to-refresh check back to
  `enabled: kDebugMode`; stopped the `flutter run` and `nest start` background processes; re-enabled
  wifi/data on the emulator; force-stopped the app. No test data was written during this section (every
  call used was a `GET`), so there was nothing to clean up in the database.

**Verification commands run**: `flutter analyze` (0 issues) and `flutter test` (125/125 passing — 102
pre-existing plus 23 new: 5 cubit tests and 18 RTL/LTR widget-test cases across the two new widget
test files) after every change in this section, plus the live pass above.

---

## 8. Flutter machines and scanning completion

### 8.1 Complete machines

- [ ] Make machine list/detail read from the local cache.
- [ ] Add the machine timeline page and all planned event types.
- [ ] Add maintenance history navigation and display.
- [ ] Add the machine bulk-import page and result/error handling.
- [ ] Add machine-detail actions for transfers, maintenance, replacement, and decommission with
      correct permissions and state rules.
- [ ] Add the decommission-candidates entry point when that feature is ready.

### 8.2 Complete scanning

- [ ] Add explicit single-shot and continuous scanner modes.
- [ ] In continuous mode, retain the selected set and ignore duplicate scans.
- [ ] Support eligibility errors without closing the scanner.
- [ ] Integrate battery scanning into transfer item details.
- [ ] Keep manual entry available for every scanning use case.
- [ ] Implement QR-label printing/export if it remains in v1 scope.
- [ ] Test camera lifecycle, permission denial, background/resume, and controller disposal.

---

## 9. Flutter transfers and signatures completion

### 9.1 Complete transfer machine selection

- [ ] Use continuous scanning when adding machines.
- [ ] Add a searchable, cached, multi-select machine picker.
- [ ] Enforce local custody and transfer-type eligibility checks.
- [ ] Add the inline new-merchant flow and return the created merchant to the recipient selector.
- [ ] Block direct inter-branch transfer construction with the planned explanation.

### 9.2 Complete per-item details

- [ ] Add battery scan alongside manual entry.
- [ ] Add up to four removable photos per transfer item.
- [ ] Capture from camera or gallery.
- [ ] Compress on capture, normalize orientation, and strip unnecessary EXIF data.
- [ ] Add “apply to all” for accessories and condition.
- [ ] Preserve per-item notes and show mismatch warnings immediately.

### 9.3 Complete sender signing

- [ ] Put signature capture into step four after the complete payload summary.
- [ ] Show recipient, signer, machine count, anomalies, and full-detail access on the signing screen.
- [ ] Compute the canonical payload hash on the client.
- [ ] Submit the correct sender/self-attestation signature for each transfer type.
- [ ] Ensure no editable screen follows signature capture.

### 9.4 Complete receiver confirmation

- [ ] Add the recomputed adjustment summary above signature capture.
- [ ] Keep reject-with-reason available as a distinct path.
- [ ] On `PAYLOAD_CHANGED`, reload and require a new review and signature.
- [ ] Add offline confirmation and rejection queue operations.
- [ ] Surface manual custody conflicts through blocking conflict UI.

### 9.5 Add biometric handover signatures

- [ ] Separate login biometrics from handover-signature biometrics.
- [ ] Add biometric/drawn signature method selection.
- [ ] Require `biometricOnly: true` with no device-PIN fallback.
- [ ] Send device ID, model, verification time, method, and payload hash.
- [ ] Explain failures and always allow drawn-signature fallback.

### 9.6 Harden drawn signatures and display

- [ ] Reject empty, dot-only, and too-small signatures.
- [ ] Add clear and undo controls.
- [ ] Trim/downscale PNG output to the planned maximum dimensions and size.
- [ ] Stage signatures as pending media for offline upload.
- [ ] Display signature image/fingerprint, signer, method, time, and device in transfer detail.
- [ ] Add full-size protected viewing without save/share actions.

Acceptance:

- [ ] A 12-machine transfer with photos and a signature can be completed offline, survive restart,
      sync successfully, and be replayed without duplicates.

---

## 10. Flutter merchants completion

- [ ] Make merchant list/detail read from the local cache.
- [ ] Queue merchant creation offline with duplicate-conflict handling.
- [ ] Allow a newly created offline merchant to be referenced by a queued transfer.
- [ ] Queue supported subscription/collection writes according to the final offline policy.
- [ ] Stage receipt/invoice media where required.
- [ ] Reconcile local and server IDs after synchronization.
- [ ] Add offline widget and integration tests for registration and placement flows.

---

## 11. Flutter maintenance, replacement, and decommission

### 11.1 Maintenance screens

- [ ] Build maintenance list, filters, status chips, and pagination.
- [ ] Build maintenance detail with machine, fault, location, timeline, warranty, and cost sections.
- [ ] Build the create form with scan/pick, warehouse eligibility, location, fault, dates, and notes.
- [ ] Build send, receive, update, cancel, and permission-aware actions.
- [ ] Keep the entire feature clearly online-only as specified.

### 11.2 Maintenance close flow

- [ ] Add result selection, warranty suggestion, and overridable free-warranty switch.
- [ ] Add cost, supplier, responsible party/person, technician name, invoice, and notes.
- [ ] Add the finance-posting/violation preview before submission.
- [ ] Route replacement results through the replacement form before closing.
- [ ] Show the final backend effects after a successful close.

### 11.3 Replacement flow

- [ ] Build the replacement form with scanned/manual new serials and warranty information.
- [ ] Show a chain preview and explain new-machine custody.
- [ ] Validate immutable/duplicate serials and required replacement fields.
- [ ] Refresh both old and new machine records after completion.

### 11.4 Decommission flow

- [ ] Build the cost snapshot and chain-aware economics display.
- [ ] Add reason, mandatory notes, and optional signature.
- [ ] Add the explicit final confirmation dialog.
- [ ] Explain failed preconditions before opening the form.
- [ ] Do not expose revert in the mobile app.

### 11.5 Decommission candidates

- [ ] Build the candidates list.
- [ ] Add cost ratio, repair count, and age sorting.
- [ ] Add adjustable thresholds and suggestion-focused wording.
- [ ] Link every candidate to machine detail and the permitted decommission flow.

---

## 12. Flutter violations completion

- [ ] Add a dedicated “My violations” entry point and correctly scoped query.
- [ ] Add user-violations navigation from user detail.
- [ ] Verify manual creation/update actions required by permissions and backend contract.
- [ ] Show related machine, transfer, evidence, acknowledgement, charge, and waiver history.
- [ ] Refresh finance-related state after charge.
- [ ] Add cubit and widget tests for list, detail, summary, charge, waive, and permission gating.

---

## 13. Flutter finance

### 13.1 Finance overview and transactions

- [x] Replace the Finance placeholder with the finance overview.
- [x] Add date/branch filters, income, expense, net, and budget indicators.
- [x] Build transaction list, filters, detail, create/edit, and void flows.
- [x] Support offline creation through the sync queue where allowed.
- [x] Clearly label immutable auto-generated transactions.

### 13.2 Category tree and picker

- [x] Build a searchable nested category picker with breadcrumbs and recent selections.
- [x] Show only categories matching the transaction kind.
- [x] Build category create/edit/move/deactivate/delete management.
- [x] Handle cycle, child, transaction, and system-category errors.
- [x] Test navigation through at least four category levels on a phone-sized viewport.

### 13.3 Budgets and breakdown

- [x] Build direct and rolled-up category breakdown screens.
- [x] Build budgets list, create/edit/delete, and status views.
- [x] Add pace indicators and warning/exceeded states.
- [x] Refresh overview and breakdown after finance mutations.

---

## 14. Flutter reports

- [ ] Replace the Reports “not ready” route with a permission-filtered reports hub.
- [ ] Build the generic report viewer for table, card, grouped, and chart shapes.
- [ ] Add report-specific filter forms.
- [ ] Make wide tables usable on phones with frozen identifiers or the planned mobile layout.
- [ ] Add export format selection.
- [ ] Poll asynchronous report jobs until ready/failed.
- [ ] Download, open, and share permitted CSV/XLSX/PDF files.
- [ ] Keep previously downloaded reports accessible offline if allowed by security policy.
- [ ] Add Arabic/English and permission-gating tests.

---

## 15. Flutter notifications and deep links

### 15.1 Push setup

- [ ] Add and configure Firebase Messaging for Android and iOS.
- [ ] Request permissions with appropriate platform-specific explanation.
- [ ] Register, refresh, and delete device tokens through the backend.
- [ ] Handle foreground, background, and terminated-app messages.

### 15.2 Notification UI

- [ ] Replace the Notifications “not ready” route with the notification list.
- [ ] Add pagination, unread styling, mark-one-read, and mark-all-read.
- [ ] Add a reactive unread badge.
- [ ] Build notification preferences, channel toggles, and quiet-hours controls.

### 15.3 Deep links

- [ ] Map every backend notification entity/type to a permitted route.
- [ ] Restore pending deep links after splash/authentication.
- [ ] Re-check permission and entity access before navigating.
- [ ] Show a safe fallback when an entity was removed or access changed.
- [ ] Test all three app states: foreground, background, and terminated.

---

## 16. Flutter users and roles completion

- [ ] Add the dedicated user-detail screen.
- [ ] Show account facts, branch, role, status, custody, violations, and permitted actions.
- [ ] Add role list, create, edit, and role-permission management screens.
- [ ] Preserve individual permission overrides separately from role grants.
- [ ] Add confirmation and affected-user warnings for role permission changes.
- [ ] Keep administration online-only and show that state clearly.
- [ ] Add route-level permission checks, not only hidden buttons.

---

## 17. Flutter production readiness and polish

### 17.1 Production configuration and upgrades

- [ ] Replace the example production API host with environment/flavor configuration.
- [ ] Create development, staging, and production build configurations.
- [ ] Handle backend HTTP 426 with a blocking upgrade screen/dialog.
- [ ] Add safe store/update links and prevent unsupported clients from continuing.

### 17.2 Quality and accessibility audit

- [ ] Audit every screen in Arabic/RTL and English/LTR.
- [ ] Audit every screen for loading, empty, error, offline, and permission-denied states.
- [ ] Verify 48 dp touch targets, contrast, semantics, and text scaling to 1.3x.
- [ ] Replace hardcoded colors/text styles/padding with tokens where still present.
- [ ] Move remaining private widget classes out of page files to comply with the plan.
- [ ] Verify serials, amounts, and dates remain LTR inside Arabic layouts.

### 17.3 Performance and device lifecycle

- [ ] Benchmark the 1,000-machine list at 60 fps on a representative device.
- [ ] Cache and resize images appropriately.
- [ ] Verify camera and signature controllers are always disposed.
- [ ] Ensure background sync does not wake excessively or drain the battery.
- [ ] Test low-storage, interrupted-upload, process-killed, and app-upgrade cases.

### 17.4 Observability and field validation

- [ ] Add crash reporting with sensitive-data redaction.
- [ ] Add analytics for key funnels without recording private financial/signature data.
- [ ] Run the full Maestro suite against both mock and live APIs.
- [ ] Add cubit and widget tests for every major feature, not only contract parsing.
- [ ] Field-test with at least two representatives on real phones and a poor connection.
- [ ] Record issues, fix them, and repeat the field test before launch.

---

## Final release gate

- [ ] All checklist items above are complete or explicitly removed from v1 scope in both plans.
- [ ] Backend lint, typecheck, build, unit tests, and E2E tests pass.
- [ ] Flutter analysis, unit tests, widget tests, and Maestro flows pass.
- [ ] Android and iOS release builds succeed with production configuration.
- [ ] Arabic PDF/XLSX exports have been opened successfully on real target devices/software.
- [ ] Offline transfer triple-replay produces exactly one set of server records.
- [ ] Audit records exist for every required mutation and cannot be altered by the app DB role.
- [ ] Backup restoration has been rehearsed successfully.
- [ ] Monitoring, alerting, privacy, retention, and operational ownership are documented.
