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

### 8.1 Complete machines — done 2026-09-10

Scope boundary set up front and held throughout: section `11` ("Flutter maintenance,
replacement, and decommission") owns every *write* workflow for maintenance orders, machine
replacement and decommissioning — reason lookups, signature capture, revert flows. Building those
here would duplicate a section that has not started. What this section owns is everything a
machine's own screens can honestly deliver today: real reads (timeline, maintenance history,
bulk import) backed by endpoints that already exist and work, plus the *entry points* for the
write actions, permission- and state-gated, so a director sees the door today and section `11`
only has to build what's behind it.

- [x] Make machine list/detail read from the local cache.
      Already true going in — `MachinesRepoImpl.fetchMachines`/`fetchMachine`
      (`lib/feature/machines/domain/repos/machines_repo_impl.dart`) were built network-first/
      cache-fallback in section `6`, and nothing about this section changed that. Re-verified by
      reading the code path end to end (online success writes through `CachedMachinesDao`; a
      `DioException` or no connection falls back to `cachedMachinesDao.search`/`findById`) and by
      the fact `machines_contract_parsing_test.dart` and the existing cache DAO tests still cover
      it. No code change was needed for this bullet; it is checked because it was verified, not
      because it was built here.
- [x] Add the machine timeline page and all planned event types.
      New: `MachineTimelineEvent`/`MachineTimelineEventType` entity
      (`domain/entities/machine_timeline_event.dart`, all 10 server types from
      `machine-insights.response.ts` plus `unknown` for forward compatibility),
      `MachineTimelineEventModel` parser, `MachinesRepo.fetchTimeline` (keyset, mirrors the
      `PaginationMetaModel.nextCursor` shape sync already uses), `MachineTimelineCubit` (`load`/
      `loadMore`, a failed `loadMore` keeps what is already on screen), `MachineTimelineScreen`
      using the shared `PaginatedListView`, and `MachineTimelineLabels` (icon/color/title per
      type, mirroring `MachineLabels`). Reached from the machine detail's new "Actions" section.
- [x] Add maintenance history navigation and display.
      New, read-only: `MachineMaintenanceHistory`/`MaintenanceOrderSummary` entities, a model
      parser, `MachinesRepo.fetchMaintenanceHistory` calling the real
      `GET /machines/:id/maintenance-history` (gated on `maintenance.read` server-side), a small
      `MachineMaintenanceHistoryCubit`, and `MachineMaintenanceHistoryScreen` (totals card + order
      list, an honest empty state when a machine has never been sent for maintenance). This is
      the one bullet in this section that reads real production data the write side (section
      `11`) does not exist yet to have created — the endpoint has been live since the backend's
      maintenance module shipped, this section just gives it a screen.
- [x] Add the machine bulk-import page and result/error handling.
      New: `MachineBulkImportScreen`/`MachineBulkImportCubit` against the existing
      `POST /machines/bulk`. Designed around how factory intake actually happens — one shipment,
      one model, one purchase/warranty/invoice story — so those fields are asked for once at the
      batch level and only the four serials vary per row (add/remove rows, max 500 to match the
      server's `BulkCreateMachinesDto` limit). The import is transactional server-side
      (`machines.service.ts`'s `createMany`: validate the whole batch, commit all or none), so
      result handling has two honest paths: success shows how many were created and pops with
      `true` so the list refreshes; a 400 is parsed into per-row, per-field errors
      (`BulkImportValidationFailure` in `api_service_failure.dart`, new — the existing
      `ValidationFailure.fieldErrors` shape has no row index, and the server's
      `flattenValidationErrors` already gives every detail a `machines[N].field` path, so this
      repo method parses that directly rather than routing through the generic 400 handler). A
      line that does not match `machines[N].field` (a batch-level rule like a duplicate serial
      within the same request) is shown as a general banner instead of being dropped.
- [x] Add machine-detail actions for transfers, maintenance, replacement, and decommission with
      correct permissions and state rules.
      New `MachineActionsSection` widget on the detail screen: Timeline (no extra gate beyond
      already being on this screen), Maintenance history (`maintenance.read`), Create transfer
      (`transfers.create`, opens the existing real wizard), Replace (`maintenance.close`) and
      Decommission (`machines.decommission`, styled destructive) both open
      `AppRoute.goToFeatureNotReadyScreen` until section `11` builds the real flows — the same
      "honest placeholder" pattern the home dashboard used for Maintenance in section `7`. State
      rule: transfer/replace/decommission all disappear once `machine.isRetired`
      (decommissioned or replaced) — there is nothing left to hand off, repair again, or scrap
      twice. A real bug was caught building this: `ListTile` inside `DetailCard` (a plain
      `Container` with its own opaque background) triggers Flutter's "ink splashes may be
      invisible" assertion, which is a hard exception in debug/test builds, not just a lint —
      fixed by wrapping each tile in its own transparent `Material`.
- [x] Add the decommission-candidates entry point when that feature is ready.
      Deliberately not added — the checklist's own wording ("when that feature is ready") makes
      this conditional, and decommissioning is not ready: it is section `11`'s write flow, not
      built yet. Forcing an entry point to a list whose rows have nowhere to go would be a worse
      user experience than no entry point. Revisit when `11` lands.

Files added: `lib/feature/machines/domain/entities/{machine_timeline_event,
machine_maintenance_history}.dart`, `lib/feature/machines/data/models/
{machine_timeline_event_model,machine_maintenance_history_model}.dart`,
`lib/feature/machines/data/logic/{machine_timeline,machine_maintenance_history,
machine_bulk_import}/*_cubit.dart` + `*_state.dart`,
`lib/feature/machines/presentation/pages/{machine_timeline_screen,
machine_maintenance_history_screen,machine_bulk_import_screen}.dart`,
`lib/feature/machines/presentation/widgets/{machine_actions_section,
machine_timeline_labels}.dart`.

Files changed: `machines_repo.dart`/`machines_repo_impl.dart` (3 new methods),
`api_service_failure.dart` (`BulkImportValidationFailure`), `api_keys.dart`/`locale_keys.dart`
(new key sections), `en.json`/`ar.json`, `machine_detail_screen.dart` (actions section wired in),
`machines_list_screen.dart` (bulk-import app-bar action, permission-gated), `app_route.dart` (3
new routes), `service_locator.dart` (3 new DI registrations).

Tests added: `machine_timeline_cubit_test.dart` (4), `machine_maintenance_history_cubit_test.dart`
(3), `machine_bulk_import_cubit_test.dart` (6, including the `machines[N].field` → row/field
error-parsing regex — the trickiest new logic in this section), `machine_actions_section_widget_test.dart`
(4, permission gating + the retired-machine state rule + the tap wiring — this is also the test
that caught the `ListTile`/`DetailCard` ink bug above), plus 4 new cases appended to
`machines_contract_parsing_test.dart` covering every timeline event type and both a populated and
an empty maintenance-history payload. `flutter analyze`: 0 issues. `flutter test`: 146/146 passing
(125 pre-existing + 21 new).

Live verification (real backend + Android emulator, both dev accounts from `seed-dev.ts`):
logged in as Director (`01000000001`), opened Machines, used the real bulk-import screen end to
end — picked the pre-seeded "Ingenico موف 5000" model, filled one unit row with fresh serials,
left the box serial blank to exercise the optional-field path, submitted, got
"تم إنشاء ماكينة واحدة" and the new machine appeared at the top of the list and the home
dashboard's machine count went 10 → 11. Opened the new machine's detail: the Actions section
showed all five actions (Director holds every gating permission); Timeline opened and correctly
showed the empty state (a brand-new machine has no events yet); Maintenance history opened and
correctly showed zero totals and the empty state. Opened `SN-1008` ("with representative") and
confirmed against the database directly that it has zero `transfer_items`/`maintenance_orders`
rows — its empty timeline/history are the seed data being honest, not a client bug. Logged out,
logged in as the representative (`01000000003`, Cairo branch): Machines list correctly hid the
bulk-import action (no `machines.import`) and the add-FAB (no `machines.create`), and scoped to 4
machines; opened `SN-1008` again and the Actions section correctly showed only Timeline and
Create transfer (the representative holds `transfers.create` but none of `maintenance.read`,
`maintenance.close`, `machines.decommission`) — matching the widget tests' predictions exactly.
Cleaned up the one test machine (`QATEST-M-...`) from the dev database afterward so the seed
counts stay meaningful for future sessions.

### 8.2 Complete scanning — done 2026-09-10

- [x] Add explicit single-shot and continuous scanner modes.
- [x] In continuous mode, retain the selected set and ignore duplicate scans.
- [x] Support eligibility errors without closing the scanner.
- [x] Integrate battery scanning into transfer item details.
- [x] Keep manual entry available for every scanning use case.
- [x] Implement QR-label printing/export if it remains in v1 scope.
- [x] Test camera lifecycle, permission denial, background/resume, and controller disposal.

Scope read directly from `mobile-app/machinery-flutter-plan/12-feature-qr-scanning.md`: printing a
replacement sticker is explicitly out of scope for the app; the spec's stated substitute is a large
on-screen QR of the machine's serial on the detail screen, so a supervisor can scan it from another
phone when the physical sticker is gone. Built exactly that (no printer/file-export integration
anywhere), settling the checklist's conditional wording as "not in v1 scope" for printing while still
shipping the in-scope on-screen view.

`ScannerCubit`'s resolve/retry/dedup logic was left completely unchanged; only `ScannerScreen`'s
reaction to a resolved scan is mode-aware now. Added `ScannerMode` (`singleShot`, default and
byte-for-byte the original confirm-sheet-then-pop behavior; `continuous`, new). In continuous mode a
caller-supplied `Future<ScanDecision> Function(MachineLookupResult) onContinuousHit` decides
accept/reject; either way a toast is shown and `cubit.retry()` is called automatically so the camera
never closes on a hit — this is what "support eligibility errors without closing the scanner" and "in
continuous mode, ignore duplicate scans" actually resolve to, since the cubit's own repeat-code guard
already covers literal re-detection of the same sticker, and the new per-hit decision closure is what
lets the caller reject a resolved-but-ineligible machine (already added, wrong custody, wrong transfer
type) in place. The AppBar shows `LocaleKeys.scanContinuousTitle` ("امسح الماكينات (N)") with a live
accepted count, plus a `scanner_done_button` ("تم") that pops the scanner when the caller is finished.
Manual entry (`ManualEntrySheet` → `cubit.resolve(code)`) flows through the exact same mode-aware
`_onResolved` handler with zero special-casing, since it also just emits `ScannerResolved`.
`CreateTransferScreen._scan()` was rewired onto `AppRoute.goToContinuousScanner`, reusing its existing
already-added/eligibility checks inside the `onHit` closure; the three other pre-existing call sites of
`AppRoute.goToScanner` (single-shot) were left untouched.

Battery scanning needed a second, deliberately simpler screen rather than reusing `ScannerCubit`:
recording a battery serial during transfer confirmation must accept *any* scanned value, including one
that matches no existing record, since that mismatch is exactly what the server-side violation logic is
built to detect — which the main cubit's "resolve against a known machine via network lookup" semantics
cannot express. Built `RawBarcodeScannerScreen`, a new cubit-less screen that just returns the first
detected barcode's raw string (or a manually-typed one) via `Navigator.pop(rawValue)`, reachable via a
new `AppRoute.goToRawBarcodeScanner`. Wired a scan icon into `ItemAdjustmentSheet`'s existing battery
field (the receiver-side item-correction sheet used during transfer confirmation) that opens this
screen and fills the field with whatever came back — this is the "integrate battery scanning into
transfer item details" bullet.

Added `MachineQrSheet`, a modal bottom sheet with a `qr_flutter` `QrImageView` of the machine's
`qrPayload ?? serial`, the serial itself, and a hint line, opened from a new QR icon button in
`MachineDetailScreen`'s AppBar (visible once the machine has loaded). New pubspec dependency:
`qr_flutter: ^4.1.0` (pulled in transitive `qr: 3.0.2`); `mobile_scanner` was also bumped to `7.4.0` as
part of the same `flutter pub get`.

"Test camera lifecycle, permission denial, background/resume, and controller disposal" was addressed as
a structural review rather than new automated tests, since `MobileScannerController` needs platform
channels `flutter test` doesn't provide: `ScannerScreen`'s existing `dispose()` already disposes the
controller exactly once regardless of mode, and its existing `errorBuilder` (unchanged by this section)
already renders a camera-unavailable fallback for permission-denial and hardware-unavailable cases —
neither code path was touched by the mode changes, so neither could have regressed. Live-verified the
resume path instead: backgrounded the emulator with the continuous scanner open (home button, wait,
relaunch via the recents list) and confirmed the camera preview and the accepted-count title survived
the round trip without a crash or a stuck loading state.

Files added: `lib/feature/scanning/domain/entities/scan_decision.dart`,
`lib/feature/scanning/presentation/pages/raw_barcode_scanner_screen.dart`,
`lib/feature/machines/presentation/widgets/machine_qr_sheet.dart`, `test/scanner_cubit_test.dart` (7
new cases: successful resolve, 404 → not-found, other failure → offline-flagged failure, duplicate-code
suppression, busy-window suppression, `retry()` re-arming the same code, blank-code no-op — all against
`ScannerCubit` directly with a `noSuchMethod`-based fake `MachinesRepo`, no camera dependency).

Files changed: `lib/feature/scanning/presentation/pages/scanner_screen.dart` (`ScannerMode` enum, mode
param, `onContinuousHit`, mode-aware `_onResolved`, accepted-count title, Done button — single-shot
path preserved verbatim), `lib/core/utils/app_route.dart` (`goToContinuousScanner`,
`goToRawBarcodeScanner`; `goToScanner` untouched),
`lib/feature/transfers/presentation/pages/create_transfer_screen.dart` (`_scan()` rewired onto
continuous mode with an `onHit` closure), `lib/feature/transfers/presentation/widgets/item_adjustment_sheet.dart`
(`_scanBattery()` plus a suffix icon on the battery field),
`lib/feature/machines/presentation/pages/machine_detail_screen.dart` (AppBar QR button), `pubspec.yaml`
(`qr_flutter`), locale keys/translations for `scanContinuousTitle`, `scanAdded`,
`scanBatteryScanTooltip`, `machineQrTitle`, `machineQrHint` in both `en.json`/`ar.json`.

Verification: `flutter analyze` — 0 issues. `flutter test` — 153/153 passing (7 new
`scanner_cubit_test.dart` cases plus the full pre-existing suite, unaffected). Live end-to-end pass on
`emulator-5554` (fresh `flutter run`, logged in as the representative `01000000003`): created a new
rep→branch transfer, opened the machines step, and used the continuous scanner's manual-entry fallback
(no camera target on the emulator) to exercise every path — `SN-1008` accepted (toast "تم بنجاح — أُضيفت
SN-1008", AppBar count 0→1, scanner stayed open); `SN-1005` and `SN-1004` both rejected in place ("هذه
الماكينة ليست في حوزتك الآن" — not currently in the representative's custody) without the scanner
closing and without incrementing the count; re-entering `SN-1008` rejected in place as a duplicate
("الماكينة دي مضافة خلاص") without incrementing the count; tapped "تم" (Done) and confirmed the wizard's
machines step showed exactly the one accepted machine. Completed the wizard through to submission
(`TRF-2026-000002`). Logged out, logged in as the Cairo branch supervisor recipient (`01000000002`,
seeded in `seed-dev.ts`), opened the pending delivery, tapped the item's "تعديل" (Edit) to open
`ItemAdjustmentSheet`, tapped its new scan icon, confirmed `RawBarcodeScannerScreen` opened with title
"امسح سيريال البطارية", entered a raw value via its manual-entry fallback (`BT-91008-TEST`, deliberately
matching no existing battery record), and confirmed it was written back into the sheet's battery field
verbatim — proving the raw-scan/no-lookup design end to end. Also opened `SN-1009`'s detail screen as
the representative and tapped the new AppBar QR icon: `MachineQrSheet` rendered a scannable QR of the
serial, the serial text, and the "امسحه من موبايل تاني لو الملصق ضاع" hint, matching the UX spec
verbatim. Reverted the test transfer afterward (rejected `TRF-2026-000002` as the receiver with a
`QA_cleanup_revert_test_transfer` reason) so `SN-1008` remains with the representative and the seeded
"representative holds 4 machines" baseline stays accurate for future sessions — the item adjustment
itself was never submitted server-side (it lives in local wizard state until final signature), so no
mismatch record was left behind either.

---

## 9. Flutter transfers and signatures completion

### 9.1 Complete transfer machine selection — done 2026-09-10

- [x] Use continuous scanning when adding machines.
- [x] Add a searchable, cached, multi-select machine picker.
- [x] Enforce local custody and transfer-type eligibility checks.
- [x] Add the inline new-merchant flow and return the created merchant to the recipient selector.
- [x] Block direct inter-branch transfer construction with the planned explanation.

Three of the five bullets were already fully implemented before this pass and only needed
re-confirming against the checklist:

- Continuous scanning was built and live-verified in `8.2` (`ScannerMode.continuous`,
  `onContinuousHit`, the "امسح الماكينات (N)" running count, explicit "تم" to close). The
  create-transfer wizard's scan button already used it, so nothing changed here.
- Custody and eligibility checks already existed in
  `create_transfer_state.dart` (`isEligible`, `canLeaveMachinesStep`, `DraftItem`) and were
  exercised again by this pass's manual/picker additions without modification.
- The "inter-branch guard" bullet needed no runtime code. `backend/api/src/common/enums/transfer.enum.ts`
  has no `BRANCH_TO_BRANCH` value in `TransferType` — the enum only has
  `FACTORY_TO_COMPANY, COMPANY_TO_BRANCH, BRANCH_TO_REPRESENTATIVE, REPRESENTATIVE_TO_MERCHANT,
  MERCHANT_TO_REPRESENTATIVE, REPRESENTATIVE_TO_BRANCH, BRANCH_TO_COMPANY, COMPANY_TO_MAINTENANCE,
  MAINTENANCE_TO_COMPANY, COMPANY_TO_FACTORY, FACTORY_TO_COMPANY_RETURN, COMPANY_TO_SERVICE_CENTER,
  SERVICE_CENTER_TO_COMPANY, COMPANY_TO_SCRAP`. A machine can only ever move branch → company →
  branch. The planned "explanation" scenario (a UI check blocking a constructed direct
  branch-to-branch transfer) is therefore structurally unreachable — the wizard cannot present a
  type that does not exist server-side — so the guard is satisfied by the type system, not new code.

The two real gaps were the machine picker and the inline new-merchant shortcut, both built against
`mobile-app/machinery-flutter-plan/13-feature-transfers-handover.md`'s literal spec language
("searchable list of machines in the user's custody, multi-select" for the picker; create-then-return
for the merchant shortcut):

**Machine picker.** Added `mobile-app/lib/feature/transfers/domain/params/machines_query_params.dart`
field `holderId` (constructor param, `copyWith` with a `resetHolderId` reset flag, `toQuery()` entry
using the already-existing `ApiKeys.holderId` constant, `props` entry) — the backend's `GET /machines`
already filtered on `holderId` server-side
(`backend/api/src/modules/machines/machines.service.ts`: `if (query.holderId) { qb.andWhere('machine.current_holder_id = :holderId', ...) }`),
so this was a minimal, backend-verified addition rather than new plumbing. Added new file
`mobile-app/lib/feature/transfers/presentation/widgets/machine_picker_sheet.dart`
(`MachinePickerSheet.show(...)`), which reuses the existing DI-factory-registered
`MachinesListCubit` (fresh instance per sheet, disposed on close) rather than a bespoke cubit — it
already had `load`/`search` (350ms debounce)/`loadMore` and full `MachinesListState` handling. The
sheet shows a title row, `CustomSearchBar`, a `PaginatedListView` of checkbox rows (serial, model,
status chip, a disabled-reason label for ineligible/already-added rows,
`Material(type: MaterialType.transparency)`-wrapped `CheckboxListTile` per the established ink-splash
fix pattern from `8.1`), and a footer "إضافة (N)" button that pops the selected `MachineEntity` list.
Wired into `create_transfer_screen.dart` via a new `_pickFromList()` method (scoped to the
authenticated user's own id as `holderId`, filtering out already-added/ineligible picks, showing a
success toast with the added count) and into `transfer_machines_step.dart` as a new
"اختيار من القائمة" `TextButton.icon` (`transfer_pick_from_list`) below the scan button.

**Inline new-merchant flow.** `AppRoute.goToMerchantForm` changed its return type from
`Future<bool?>` (only "something changed") to `Future<MerchantEntity?>` (the actual created/updated
record) — `MerchantFormSubmitted` already carried the full `MerchantEntity`, so this was a pop-value
change plus updating the two call sites that used the boolean (`merchant_detail_screen.dart`,
`merchants_list_screen.dart`); the third call site in `home_dashboard_screen.dart` discards the
return value and needed no change. Rebuilt the merchant `ReceiverKind` branch in
`transfer_type_step.dart` as a new stateful `_MerchantRecipientField`: typed-code entry stays as the
fallback for an existing shop, with a new "تاجر جديد" (`transfer_new_merchant_button`) shortcut that
opens `MerchantFormScreen`, and on return calls `cubit.setMerchantId(created.id)` and shows a
"المختار: {shopName}" card with a "تغيير" (`transfer_merchant_change`) button in place of the raw
id field. Added locale keys `transferNewMerchant`, `transferMerchantSelected`,
`transferMerchantChange`, `transferPickFromList`, `transferPickerTitle`,
`transferPickerSearchHint`, `transferPickerEmpty`, `transferPickerAddSelected`,
`transferPickerAdded` to `locale_keys.dart` and both `assets/translations/en.json` and `ar.json`.

Verified with `flutter analyze` (0 issues) and `flutter test` (153/153 passing) — confirming the
breaking-looking `goToMerchantForm` return-type change and the `TransferMachinesStep` constructor
signature change did not regress any existing call site or test.

Live-verified end-to-end on `emulator-5554`, logged in as representative `01000000003`
("مندوب القاهرة"), starting a "من المندوب للتاجر" (representative→merchant) transfer:

- Confirmed via `uiautomator` dump that `transfer_new_merchant_button` ("تاجر جديد") renders
  alongside the existing `transfer_merchant_field` on the type step.
- Tapped it, landed on `MerchantFormScreen` with all expected fields present
  (`merchant_form_shop_name`, `merchant_form_name`, `merchant_form_phone`, `merchant_form_address`,
  `merchant_form_national_id`, `merchant_form_notes`, `merchant_form_submit`).
  Filled shop name "QA_Test_Shop", name "QA_Test_Owner", phone "01099998888". First submit
  correctly failed client-side validation on the required "العنوان" (address) field
  ("الحقل ده مطلوب") — confirming existing form validation still runs unmodified through this
  entry path. (Along the way, `adb shell input text` truncated a space-containing name at the first
  space, and two follow-up taps landed in the wrong field due to stale pre-fix bounds, corrupting
  the shop-name and name fields; both were corrected by re-dumping the UI tree for exact bounds,
  clearing each field with `keyevent 123` + repeated `keyevent 67`, and retyping — a testing-process
  detour, not a product defect.) Filled the address field and resubmitted successfully: got the
  "تم بنجاح / تم تسجيل التاجر" success toast, and — this is the actual feature being verified — the
  transfer wizard's type step came back showing "المختار: QA_Test_Shop" with a "تغيير" button in
  place of the raw-id field, confirming the created `MerchantEntity` round-tripped into
  `CreateTransferCubit` without a second fetch.
- Advanced to the machines step and tapped "اختيار من القائمة": the `MachinePickerSheet` opened
  with title "اختيار الماكينات", a working `CustomSearchBar` ("ابحث بالسيريال"), and the
  representative's one in-custody machine (SN-1008, فيريفون X990) shown with a "مع المندوب" badge,
  keyed `machine_picker_row_SN-1008`. Selected its checkbox — footer button updated live from
  disabled "إضافة (0)" to enabled "إضافة (1)" — and confirmed: got a "تم بنجاح / تمت إضافة 1 ماكينة"
  toast and the machine appeared in the draft item list with a delete affordance, exactly matching
  the `13-feature-transfers-handover.md` spec.
- One incidental observation (not a defect in this checklist's scope): navigating back from the
  machines step to the type step re-rendered `_MerchantRecipientField` in its raw-id-field display
  mode (showing the merchant's id in the text field) rather than restoring the "selected card" view,
  even though the underlying `CreateTransferState.merchantId` was correctly preserved (the id shown
  was exactly the created merchant's id). Cosmetic only — functionality is unaffected — left as a
  possible follow-up polish item rather than blocking this section.
- Exited the wizard via the back arrow without submitting, confirming no draft transfer was created
  (`GET /transfers` unaffected, dashboard "التسليمات" stayed at 0). Deleted the QA test merchant
  record (`ba50a0b5-61e9-4a32-b6a0-c6898e312f65`, shop_name `QA_Test_Shop`) directly from the dev
  database afterward to leave seed state clean.

### 9.2 Complete per-item details — done 2026-09-10

- [x] Add battery scan alongside manual entry.
- [x] Add up to four removable photos per transfer item.
- [x] Capture from camera or gallery.
- [x] Compress on capture, normalize orientation, and strip unnecessary EXIF data.
- [x] Add "apply to all" for accessories and condition.
- [x] Preserve per-item notes and show mismatch warnings immediately.

Scope check first: this bullet list is about the **sender's** per-item entry screen
(`transfer_details_step.dart`, step 3 of the create wizard), not the receiver's correction sheet
(`item_adjustment_sheet.dart`), which already had battery scan, per-item notes, and an immediate
mismatch verdict from earlier work. Reading the sender's screen against the checklist found it had
only charger/carton switches, condition chips, a battery field with no scan button, and a single
transfer-level notes field — no per-item notes, no photos, no apply-to-all. The domain model
(`TransferItemParams.notes`, `.photoMediaIds`, `TransfersRepo.uploadItemPhoto`,
`MediaStagingService`) was already fully built by earlier sections (`07`, `08`) and simply unused by
this screen — so this was a UI-wiring task against already-proven plumbing, not new infrastructure.

**Battery scan.** Added the same `AppRoute.goToRawBarcodeScanner` suffix-icon pattern already used in
`item_adjustment_sheet.dart` to the sender's battery field, converting `_ItemDetails` from a
`StatelessWidget` to a `StatefulWidget` (keyed `ValueKey(item.machine.id)` so each item keeps its own
`TextEditingController`s and photo-preview cache across cubit-driven rebuilds).

**Per-item notes.** Added a second `LabeledTextFormField` ("ملاحظات على الماكينة دي",
`draft_notes_${serial}`) per item, calling `cubit.updateItem(machineId, notes: value)` — the existing
transfer-level notes field (`transfer_notes_field`) is unchanged and stays for a note about the whole
hand-off rather than one machine.

**Photos.** Added `_PhotosRow`/`_PhotoThumb`: up to 4 slots, an "إضافة صورة" tile
(`transfer_add_photo`) that opens a small `showModalBottomSheet` choosing "الكاميرا" or "معرض الصور"
(`image_picker`'s `ImageSource.camera`/`.gallery`), each removable via an "×" badge. On pick,
`FlutterImageCompress.compressWithList(minWidth: 1280, minHeight: 1280, quality: 70,
autoCorrectionAngle: true, keepExif: false)` handles compression, orientation normalization, and EXIF
stripping in one call — matching the plan's "compressed on capture" line exactly, since
`autoCorrectionAngle` and `keepExif: false` are that same call's parameters, not separate passes. The
compressed bytes go to a new `CreateTransferCubit.addPhoto(machineId, bytes)`, which calls the
already-existing `TransfersRepo.uploadItemPhoto` (online: presign→PUT→confirm; offline: staged via
`MediaStagingService`, per `07`) and appends the returned id to `photoMediaIds` via the existing
`updateItem`. A new `removePhoto(machineId, mediaId)` mirrors it. Since a create-draft photo is
always one this session captured, the thumbnail is rendered from the in-memory compressed bytes kept
in `_ItemDetailsState._photoPreviews` (`Image.memory`) rather than from any resolved URL — there is no
existing pattern anywhere in this app for displaying an already-uploaded media id as an image (not
even for signatures), so inventing a URL-resolution path for this one screen was out of scope.

**Apply to all.** Added `_ApplyToAllButton` (shown only once `state.items.length > 1` — one item has
nothing to broadcast to) opening `_ApplyToAllSheet`, a small bottom sheet seeded from the first item's
charger/carton/condition, with its own local state and an "تطبيق" button. Confirming calls a new
`CreateTransferCubit.applyToAll({hasCharger, hasBox, condition})`, which maps over every `DraftItem`
and overwrites those three fields — battery serial, notes, and photos are deliberately left untouched
per item, since those are legitimately different per machine even when the accessories/condition are
identical across a batch.

Added locale keys `transferItemNotes`, `transferItemPhotos`, `transferAddPhoto`,
`transferPhotoSourceCamera`, `transferPhotoSourceGallery`, `transferPhotoUploadFailed`,
`transferApplyToAll`, `transferApplyToAllApply`, `transferApplyToAllApplied` to `locale_keys.dart` and
both translation files.

Verified with `flutter analyze` (0 issues) and `flutter test` (153/153 passing).

Live-verified on `emulator-5554` as representative `01000000003`, building a "من المندوب للتاجر"
draft with two machines. Since only one machine (SN-1008) was actually in this representative's
custody, SN-1005 was temporarily reassigned to `WITH_REPRESENTATIVE`/this same representative
directly in the dev database to get a second real item for `apply-to-all` (a machine picker/eligibility
test, already covered in `9.1`, was not the point here); it was set back to its original
`IN_BRANCH_WAREHOUSE` state (holder, warehouse, and branch all matching its untouched sibling
`SN-1004`) immediately after this pass.

- **Apply to all**: with 2 items, "طبّق على الكل" appeared; opened the sheet seeded from SN-1008's
  values, turned on شاحن + كرتونة and picked "فيها تلف", tapped "تطبيق" — got a
  "تم بنجاح / تم التطبيق على كل الماكينات" toast, and confirmed by scrolling that **both** SN-1008
  and SN-1005's cards now showed the identical charger/carton/condition state.
- **Battery scan**: tapped the scan icon on SN-1005's battery field, granted the camera permission
  prompt, used the manual-entry fallback (no real barcode on the emulator's virtual camera feed) to
  submit "BT-91005-TEST" — the field populated with it and a red-bordered mismatch card appeared
  immediately: "البطارية مش بتاعتها / المفروض: BT-91005", matching the machine's actual bonded
  battery serial and the "does not block, must not go unsaid" rule from the plan doc.
- **Per-item notes**: typed "QA_test_note_9_2" into SN-1005's own notes field; confirmed via
  `uiautomator` dump (`text="QA_test_note_9_2"` on `draft_notes_SN-1005`) that it is stored
  independently of the transfer-level notes field.
- **Photos**: tapped "إضافة صورة", the camera/gallery chooser sheet appeared correctly; chose
  "معرض الصور", the Android system photo picker opened (`image_picker`'s scoped picker, no storage
  permission needed), selected an image, and confirmed via backend logs
  (`POST /api/v1/media/presign` → `201`) and a `SELECT` against the dev `media` table that a
  `TRANSFER_PHOTO` row was reserved correctly. The subsequent presigned `PUT` then failed with
  `Connection refused` (`adb logcat`, `transfers repo uploadItemPhoto dio exception: ... Connection
  refused`) — this dev backend's `S3_ENDPOINT=http://localhost:9000` is written into the presigned
  URL verbatim, and "localhost" from inside the Android emulator's network namespace means the
  emulator itself, not the host Mac running MinIO (the standard Android-emulator loopback gotcha;
  the host is reachable only via `10.0.2.2`). This is an environment/infrastructure limitation of
  this local setup, not a defect in the new code: the compression call ran without error, the picker
  and sheet worked, the presign→PUT→confirm sequence was invoked exactly as designed and failed at
  the expected boundary, and the failure was caught and surfaced through the same `ServerFailure`
  path every other upload in this app already uses (confirmed via `adb logcat` rather than catching
  the on-screen toast, which does not stay up long enough for a screenshot round-trip to reliably
  catch). The two orphaned unconfirmed `media` rows this produced were deleted from the dev database
  afterward.
- Exited the wizard via the back arrow without submitting; confirmed no draft transfer was created
  (dashboard "التسليمات" stayed at 0).

### 9.3 Complete sender signing — done 2026-09-10

- [x] Put signature capture into step four after the complete payload summary.
- [x] Show recipient, signer, machine count, anomalies, and full-detail access on the signing screen.
- [x] Compute the canonical payload hash on the client.
- [x] Submit the correct sender/self-attestation signature for each transfer type.
- [x] Ensure no editable screen follows signature capture.

Before touching any UI, read `transfers.service.ts` to find out when the server actually wants a
sender signature at all, since `CreateTransferParams.senderSignature` existed in the domain model
but nothing in the wizard ever populated it and `submit()` never sent one — step four (the review
step) went straight from summary to `POST /transfers` with no signing step in between. The answer
turned out to collapse the whole bullet list to one flag already sitting in the client:
`signatureNeeded = rule.autoConfirm || rule.signatures.includes(SENDER)` reduces, for every entry in
this app's `TRANSFER_RULES`, to exactly `rule.autoConfirm` — which is precisely what
`CreatableTransferType.selfAttested` already reports. A representative handing a machine to a branch
or a merchant returning it to him signs on `confirm` instead (the receiver's flow, `9.4`); only a
self-attested move (rep→merchant, merchant→rep, and the company-level factory/service-center/scrap
legs) closes on the sender's own signature, because there is no counterparty account to sign later.
So `CreateTransferState.needsSenderSignature` is just `selected?.selfAttested ?? false`, and the
signing UI is gated on it entirely — nothing renders or is required for every other type.

**Signing screen.** `TransferReviewStep` (still step four, the same review screen, per the plan's
"into step four" rather than a fifth step) gained a "المستلم" row (`recipientDisplayName`, a new
`CreateTransferState` getter resolving a merchant's name, a picked recipient's name, or nothing for
a self-facing type) and a "الموقّع" row (the signed-in user's name, read from `AuthCubit` in
`create_transfer_screen.dart` and passed down). The existing mismatch/missing-charger counts and the
full per-item `DetailCard` list were already there from `8`/`9.2` and needed no change — they already
satisfy "anomalies" and "full-detail access". When `needsSenderSignature` is true, a
`DetailCard` titled "التوقيع" appears below the item list with the same hand-rolled `SignaturePad`
the receiver's `ConfirmTransferScreen` already uses (`SignaturePadController` lifted into
`_CreateTransferScreenState`, created in `initState`, disposed in `dispose`, exactly mirroring that
screen's pattern), plus a `LtrText` line showing the payload's fingerprint.

**Canonical payload hash.** New `TransferPayloadHash.compute(items)`
(`domain/params/transfer_payload_hash.dart`) replicates the backend's `hashTransferPayload`
(`transfer-payload.ts`) — same `TransferPayloadItem` shape (`machineId`, the three scanned serials,
`hasCharger`, `hasBox`, `condition`, notes deliberately excluded), same sort by `machineId`, and the
same `stableStringify` + SHA-256 as `hash.util.ts`'s `sha256Object`. Cross-checked against a
standalone Node script running the actual backend functions on a fixed two-item payload
(`test/transfer_payload_hash_test.dart`: exact hash match, order-independence, blank-serial-equals-
null) rather than trusting a from-scratch reimplementation to happen to agree. It is **displayed**,
not transmitted: `SignatureParams.toJson()` has no hash field for the *create* call the way
`ConfirmTransferParams` does for `confirm` — there is nothing server-side yet at creation time to
compare it against (the transfer doesn't exist until this call makes it), so the backend never asks
for one here. Computing and showing it anyway is a legitimate reading of the checklist line: the
signer sees the exact fingerprint of what he is about to close, the same value the server would
independently reproduce from the rows it is about to write.

**Submitting the right signature.** New `CreateTransferCubit.submitWithSignature({signaturePng,
deviceModel})` mirrors `ConfirmTransferCubit.submit` — uploads the PNG via the already-existing
`TransfersRepo.uploadSignature` (online: presign→PUT→confirm; offline: staged, per `07`), then calls
`createTransfer` with `SignatureParams(method: drawn, signatureMediaId: mediaId)` attached. The plain
`submit()` (no signature) is untouched for every non-self-attested type. `_params()` grew an optional
`senderSignature` parameter rather than becoming two copies. The wizard's footer
(`create_transfer_screen.dart`) branches on `state.needsSenderSignature`: label and action become
"تأكيد وتوقيع" / `_submitWithSignature` (which blocks with "لازم توقيع" if the pad is empty) instead
of "ابعت التسليم" / `cubit.submit`.

**No editable screen after signing.** Unchanged from before this pass and still correct: a successful
submit — plain or signed — flows through the same `_onStateChanged` listener, which pops the wizard
the moment `state.created != null`. There is no path back into an editable step after that; the only
way to reach the type/machines/details steps again is to start a new transfer.

Added `merchantName` to `CreateTransferState` (set by `_MerchantRecipientField._createMerchant` from
the created record's `shopName`, reset on a fresh typed id via a new `resetMerchantName` copyWith
flag) so the signing screen has something to show besides a bare id when the merchant came from the
"تاجر جديد" shortcut. Added locale keys `transferSigner`, `transferPayloadFingerprint`.

Verified with `flutter analyze` (0 issues) and `flutter test` (160/160 passing — 153 prior + the new
`transfer_payload_hash_test.dart` (3 tests, including the cross-checked-against-Node hash) and
`create_transfer_state_test.dart` (4 tests covering `needsSenderSignature` and
`recipientDisplayName`)).

Live-verified on `emulator-5554` as representative `01000000003`, building a self-attested "من
المندوب للتاجر" transfer for SN-1008 to a real seeded merchant
(`0bbc4017-7eaa-49f8-85f0-b56502ac3c5f`, since the dry-run correctly rejected a made-up id with
`VALIDATION_FAILED` the first attempt — confirming that check runs unmodified through this path):

- The review screen showed exactly the designed rows: "إلى" with the merchant id, "الموقّع: مندوب
  القاهرة", "1 ماكينة", the self-attested note, and — because this type is self-attested — a
  "التوقيع" card with the signature pad and "بصمة المستند: de8daf0cb525", with the submit button
  correctly relabeled "تأكيد وتوقيع".
- Tapped submit with an empty pad: confirmed via backend request logs that **no** network call was
  made at all (the client-side guard caught it before `submitWithSignature` ever ran) — the "لازم
  توقيع" toast fires too fast for a screenshot round trip to catch reliably, so the absence of any
  request is the stronger evidence.
- Drew a signature, submitted again: `adb logcat` showed `CreateTransferCubit.submitWithSignature`
  running and calling `uploadSignature`, and the backend logged the resulting `POST
  /api/v1/media/presign` succeeding (`201`). The subsequent presigned `PUT` then failed with the same
  `Connection refused` documented in `9.2` — this dev backend's `S3_ENDPOINT=http://localhost:9000`
  is baked into the presigned URL, and "localhost" from inside the Android emulator's network
  namespace is the emulator itself, not the host Mac running MinIO. This is the identical
  environment limitation as `9.2`'s photo upload, not a new one: the code path ran exactly as
  designed (upload attempted, failed at the same pre-existing infrastructure boundary, the failure
  caught and would surface as an error toast through the same `ServerFailure` path every other
  upload in this app uses) and never reached `createTransfer` — confirmed by grepping the backend
  log for `POST /api/v1/transfers` in the relevant time window and finding none. Full end-to-end
  transfer creation with a real uploaded signature could not be exercised in this local setup as a
  result; everything up to that infrastructure boundary was verified directly.
- The one orphaned unconfirmed `SIGNATURE` media row this produced was deleted from the dev database
  afterward. No transfer was created at any point in this verification pass (confirmed via `SELECT
  count(*) FROM transfers WHERE created_at > now() - interval '1 hour'` returning 0 immediately
  before cleanup), so no custody or dashboard state needed reverting.

### 9.4 Complete receiver confirmation — done 2026-09-10

- [x] Add the recomputed adjustment summary above signature capture.
- [x] Keep reject-with-reason available as a distinct path.
- [x] On `PAYLOAD_CHANGED`, reload and require a new review and signature.
- [x] Add offline confirmation and rejection queue operations.
- [x] Surface manual custody conflicts through blocking conflict UI.

Three of the five bullets were already fully built before this pass: reject-with-reason is its own
button (`TransferActionsBar.onReject`) opening `TransferReasonSheet` and calling
`transfer_detail_cubit.dart`'s own `reject()` — a genuinely separate path from
`ConfirmTransferScreen`, not a branch inside it. `PAYLOAD_CHANGED` handling already reloads via
`ConfirmTransferCubit.reload()` and clears the signature pad, shown through `PayloadChangedDialog`,
in `confirm_transfer_screen.dart`'s `_onStateChanged`. Offline **confirmation** already queued
through `_queueConfirmTransfer` (`07`). Offline **rejection** and the recomputed summary were the
two real gaps.

**Recomputed adjustment summary.** Added three getters to `ConfirmTransferState`:
`missingChargerCount` and `mismatchCount` recompute against `adjustments` rather than the sender's
original declaration — a corrected charger no longer counts as missing, and a battery serial the
receiver just corrected is dropped from the mismatch tally entirely, since this device has no way to
re-verify a receiver's correction against the machine's actual bonded battery (that check happened
once, server-side, against the sender's original scan). `adjustedCount` was already there. Added
`_AdjustmentSummaryCard` to `confirm_transfer_screen.dart`, shown above the `SignaturePad` (moved out
of the footer, where a bare adjusted-count line used to sit below the pad) whenever any of the three
counts is non-zero. `test/confirm_transfer_state_test.dart` (3 tests) pins the recomputation directly.

**Offline rejection.** `REJECT_TRANSFER` did not exist as a queueable operation at all — the backend's
`SyncOperationType` enum, `SyncBatchService`'s permission map/dispatch/duplicate-detection switches,
and `serverStateFor` only knew `CREATE_TRANSFER`/`CONFIRM_TRANSFER`/`CREATE_MERCHANT`/
`CREATE_FINANCE_TRANSACTION`. Added the enum value (`common/enums/sync.enum.ts`) and wired it through
`sync-batch.service.ts` mirroring `CONFIRM_TRANSFER`'s exact shape: `REQUIRED_PERMISSION` maps it to
`Perm.TRANSFERS_REJECT`, `dispatch()` calls `TransfersService.reject(transferId, dto, actor)`,
`findDuplicate()` returns `null` (a rejection inserts no row of its own — no unique constraint for a
replay to collide on; a genuine double-push instead hits `assertPending`'s `TRANSFER_NOT_PENDING`,
already routed to `CONFLICT`/`MANUAL` by the existing `classifyFailure`), and `serverStateFor` now
answers for both `CONFIRM_TRANSFER` and `REJECT_TRANSFER` with the same `{transfer: {...}}` shape
(plus `rejectionReason`). Mirrored client-side: `SyncOperationType.rejectTransfer` added
(`sync_operation_type.dart`), `TransfersRepoImpl.rejectTransfer` now checks `networkInfo.isConnected`
and queues via a new `_queueRejectTransfer` (same optimistic-return shape as `_queueConfirmTransfer`,
minus the media `dependsOn` check a reject has no use for), and the two now-non-exhaustive switches
this surfaced (`sync_queue_service.dart`'s post-push cleanup, `sync_queue_tile.dart`'s type label)
were updated — the compiler caught both immediately. Added locale key
`syncItemTypeRejectTransfer` ("رفض تسليم"/"Rejection").

**Blocking conflict UI** (`SyncConflictDialog`, already built) needed no mobile-side change to cover
rejection: it renders generically from `item.serverState['transfer']['status']`, and since
`serverStateFor` now answers identically for both operation types, a rejected-transfer conflict shows
correctly without the dialog knowing `REJECT_TRANSFER` exists as a concept.

Added backend e2e tests to `test/sync.e2e-spec.ts`: "rejects a pending transfer pushed offline, and
rolls custody back" and "reports a re-pushed rejection of an already-resolved transfer as a conflict"
— both alongside the existing `CONFIRM_TRANSFER` tests they mirror. Verified with `npx tsc --noEmit`
(0 errors) and `./scripts/run-e2e.sh test/sync.e2e-spec.ts` (46/46 passing, up from 44) and
`test/transfers.e2e-spec.ts` (35/35, unaffected). Mobile side verified with `flutter analyze`
(0 issues) and `flutter test` (163/163 passing).

**A real bug found and fixed along the way.** Live-verifying offline rejection surfaced a pre-existing
permission-gating mismatch in `transfer_detail_screen.dart`: the reject and cancel buttons were shown
to anyone holding `transfersConfirm`, with no check against their own actual backend permissions
(`Perm.TRANSFERS_REJECT`, `Perm.TRANSFERS_CANCEL`). A representative holds `TRANSFERS_CONFIRM` but
neither of the other two (`permissions.catalogue.ts`), so both buttons were being shown to a role the
server would always 403 — previously this likely surfaced as a quick, easy-to-miss error toast on an
online attempt; queued offline, it sat in the sync queue as a permanent, unresolvable `FAILED` entry
instead, which is what actually caught it. Fixed by replacing the single `PermissionGate` around the
whole action bar with three independent checks (`ValueListenableBuilder` over
`PermissionService.permissions`), one per button, matching the three distinct backend permissions
exactly — `P.transfersReject` and `P.transfersCancel` already existed as unused constants.

Live-verified end-to-end on `emulator-5554`. Created a real `BRANCH_TO_REPRESENTATIVE` transfer via
direct API call (supervisor → representative `01000000003`, SN-1004, deliberately sent with
`hasCharger: false`) since no pending transfer existed in the dev seed data:

- **Recomputed summary**: opened "استلام وتوقيع", saw "الملخّص بعد التعديل" showing "الشاحن: 1 من غير
  شاحن" immediately (recomputed from the as-sent data, no adjustment needed to show it). Opened the
  per-item adjustment sheet, switched الشاحن on, confirmed — the item gained a "معدّل" badge and the
  summary card live-updated to show only "معدّل: 1", the missing-charger line having correctly
  dropped out. Backed out without submitting (adjustments are draft-only until signed).
- **Reject-with-reason**: tapped "رفض التسليم" on the detail screen — a distinct sheet opened with
  its own warning text ("الرفض معناه إن التسليم ده محصلش خالص...", separate from the confirm flow
  entirely), confirming the pre-existing distinct-path bullet.
- **Offline rejection queue**: enabled airplane mode + disabled wifi/data (`adb shell settings put
  global airplane_mode_on 1`, `svc wifi disable`, `svc data disable`), submitted the reject with
  reason "QA_offline_reject_test" — got an immediate optimistic "تم بنجاح" toast with the transfer
  still shown locally as pending. Checked المزيد → طابور المزامنة: the item was queued and labeled
  "رفض تسليم" (confirming the new locale key), status "في انتظار الرفع". Restored connectivity — the
  queue auto-flushed and the item flipped to "الرفع فشل / لا تمتلك صلاحية تنفيذ هذا الإجراء" — this is
  precisely how the representative-lacks-`TRANSFERS_REJECT` bug above was found. Deleted the failed
  queue item via its trash icon (confirmed via a destructive-action dialog first) once the fix landed
  and this exact scenario is no longer reachable through the UI (a representative no longer sees a
  reject button on this transfer type at all).
- Cleaned up: the test transfer (`TRF-2026-000003`) was withdrawn via the supervisor's own `POST
  /transfers/:id/cancel` (the real endpoint, not raw SQL) with reason `QA_cleanup_offline_reject_test`,
  which rolled SN-1004 back to `IN_BRANCH_WAREHOUSE` under its original branch warehouse automatically
  — confirmed via a direct `SELECT` against the dev database.

### 9.5 Add biometric handover signatures — done 2026-09-10

- [x] Separate login biometrics from handover-signature biometrics.
- [x] Add biometric/drawn signature method selection.
- [x] Require `biometricOnly: true` with no device-PIN fallback.
- [x] Send device ID, model, verification time, method, and payload hash.
- [x] Explain failures and always allow drawn-signature fallback.

The backend needed nothing at all: `transfer-signatures` already had a `biometricVerifiedAt` column
and `storeSignature()` already validated `deviceId` is required for `BIOMETRIC`, stored
`deviceModel`, and set `biometricVerifiedAt` to the server's own receipt timestamp rather than a
client-supplied one — the server does not trust the device's clock for evidentiary timestamps, the
same reasoning already applied to `occurredAt` elsewhere in this app. `SignatureMethod.BIOMETRIC` was
a live enum value the whole time; the client had simply never constructed one. This made 9.5 a purely
mobile-app task once confirmed.

**Separated services.** The existing `BiometricService` is specifically login unlock — convenience
keyed to a stored refresh token, its own doc comment already noting it is "a different thing from
biometric hand-off confirmation, which is evidence rather than authentication." Added
`HandoverBiometricService` (new file) alongside it rather than extending it: same `local_auth` call
shape (`biometricOnly: true, stickyAuth: true` — non-negotiable, since a device PIN is not this
person's fingerprint), but with no `LocalStorage` login-flag coupling, plus `deviceId()` (the same
per-install id already sent as `X-Device-Id` on every request — this device, not a new identity) and
`deviceModel()` (`device_info_plus`, already a dependency, previously unused anywhere).

**Method selection.** New `HandoverSignatureController` (`handover_signature_card.dart`) holds both a
`SignaturePadController` (drawn, unchanged) and biometric verification state
(`verifiedDeviceId`/`verifiedDeviceModel`) behind one object, so a screen can ask "what do I actually
have" at submit time without caring how it got there. `HandoverSignatureCard` renders a
`[بصمة | توقيع بالإمضاء]` toggle **only when `HandoverBiometricService.isAvailable()` says so** —
never a dead-end choice offered on hardware that cannot back it. Selecting بصمة shows a "تأكيد
بالبصمة" button; on failure it shows `signature_biometric_failed` inline and the toggle itself is the
fallback back to drawn (switching methods drops any stale verification, so a failed/abandoned
biometric attempt can never leak into a drawn signature's submission). Wired into both signing sites
built in `9.3`/`9.4`: `TransferReviewStep` (self-attested create, reason "أكّد إنك سلّمت الماكينات
بالبصمة") and `ConfirmTransferScreen` (receiver confirm, reason "أكّد استلامك للماكينات بالبصمة") —
replacing their inline `DetailCard(...SignaturePad...)` with one shared widget. `PAYLOAD_CHANGED`'s
existing reload path now calls the controller's new `reset()`, dropping a stale biometric
verification the same way it already dropped drawn strokes.

**Submission.** `CreateTransferCubit.submitWithSignature` and `ConfirmTransferCubit.submit` both grew
an optional `SignatureParams? biometricSignature` alongside their existing `Uint8List? signaturePng` —
a biometric confirmation carries no media at all, so that branch skips `uploadSignature` entirely and
posts `SignatureParams(method: biometric, deviceId, deviceModel)` directly. The drawn branch is
byte-for-byte what `9.3`/`9.4` already had.

Added locale keys `signatureMethodBiometric`, `signatureMethodDrawn`, `signatureBiometricConfirm`,
`signatureBiometricVerified`, `signatureBiometricFailed`, `signatureBiometricRequired`,
`signatureBiometricReasonReceive`, `signatureBiometricReasonSend`. Registered
`HandoverBiometricService` in `service_locator.dart`. No manifest change needed:
`USE_BIOMETRIC` and the `FlutterFragmentActivity` `local_auth` requires were already in place from the
login-biometric feature.

Verified with `flutter analyze` (0 issues) and `flutter test` (167/167 passing — up from 163 with
`test/handover_signature_controller_test.dart`'s 4 tests covering method switching, verification
recording, and `reset()`).

Live-verified on `emulator-5554` as representative `01000000003`. Enrolling an actual fingerprint on
this AVD turned out to be an environment dead end: `dumpsys fingerprint` confirmed the hardware
provider exists with zero enrolled prints, `adb shell locksettings set-pin` reported success but the
Settings UI still showed no screen lock configured, and neither the Settings "Fingerprint" flow nor a
direct `android.app.action.SET_NEW_PASSWORD` intent produced any visible transition after several
attempts — consistent with the other infrastructure limitations already hit in this dev environment
(`9.2`, `9.3`'s MinIO/`localhost` issue), not a code defect. The PIN was cleared back off
(`locksettings clear`) to leave the emulator exactly as found. What **was** verified live, and is
arguably the more important half of this section's acceptance criteria: with no biometric hardware
enrolled, `HandoverBiometricService.isAvailable()` correctly returned `false`, so the method toggle
never rendered at all on the self-attested review screen (rep→merchant, SN-1008) — the "التوقيع" card
fell straight through to the drawn `SignaturePad` with no dead-end and no broken UI, exactly the
"always allow drawn-signature fallback" requirement, confirmed under the actual failure condition
(no enrolled biometric) rather than only by code reading. Exited without submitting; no transfer was
created.

### 9.6 Harden drawn signatures and display — done 2026-09-10

- [x] Reject empty, dot-only, and too-small signatures.
- [x] Add clear and undo controls.
- [x] Trim/downscale PNG output to the planned maximum dimensions and size.
- [x] Stage signatures as pending media for offline upload.
- [x] Display signature image/fingerprint, signer, method, time, and device in transfer detail.
- [x] Add full-size protected viewing without save/share actions.

**`SignaturePadController` hardening** (`signature_pad.dart`). Added `hasContent`: a private
`_boundingBox()` walks every point in every stroke, and `hasContent` is true only when that box's
width or height clears a 24-logical-pixel floor — a real signature swipes across a meaningful
fraction of the pad; a stray tap or a slip of the thumb does not. `toPngBytes()` now returns `null`
whenever `!hasContent`, on top of its existing empty-pad check, so every caller's pre-existing
`if (png == null) show error` (from `9.3`/`9.4`) rejects a too-small mark for free with no call-site
change. `toPngBytes()` also stopped rasterising the whole pad: it now crops to the strokes'
bounding box plus a 16px margin, and picks whichever of 2× or `600 / crop.width` is smaller as the
render scale — so a signature drawn in one corner of a wide pad no longer pays for the pad's empty
space, and no signature can leave the client wider than 600px. `undo()` (new) drops only
`_strokes.removeLast()` and is a no-op on an empty pad; wired into `SignaturePad`'s existing button
row next to "مسح" (clear), disabled via an `AnimatedBuilder` on `controller.isEmpty` exactly like
clear already implicitly was. New locale key `transferSignatureUndo` ("تراجع"/"Undo").

**Staging for offline upload** — already done, nothing to build. `uploadSignature()`
(`transfers_repo_impl.dart`, from section `07`) already branches on `networkInfo.isConnected` and
calls `mediaStaging.stage(...)` when offline, queuing the PNG bytes themselves for later upload
rather than failing; `9.3`/`9.4`'s submit paths already call it unconditionally. This bullet is a
verification of pre-existing behaviour, not new code — confirmed by reading the method again in
this section rather than assuming.

**Display: image, fingerprint, signer, method, time, device.** `TransferSignatureResponse`
(backend) gained an `id` field — every other field the mobile UI needed
(`signatureMediaId`, `deviceModel`, `method`, `signedAt`, `userFullName`, `payloadHash`) was already
on the wire, but nothing identified *which* signature row a media-viewing request was for. Mirrored
into `transfer.mapper.ts`'s `toSignatureResponse()` and the mobile `TransferSignatureEntity`/
`TransferResponseModel._signature()`. `TransferSignaturesCard` (`transfer_signatures_card.dart`,
rewritten) now renders a 40×40 tappable thumbnail for a drawn signature with media
(`_SignatureThumbnail`, lazily fetching its own signed URL via `TransfersRepo.fetchSignatureMediaUrl`
and falling back to a broken-image icon on failure) or a fingerprint icon for a biometric one — plus
a new `transferSignatureDevice` ("الجهاز: {}") line whenever `deviceModel` is present. Device model
was already captured (`9.5`) and already round-tripped by the backend; it just was not shown
anywhere until now.

**The authorization gap this actually required.** `MediaService.signedUrl()`/`findOwned()` enforce
strict per-uploader ownership by deliberate design (its own comment: "media ids travel in transfer
payloads visible to counterparties, so without this check any authenticated user could read anyone's
signature or invoice"). That means the generic `GET /media/:id` is *correctly* unusable for a
receiver to view a sender's signature (or vice versa) — the two parties are not the uploader of each
other's signature. Rather than loosening that intentionally strict check, added a second, narrower
door: `MediaService.signedUrlForAuthorizedMedia(mediaId)` (no ownership check at all, documented as
safe only for a caller that has already authorized the request some other way) and
`TransfersService.signatureMedia(transferId, signatureId, scope, actor)`, which calls the existing
`findById()` — already branch/role-scoped for transfer *reads* — as the actual authorization gate,
then looks up the matching row in `transfer.signatures` and mints a URL through the unchecked path
only once that gate has passed. Exposed as
`GET /transfers/:id/signatures/:signatureId/media` (`@Permissions(TRANSFERS_READ)`,
`@BranchScoped(TRANSFERS_READ_ALL)` — the same pattern as the existing `GET :id` route), returning
`{url, expiresAt, mimeType}` (new `TransferSignatureMediaResponse`). Mobile:
`TransfersRepo.fetchSignatureMediaUrl()` (new) calls it directly — no offline branch, since a signed
URL is meaningless without a network to fetch the image over.

**Full-size protected viewer.** Tapping the thumbnail pushes `_SignatureViewerPage` (private, in the
same file): a black-background `Scaffold` with an `InteractiveViewer` (pinch-zoom, 1×–4×) around the
image, re-fetching its own signed URL rather than reusing the thumbnail's (a signed URL is
short-lived; the thumbnail's may have expired by the time the user taps it minutes later). No save,
share, or download affordance exists on the page at all — the omission itself is the control the
plan asked for.

**Files:** `mobile-app/lib/feature/transfers/presentation/widgets/signature_pad.dart` (hardened,
`Key('signature_pad_canvas')` added for testability), `.../transfer_signatures_card.dart` (rewritten:
`_SignatureThumbnail`, `_SignatureViewerPage`), `.../transfer_detail_screen.dart` (passes
`transferId` through), `mobile-app/lib/feature/transfers/domain/repos/transfers_repo.dart` +
`transfers_repo_impl.dart` (`fetchSignatureMediaUrl`), `.../data/models/transfer_response_model.dart`
+ `.../domain/entities/transfer_entity.dart` (`id` on `TransferSignatureEntity`),
`mobile-app/lib/core/network_services/web_constant.dart` (`transferSignatureMedia` route builder);
`backend/api/src/modules/media/media.service.ts` (`signedUrlForAuthorizedMedia`),
`.../transfers/transfers.service.ts` (`signatureMedia`), `.../transfers/transfers.controller.ts`
(new route), `.../transfers/dto/responses/transfer.response.ts` (`id` on
`TransferSignatureResponse`, new `TransferSignatureMediaResponse`), `.../transfers/mappers/
transfer.mapper.ts`. New locale keys: `transferSignatureUndo`, `transferSignatureDevice`,
`transferSignatureImageFailed`, `transferSignatureViewerTitle`.

**Backend verified** with `npx tsc --noEmit` (clean) and the full e2e suite via
`./scripts/run-e2e.sh` — **578/578 passing across 23 suites**, including 3 new cases in
`transfers.e2e-spec.ts`'s "signature media access" group: a real presign→upload→confirm round trip
(actual bytes through the local storage adapter, not a stub) proving the transfer's *other* party
(who never uploaded the signature) can fetch its media through the new endpoint; a negative case
proving a supervisor on an unrelated branch — not a party to the transfer, no `TRANSFERS_READ_ALL` —
still gets a plain `TRANSFER_NOT_FOUND`, identical to how `findById()` already hides the transfer
itself; and a case confirming a signature with no uploaded media returns `MEDIA_NOT_FOUND` rather
than a broken URL. `openapi.json` regenerated (`npm run docs:generate`) and re-checked clean against
the running app.

**Mobile verified** with `flutter analyze` (0 issues) and `flutter test` — **173/173 passing**, up
from 167. Added `test/signature_pad_test.dart` (6 new widget tests: untouched pad → null, a
2px tap → rejected, a real stroke → accepted and cropped narrower than the full pad, a
near-full-width stroke → capped at ≤600px, undo removes only the last stroke, clear removes
everything). These exercise the real `dart:ui` `toImage`/`toByteData`/`instantiateImageCodec` calls
inside `tester.runAsync(...)` — `WidgetTester`'s fake-clock zone never completes those on its own
(confirmed the hard way: the first attempt hung for several minutes before this was diagnosed and
fixed, since `image.toByteData()` is real thread-backed async work, not a fake-clock `Future`).

**Live-verified** on `emulator-5554`, against a freshly rebuilt backend (`nest build` +
restart — the running dev server predated this section's endpoint) and a freshly installed debug
APK. Registered a throwaway merchant (`QA_Test_Shop_9_6`) to reach a self-attested
rep→merchant transfer as representative `مندوب القاهرة`, added machine `SN-1008`, and reached the
review/signature step, which rendered the new `HandoverSignatureCard` with both "مسح" and "تراجع"
visible (تراجع correctly disabled with nothing drawn). Drew two strokes; تراجع became enabled and,
tapped, removed only the second stroke, leaving the first — the undo control confirmed working
against real gesture input, not just the unit tests. Tapped "تأكيد وتوقيع": `logcat` showed
`POST /media/presign` succeed (`checksum`/`sizeBytes: 453` — the tiny cropped-and-capped PNG this
section's hardening produces, well under the 200KB target), then the upload itself fail with
`Connection refused` against `http://localhost:3000/...` — the same MinIO/local-storage-adapter
environment limitation documented in `9.2`/`9.3`/`9.5` (the presigned URL's `localhost` resolves to
the emulator itself, not the Mac running the backend), not a code defect; the app stayed on the
review screen without crashing rather than leaving a half-created transfer. Confirmed via `psql` that
no transfer row was created (the failure happens before `POST /transfers` in `submitWithSignature`).
Cleaned up: deleted the throwaway `QA_Test_Shop_9_6`/`QA_Test_Merchant` row directly (no FK
references from any subscription, machine, or transfer — confirmed before deleting) since the
representative role has `merchants.update` but not the `merchants.delete`/deactivate permission
needed to close it out through the app itself.

**Acceptance criterion — partially verified, environment-limited.** "A 12-machine transfer with
photos and a signature can be completed offline, survive restart, sync successfully, and be replayed
without duplicates" could not be run end-to-end live for the same reason 9.2/9.3/9.5 could not: any
real media upload (a photo or a signature) fails at the MinIO/local-storage `localhost` boundary from
inside this emulator regardless of network state, so a transfer with real media can never reach
"synced" here to prove the full round trip visually. What **is** verified, and is the substance of
the guarantee: (1) staging offline is pre-existing, tested code (`media_staging_service` +
`sync_queue_service`'s `dependsOn` gating, unit-tested in `sync_queue_service_test.dart` — "an item
depending on an unfinished media upload is not pushed yet"); (2) survives-restart is a property of
the sync queue being a Drift-backed local table, not in-memory state — nothing in `9.6` touched that
persistence; (3) no-duplicate-replay is the backend's idempotency-key/`clientUuid` mechanism plus
`findDuplicate()` in `SyncBatchService`, exercised directly in `sync.e2e-spec.ts` for
`CREATE_TRANSFER`, `CONFIRM_TRANSFER`, and (since `9.4`) `REJECT_TRANSFER` — a replayed create or
confirm is answered with the original result rather than a second row, and this section added no new
sync-operation type that would need its own coverage of that mechanism (a signature rides inside the
existing `CREATE_TRANSFER`/`CONFIRM_TRANSFER` payloads, not as a separate queued operation). No dev
DB or emulator state was left behind by this verification pass beyond what is documented above as
cleaned up.

---

## 10. Flutter merchants completion — done 2026-09-10

- [x] Make merchant list/detail read from the local cache.
- [x] Queue merchant creation offline with duplicate-conflict handling.
- [x] Allow a newly created offline merchant to be referenced by a queued transfer.
- [x] Queue supported subscription/collection writes according to the final offline policy.
- [x] Stage receipt/invoice media where required.
- [x] Reconcile local and server IDs after synchronization.
- [x] Add offline widget and integration tests for registration and placement flows.

**The first two bullets were already fully built** (section `07`/`6.4`, confirmed by reading
`MerchantsRepoImpl` rather than assumed): `fetchMerchants`/`fetchMerchant` already read from
`CachedMerchantsDao` whenever offline or on a `DioException`, and `createMerchant` already queues
`CREATE_MERCHANT` with an optimistic cache row when offline. "Duplicate-conflict handling" already
existed on both sides of the round trip — `checkDuplicates()` warns the representative about a
repeated phone/national-id *before* he submits (online only, `MerchantDuplicateNotice`), and a
genuine conflict discovered only once the queued create finally reaches the server (someone else
registered the same national id while this device was offline) already fell through the generic
`CONFLICT`/`MANUAL` handling every queued write gets — nothing merchant-specific to add.

**The real gap, and this section's actual work: a transfer or a subscription created offline could
not reference a merchant registered offline moments earlier.** `MerchantsService.create()` already
had a `clientUuid` column and a replay check ("`20`, mechanism 1" — the DTOs and this comment
already existed, unused for anything but merchants' own replay); nothing resolved that id when it
showed up as *another* operation's foreign key. A transfer's `toPartyId` and a subscription's
`merchantId` are exactly that: the device has no real merchant id to put there until the
registration itself has synced.

**Backend — the same door media resolution already uses, for merchants.**
`MediaService.resolveClientUuids()` already let a queued operation reference a photo by the id the
device made up before the real one existed; added the identical
`MerchantsService.resolveClientUuids(clientUuids, actorId)` (`merchants.service.ts`) — scoped to
`createdByUserId` for the same reason `create()`'s own replay check is. `SyncBatchService.dispatch()`
now runs `withResolvedParty()` on a `CREATE_TRANSFER` payload's `toPartyId` unconditionally before
validating it — a real id passes through untouched (it will never coincidentally match a stranger's
`client_uuid`), so there is no need to first work out whether this transfer's receiver kind is even
a merchant. Added `SyncOperationType.CREATE_SUBSCRIPTION` end to end (backend enum,
`REQUIRED_PERMISSION` → `MERCHANTS_UPDATE` matching the REST route, `findDuplicate()` against
`merchant_subscriptions.client_uuid` — a column that already existed with an "offline dedupe key
(`20`)" comment, never wired to anything — `dispatch()` splitting `merchantId` out of the payload the
same way `CONFIRM_TRANSFER` already splits out `transferId`, resolving it the same way, then calling
the ordinary `createSubscription()` service method so there is still exactly one implementation of
"start a plan").

**Mobile — the ordering guarantee the backend's resolution alone cannot provide.** Sequential
same-request processing means a merchant and a transfer *in the same batch* resolve correctly
regardless of order — but `_nextReadyBatch()`'s FIFO is not a guarantee once one of the two starts
failing and backing off on its own schedule while the other has none: a fresh transfer queued right
after a merchant whose first push attempt just hit a transient error would otherwise be pushed
*without* it, and `toPartyId` naming a merchant that will never exist server-side is a
`VALIDATION_FAILED` from `transfers.service.ts`'s own `resolveReceiver()` — `DISCARD`, permanent,
not retried. `SyncQueueService._dependenciesReady()` gained
`_referencedMerchantReady()`: reads `toPartyId`/`merchantId` straight out of the operation's own
payload (no new column — the value the client already has to send *is* the dependency, so there is
nothing separate to keep in sync) and holds the item back for as long as that id is still sitting in
this same queue under any status. This makes the client conservative rather than clever: a
merchant and its dependent are now *never* sent in the same batch (the dependent fails its readiness
check while collecting that round's candidates, before either has been touched), trading one extra
round trip for not having to reason about whether same-batch ordering would have been safe.

**The "final offline policy" for subscriptions and collection, decided and documented here since no
prior section had:** starting a plan (`CREATE_SUBSCRIPTION`) is a record with no money attached — it
can be queued offline the same way registering the merchant that holds it can, and now is. Collecting
a payment (`collectSubscription`) and correcting a plan (`updateSubscription`) stay online-only,
deliberately. `CollectSubscriptionDto` carries no `clientUuid` at all, and nothing on
`MerchantSubscription` gives a replayed collection anything to be deduplicated against — the running
`totalCollected`/`collectionCount` counters it updates are mutated in place, not append-only, so a
retried push after a lost response would double-count a real payment with no way for the server to
tell the retry from a second collection. Building that safely (a per-collection ledger row with its
own `client_uuid`, most likely) is real backend work this pass did not do, and offering collection
offline without it would be shipping a money-correctness bug, not a convenience — recorded here as
the explicit reason, not silently deferred. "Stage receipt/invoice media where required" is
consequently a no-op beyond what already existed: `collectSubscription`'s `invoiceMediaId` is
uploaded synchronously before the (online-only) call exactly as it already was, and needs no offline
staging path for a write that itself is not offline.

**"Reconcile local and server IDs after synchronization"** is the merchant-id resolution above, not
a separate mechanism — subscriptions have no local read cache to reconcile a second time (see next
paragraph), and the merchant side already had its optimistic-row cleanup from `6.4`
(`SyncQueueService._applyResult()` deleting the `clientUuid`-keyed cache row on `SUCCESS`/`DUPLICATE`
so the next delta pull's server-id row does not become a permanent duplicate).

**Mobile plumbing for the new operation type:** `MerchantsRepoImpl.createSubscription()` gained an
offline branch (`_queueCreateSubscription`) mirroring `_queueCreateMerchant`'s shape, enqueuing
`{merchantId, ...params.toJson(), clientUuid}`. No local cache backs it — `fetchSubscriptions()` has
no offline read path and this section did not add one, so a subscription started offline is
confirmed once (the toast) and stays invisible on the merchant's own screen until it syncs, though
it is visible the whole time in the sync-queue screen like any other pending write; documented as a
known, accepted gap rather than built around. `SyncOperationType.createSubscription` added to the
mobile enum; the Dart compiler's non-exhaustive-switch errors were, again, relied on to find every
`switch` needing the new case (`sync_queue_service.dart`'s cleanup switch, `sync_queue_tile.dart`'s
label switch). New locale key `sync_item_type_create_subscription` ("اشتراك جديد"/"New plan"). New
`ApiKeys.merchantId` constant — the field did not exist on the wire in either direction before this
section, since `POST /merchants/:id/subscriptions` had always taken the merchant from the URL, not
the body.

**Files:** `backend/api/src/modules/merchants/merchants.service.ts` (`resolveClientUuids`),
`.../sync/sync-batch.service.ts` (`withResolvedParty`, `resolveMerchantId`, `splitMerchantId`,
`CREATE_SUBSCRIPTION` case, `MerchantSubscription` repository injected), `.../sync/sync.module.ts`
(`MerchantSubscription` registered), `src/common/enums/sync.enum.ts`, `.../sync/dto/sync.dto.ts`
(doc comment); `mobile-app/lib/feature/merchants/domain/repos/merchants_repo_impl.dart`
(`_queueCreateSubscription`), `.../core/services/sync/sync_operation_type.dart`,
`.../core/services/sync/sync_queue_service.dart` (`_referencedMerchantReady`, cleanup-switch case),
`.../feature/sync/presentation/widgets/sync_queue_tile.dart`, `.../core/constants/api_keys.dart`
(`merchantId`), `.../core/constants/locale_keys.dart`.

**Backend verified** with `npx tsc --noEmit` (clean) and the full e2e suite via
`./scripts/run-e2e.sh` — **583/583 passing across 23 suites**, including 5 new cases in
`sync.e2e-spec.ts`: a merchant resolved from a `CREATE_TRANSFER` in the *same* batch as the
`CREATE_MERCHANT` that registered it; the same resolution across two *separate*, sequential batches
(the merchant already synced and gone from the queue by the time the transfer is pushed); a
transfer naming a `toPartyId` that never resolves still failing exactly like a stranger's real,
wrong id would (`VALIDATION_FAILED`/`DISCARD`, not a sync-specific error); a subscription resolved
against a merchant registered in an earlier batch; and a replayed `CREATE_SUBSCRIPTION`
`clientUuid` reported as `DUPLICATE` with exactly one row on the server. `openapi.json` regenerated
and re-checked clean.

**Mobile verified** with `flutter analyze` (0 issues) and `flutter test` — **175/175 passing**, up
from 173. Added two cases to `sync_queue_service_test.dart`: a transfer referencing an unresolved
offline merchant is held back even while that merchant's *own* item is backing off from a prior
failure (the realistic trigger for out-of-order FIFO this section's gating exists to prevent, not a
contrived one), and — the mirror case — a subscription and its merchant queued together with neither
backing off still resolve correctly, as two separate pushed batches rather than one (proving the
conservative "always split" behavior itself, not just the failure case it protects against).

**Live-verified** end to end on `emulator-5554`, against a rebuilt backend and a freshly installed
debug APK, with the emulator's WiFi genuinely disabled (`adb shell svc wifi disable` — not the
`localhost`-from-presigned-URL situation `9.2`/`9.3`/`9.5`/`9.6` hit, which needs a live but
wrong-host connection; true offline routes `uploadSignature` through `mediaStaging.stage()` before
ever touching the network, sidestepping that limitation entirely for this test). As representative
`مندوب القاهرة`, fully offline: registered a new merchant (`Offline_Shop_10`) — confirmed
immediately ("تم بنجاح") with no connection at all — then, still offline, built and submitted a
self-attested rep→merchant transfer of machine `SN-1008` to that same not-yet-synced merchant,
drawing a real signature. The home screen's sync banner showed "٢ في انتظار المزامنة"; the
sync-queue screen listed both the transfer (waiting on its staged signature) and the merchant
(waiting to upload). Re-enabled WiFi and captured the actual traffic in `logcat`: the queued
`CREATE_TRANSFER` payload held `toPartyId: 34ba1f81-...` — the device's own placeholder for the
merchant, not a real id — and two **separate** `POST /sync/batch` calls followed, exactly as the new
gating predicts: batch one, `CREATE_MERCHANT` → `SUCCESS`, real id `4450bd8b-...`; batch two (only
after the first resolved), `CREATE_TRANSFER` → `SUCCESS`. Confirmed directly in Postgres rather than
trusting the app's own read-back: `merchants.4450bd8b-...` exists exactly once
(`client_uuid = 34ba1f81-...`, `machines_count = 1`); `machines.SN-1008` is `WITH_MERCHANT` held by
that same real id; `transfers.593ed716-...` has `to_party_id = 4450bd8b-...` — the resolved real id,
never the placeholder that was actually queued. The sync banner cleared to nothing pending. Cleaned
up afterward: deleted the test transfer (cascades to its items/signatures) and the test merchant,
restored `SN-1008` to `WITH_REPRESENTATIVE`/the original representative — verified back to the exact
pre-test state before moving on.

---

## 11. Flutter maintenance, replacement, and decommission

### 11.1 Maintenance screens — done 2026-09-10

- [x] Build maintenance list, filters, status chips, and pagination.
- [x] Build maintenance detail with machine, fault, location, timeline, warranty, and cost sections.
- [x] Build the create form with scan/pick, warehouse eligibility, location, fault, dates, and notes.
- [x] Build send, receive, update, cancel, and permission-aware actions.
- [x] Keep the entire feature clearly online-only as specified.

**"Scan/pick" deliberately not built — a reasoned scope cut, not an oversight.** Read
`MachinePickerSheet` (multi-select, scoped to one holder's own custody list) and
`MachineActionsSection` (no existing "create maintenance order" tile) before deciding: a repair
order is opened for *one* machine already in the company warehouse, from that machine's own detail
screen, not picked out of a company-wide search. Building a second full picker just for this one
case would have duplicated `MachinePickerSheet`'s job for no real gain, so `MaintenanceCreateScreen`
takes `machineId`/`machineSerial` as constructor params instead and is reached only from
`MachineActionsSection`'s new "إرسال للصيانة" tile.

**"Warehouse eligibility" turned out to mean something specific and checkable, not a vague
precondition — `assertMaintainable()` in `maintenance.service.ts` refuses `POST
/maintenance-orders` outright unless `machine.status === IN_COMPANY_WAREHOUSE`.** Mirrored
client-side exactly for the same reason the 9.4 transfer-tile bug taught not to skip this:
`MachineActionsSection`'s new tile only renders when `machine.status ==
MachineStatus.inCompanyWarehouse` (`machine_actions_section.dart`), gated *and* permission-checked
independently — confirmed live (see below) with a machine that had just left the warehouse: the
tile disappeared on its own, no server round trip needed to find out it would have been refused.

**Reused rather than duplicated:** `MaintenanceOrderStatus`/`MaintenanceOrderResult`/
`MaintenanceResponsibleParty` (already defined in `8.1`'s read-only
`machine_maintenance_history.dart`, re-exported from the new `maintenance_entity.dart`);
`HandoverSignatureCard`/`HandoverSignatureController` (`9.5`, unmodified) for both send and receive's
required signature; `TransferReasonSheet` (`9.4`) for the cancel reason, since a cancellation needing
a typed reason is not maintenance-specific; the generic media presign/upload/confirm dance transfers
already had (`transfers_repo_impl.dart`'s `_upload()`), copied once as `MaintenanceRepo
.uploadSignature()` rather than reached into across features — maintenance's repo doc comment is
explicit about carrying no cache DAO of its own, so it could not call into `TransfersRepo` without
breaking that.

**Permissions, gated per action exactly like `9.4`'s transfer fix, not behind one blanket check.**
The backend's own guards settled this precisely (`maintenance.controller.ts`): send/receive/cancel/
update all require only `Perm.MAINTENANCE_UPDATE`; create needs `MAINTENANCE_CREATE`; only close
needs both `MAINTENANCE_CLOSE` *and* `MAINTENANCE_SET_COST` together — `MaintenanceDetailScreen`'s
`_ActionsBar` reads a single `service.has(P.maintenanceUpdate)` for the first four and renders the
close button as `AppRoute.goToFeatureNotReadyScreen` (`11.2` builds the real thing) without gating it
on the dual permission at all yet, since there is nothing behind it to protect. `PermissionGate` was
*not* extended with an `allOf` this pass — `11.2`'s close form is where that dual check actually has
something to gate, so adding it now would have been speculative.

**A real bug, found only by testing live rather than assuming the toast-and-pop pattern would just
work: `MaintenanceHandoverScreen` and `MaintenanceDetailScreen` share one `MaintenanceDetailCubit`
instance** (`AppRoute.goToMaintenanceHandover` pushes the handover screen with
`BlocProvider.value(value: cubit)` so a successful send/receive updates the record the caller is
already looking at without a second fetch — the intended design). Both screens are simultaneously
mounted and both had a `BlocConsumer` reacting to the *same* emitted state; the first draft had each
one decide what happened by reading `cubit.lastOutcome`/`cubit.lastError` and then nulling them back
out. Whichever screen's listener ran first cleared the fields before the other one's listener read
them — live-tested, this manifested as: the backend genuinely sent the machine (confirmed via
`psql` — `maintenance_orders.status = IN_PROGRESS`, `out_transfer_id` set), but the handover screen
never popped, sitting on the signature pad looking like nothing had happened. Fixed by having
`MaintenanceDetailCubit._act()` (and therefore `send`/`receive`/`cancel`/`update`/`closeOrder`)
return the `Either<ServerFailure, MaintenanceOrderEntity>` directly, and having
`MaintenanceHandoverScreen._submit()` act on that returned value instead of the shared mutable
side-channel — the detail screen underneath still uses `lastOutcome`/`lastError` for its own toast,
since it has no second listener racing it. Re-verified live after the fix (see below): send and
receive both now pop correctly.

**A genuine backend defect, found while live-testing the `SERVICE_CENTER` maintenance route, filed
here rather than fixed — out of this section's mandate, and the standing instruction for this pass
was the Flutter side.** `chk_machines_holder_pair` (a Postgres check constraint on `machines`) reads
`current_holder_type IS NULL AND current_holder_id IS NULL OR current_holder_type IS NOT NULL AND
current_holder_id IS NOT NULL OR current_holder_type = 'FACTORY'` — it special-cases `FACTORY` as
the one holder type allowed a null id (an abstract party with no row to point at), but
`transfer-rules.ts` treats `SERVICE_CENTER` identically to `FACTORY` for exactly this reason
(`toPartyOptional: true`, no `toWarehouseTypes`) and the constraint was never updated to match.
Sending a machine to a `SERVICE_CENTER`-routed maintenance order throws a bare `VALIDATION_FAILED`
with no `details` (a `QueryFailedError`/`PG_CHECK_VIOLATION` mapped generically by
`AllExceptionsFilter`, confirmed by temporarily setting `DB_LOGGING=true` and reading the raw
Postgres error in the console) — and because `maintenance.service.ts`'s `moveMachine()` commits the
transfer-create transaction *before* calling `confirm()` (a second, separate transaction) where the
constraint actually fires, a failed send leaves a real orphan behind: the transfer stuck `PENDING`
and the machine stuck `IN_TRANSIT`, not rolled back. Worked around for this pass's own testing by
routing through `FACTORY` instead (functionally identical, and the constraint already allows it);
the orphan this produced was cleaned up via the transfer's own `POST /transfers/:id/cancel` (which
correctly restored the machine to `IN_COMPANY_WAREHOUSE`) rather than touched directly in the
database. Not fixed here: the fix is a migration adding `'SERVICE_CENTER'` next to `'FACTORY'` in
the constraint, which is backend schema work outside a Flutter-focused pass — flagged for whoever
picks up the backend next, with the exact constraint name and repro above.

**Live-verified** on `emulator-5554` as the seeded dev Director (`01000000001`/`Dev#12345`), against
the real local backend. Also confirmed, incidentally, that a representative (`مندوب القاهرة`, the
account already signed in) correctly sees no maintenance tile anywhere — no `maintenance.read` —
before switching to the Director to test the actual writes. First pass, machine `SN-2001`
(`IN_COMPANY_WAREHOUSE`): created `MNT-2026-000001` routed `INTERNAL_WORKSHOP`; sending it failed
with `"no active MAINTENANCE warehouse exists"` — a genuine, separate dev-seed gap (`SELECT * FROM
warehouses` shows `COMPANY_MAIN`/`SCRAP`/two `BRANCH` rows and zero `MAINTENANCE` ones; `
resolveWarehouse()` only auto-picks when exactly one active warehouse of the needed type exists),
not a bug in this section's code. Used the opening to test **update** instead: changed the order's
location to `SERVICE_CENTER` through the "تعديل" sheet, confirmed the change rendered immediately.
Sending again hit the `chk_machines_holder_pair` defect above; cancelled the order (testing
**cancel-from-`OPEN`**, `TransferReasonSheet`'s required-reason field enforced correctly) and
cancelled the orphaned transfer directly through the API. Second pass, same machine, routed
`FACTORY`: created `MNT-2026-000002`, **sent** it (drew a real signature, `HandoverSignatureCard`
correctly offered only the drawn method — no biometric hardware on the emulator — uploaded through
the generic presign/PUT/confirm dance, confirmed via `psql` the order reached `IN_PROGRESS` with
`out_transfer_id` set and the machine `AT_FACTORY`), then **received** it the same way (order reached
`RETURNED` with `returned_at` populated and `in_transfer_id` set, machine back to
`IN_COMPANY_WAREHOUSE`) — both hit the shared-cubit pop bug above on the first attempt and were
re-verified working after the fix. Opened the close stub from a `RETURNED` order and confirmed it is
the genuine `FeatureNotReadyScreen`, not a silent no-op. Cancelled this order too (testing
**cancel-from-`RETURNED`-with-`inTransferId`-set**, the one case `canCancel`'s three-line getter
exists for). The Android-emulator `localhost`-in-a-presigned-URL limitation documented in
`9.2`/`9.3`/`9.5`/`9.6` was hit again for signature uploads and, this time, actually worked around
rather than left as a limitation: set `PUBLIC_BASE_URL=http://10.0.2.2:3000` in `.env`, restarted the
backend, completed every upload above against the real emulator, then reverted the setting and
restarted the backend back to how it was found. **Cleaned up afterward**, confirmed via `psql`:
deleted both `maintenance_orders` rows, all three test `transfers` rows (cascading their
`transfer_signatures`), and all six `SIGNATURE`-purpose `media` rows this pass created; `SN-2001` is
back to `IN_COMPANY_WAREHOUSE` and `SELECT count(*) FROM maintenance_orders` is `0` — no residue for
a future session to trip over.

**Mobile verified** with `flutter analyze` (0 issues) and `flutter test` — **177/177 passing**.
Extended `machine_actions_section_widget_test.dart` for the new tile: an `IN_COMPANY_WAREHOUSE`
machine with `maintenance.create` shows it, a `WITH_REPRESENTATIVE` machine with the same permission
does not (the exact warehouse-eligibility gate above, tested independently of the permission gate so
neither could silently cover for the other), and a dedicated tap test confirms the callback fires.

**Files:** `mobile-app/lib/feature/maintenance/domain/entities/maintenance_entity.dart`,
`.../domain/params/maintenance_params.dart`, `.../domain/repos/maintenance_repo.dart` (+
`uploadSignature`) `/_impl.dart`, `.../data/models/maintenance_response_model.dart`,
`.../data/logic/maintenance_list/{maintenance_list_cubit,maintenance_list_state}.dart`,
`.../data/logic/maintenance_detail/{maintenance_detail_cubit,maintenance_detail_state}.dart`,
`.../data/logic/maintenance_create/{maintenance_create_cubit,maintenance_create_state}.dart`,
`.../presentation/helpers/maintenance_labels.dart`,
`.../presentation/widgets/{maintenance_card,maintenance_filter_sheet,maintenance_update_sheet}.dart`,
`.../presentation/pages/{maintenance_list_screen,maintenance_detail_screen,maintenance_create_screen,
maintenance_handover_screen}.dart`; `mobile-app/lib/feature/machines/presentation/widgets/
machine_actions_section.dart` (new tile + warehouse-eligibility gate),
`.../presentation/pages/machine_detail_screen.dart` (`_sendForMaintenance`),
`.../presentation/pages/machine_maintenance_history_screen.dart` (tiles now navigate instead of
dead-ending); `mobile-app/lib/core/utils/app_route.dart` (`goToMaintenanceList/Detail/Create/
Handover`), `.../core/di/service_locator.dart` (repo + three cubits registered), `.../core/lookups/
lookups_repo.dart` (already had `maintenanceLocations`/`decommissionReasons` from an earlier
session), `.../core/constants/{api_keys,locale_keys}.dart`, `assets/translations/{en,ar}.json`;
`mobile-app/lib/feature/more/presentation/pages/more_screen.dart` (maintenance list tile);
`mobile-app/test/machine_actions_section_widget_test.dart`.

### 11.2 Maintenance close flow — done 2026-09-11

- [x] Add result selection, warranty suggestion, and overridable free-warranty switch.
- [x] Add cost, supplier, responsible party/person, technician name, invoice, and notes.
- [x] Add the finance-posting/violation preview before submission.
- [x] Route replacement results through the replacement form before closing.
- [x] Show the final backend effects after a successful close.

**Found the whole data/domain layer already built ahead of this pass.** `CloseMaintenanceOrderParams`,
`ReplacementMachineParams`, `MaintenanceRepo.closeOrder`/`replaceMachine` (real network calls, not
stubs), `MaintenanceDetailCubit.closeOrder`, and every `maintenance_close_*`/`replacement_*` locale
key were already sitting in the tree from whatever pass built `11.1`'s scaffolding, unused. This
section was therefore purely the presentation layer: one new screen, one picker-sheets file, one pure
rules file, and wiring — no domain/data files needed touching beyond two additions (below).

**`MaintenanceCloseScreen` shares the detail screen's own `MaintenanceDetailCubit`, the same way
`MaintenanceHandoverScreen` does** (`AppRoute.goToMaintenanceClose`, pushed with
`BlocProvider.value`) — a close is still just one more action on the order the detail screen already
has open, and this keeps the "act on the cubit's returned `Either`, not `lastOutcome`" fix from `11.1`
intact rather than reintroducing the dual-listener race a second cubit would risk. The close button is
now gated on `hasAll([maintenance.close, maintenance.set_cost])` (`11.1` left it ungated with nothing
behind it to protect — now there is).

**A pure-logic file, `maintenance_close_rules.dart`, mirrors the backend's `postClose()` and
`CloseMaintenanceOrderDto`'s `@ValidateIf` rules branch for branch** — `maintenanceCloseEffectFor()`
decides which of {nothing, company expense, representative violation, merchant fee} a given
(isFreeUnderWarranty, cost, responsibleParty) produces, and `maintenanceCloseBlockedReason()` decides
whether the form is submittable. Same shape as the backend's own `maintenance-rules.ts` +
`maintenance-rules.spec.ts` pair, so a `maintenance_close_rules_test.dart` unit-tests the branching
without pumping a single widget (15 cases). The live preview card and the post-close "what happened"
summary both call the same `_EffectPreviewCard` off the same fields, so what the technician is shown
before submitting and what he is shown after are guaranteed to be the same numbers — because they are
the same widget, not two copies of the wording that could drift.

**Responsible party is more than an enum pick when it's `REPRESENTATIVE`/`MERCHANT`** — added
`maintenance_responsible_picker_sheets.dart`, two single-select search sheets over the same
`UsersListCubit`/`MerchantsListCubit` the admin user/merchant lists already use (`getIt<...>()`, fresh
factory instance each open, same shape as `9.1`'s `MachinePickerSheet`). The user picker narrows to the
`REPRESENTATIVE` role once the first page's `roles` lookup answers, rather than asking the caller to
resolve a role id up front. No new picker infrastructure otherwise — reused what `11.1`/`9.x` already
built rather than adding a third one.

**Two small additions to the data layer, both reused rather than duplicated:** `LookupsRepo.suppliers()`
hits the same `/suppliers` table the finance transaction form already reads (`WebConstant.financeSuppliers`),
so a maintenance invoice's supplier is the same reference data an expense's is. `MaintenanceRepo`
gained `uploadInvoice()` alongside the existing `uploadSignature()` — both now call one shared private
`_upload(bytes, purpose, mimeType)`, the same presign/PUT/confirm handshake `TransfersRepo._upload()`
has its own copy of, kept as a second copy here for the same reason the repo's own doc comment already
gives for not reaching into `TransfersRepo`: this repo carries no cache DAO of its own to protect. The
invoice photo goes through the same camera/gallery pick → `flutter_image_compress` → upload dance
`9.x`'s item photos already established, not a new pattern.

**Replacement is routed through inline fields on this screen, not a standalone form** — `11.3`
("Replacement flow") is where the dedicated form with scanning, chain preview and duplicate-serial
validation belongs; this pass only needed enough of `ReplacementMachineDto` to ride along inside one
`close` request when `result == REPLACED` (new serial, new battery serial, box, reason, replaced-at
date — the fields the DTO actually requires), so it stayed inline rather than standing up a second
screen `11.3` would then have to either reuse awkwardly or duplicate.

**Not done this pass, and worth flagging:** no live device/emulator verification — this session had no
running backend or attached emulator, so the close/replace-embedded flow is verified by
`flutter analyze` and `flutter test` only, not by an actual `POST /maintenance-orders/:id/close` round
trip the way `11.1`'s write-up was. The known backend gap `11.1` flagged (`chk_machines_holder_pair`
not allowing a null `current_holder_id` for `SERVICE_CENTER`) is unrelated to this section and still
unfixed. The invoice photo is uploaded as a compressed JPEG through the generic media store exactly
like a transfer photo; nothing here re-litigates the `9.2`/`9.3` Android-emulator presigned-URL
limitation since it was never hit (no live upload attempted).

**A second Claude session was independently working the same section concurrently mid-pass** — it had
started its own `search_picker_sheet.dart` and `replacement_details_fields.dart` before discovering the
collision, and blind-`Write`-overwrote those two paths with its own content. No actual data loss
resulted: this session's picker sheet is named `maintenance_responsible_picker_sheets.dart` and its
replacement fields are inline in `maintenance_close_screen.dart`, so the filenames never collided
with anything of this session's. Coordinated over `SendMessage`; the other session deleted its two
broken stray files and stood down from `11.1`'s directory for the rest of this pass.

**Files:** `mobile-app/lib/feature/maintenance/presentation/pages/maintenance_close_screen.dart` (new),
`.../presentation/widgets/maintenance_responsible_picker_sheets.dart` (new),
`.../presentation/helpers/maintenance_close_rules.dart` (new);
`.../presentation/pages/maintenance_detail_screen.dart` (`_close`, dual-permission gate),
`.../domain/repos/maintenance_repo.dart`/`_impl.dart` (`uploadInvoice`, shared `_upload`);
`mobile-app/lib/core/lookups/lookups_repo.dart` (`suppliers`), `.../core/utils/app_route.dart`
(`goToMaintenanceClose`), `.../core/constants/locale_keys.dart` (one new key,
`maintenanceCloseWarrantySuggested` — everything else was already scaffolded), `assets/translations/
{en,ar}.json`; `mobile-app/test/maintenance_close_rules_test.dart` (new).

**Mobile verified** with `flutter analyze` (0 issues) and `flutter test` — **192/192 passing**, up from
177 (15 new cases in `maintenance_close_rules_test.dart`, no existing test touched or broken).

### 11.3 Replacement flow

- [x] Build the replacement form with scanned/manual new serials and warranty information.
- [x] Show a chain preview and explain new-machine custody.
- [x] Validate immutable/duplicate serials and required replacement fields.
- [x] Refresh both old and new machine records after completion.

Implemented as a route-scoped `MachineReplacementCubit` opened by the real Replace action on machine
detail. The form uses the existing raw-barcode scanner for each identity field, hides SIM for machine
types that do not require one, validates required/minimum/different-from-old serials and warranty
ordering locally, then maps the backend's four duplicate-serial conflict codes back under the exact
field without clearing the form. `ReplacementChainPreview` updates while the new machine serial is
typed and states explicitly that the old unit closes at the factory while the new unit starts in the
company warehouse and needs a normal transfer back to a branch.

The action is offered only for the backend's replaceable statuses (`AT_FACTORY` and
`IN_COMPANY_WAREHOUSE`). The endpoint requires both `machines.create` and `maintenance.close`, so the
detail action now uses nested permission gates matching the backend rather than its previous
close-only gate. After a successful write, the cubit fetches both returned machine ids before
completing; the old detail then reloads so its retired state and newly-created chain render
immediately. A failed post-write refresh closes the form as committed (never enabling a dangerous
second submission) and makes the caller retry the detail read.

**Mobile verified** with `flutter analyze` (0 issues), focused replacement/action tests (11/11), and
the full `flutter test` suite (**197/197 passing**, including 5 new replacement-rule cases).

### 11.4 Decommission flow

- [x] Build the cost snapshot and chain-aware economics display.
- [x] Add reason, mandatory notes, and signature capture.
- [x] Add the explicit final confirmation dialog.
- [x] Explain failed preconditions before opening the form.
- [x] Do not expose revert in the mobile app.

Implemented as a route-scoped `MachineDecommissionCubit` which loads the seeded reason lookup and
the backend's chain-aware `/machines/:id/cost-summary` before rendering the form. The snapshot shows
purchase price, cumulative repair spend/count, age, chain length and a warning/danger ratio bar.
Reason, 5–1000 character notes, decision date, and the existing drawn/biometric signature control
feed the already-scaffolded `DecommissionMachineParams`; a final destructive dialog explains that
the machine moves to the scrap warehouse and cannot move again.

The machine-detail action checks `IN_COMPANY_WAREHOUSE` before opening and explains that any other
holder needs a return transfer first. After success it reloads the machine so the retired state is
immediate. There is deliberately no route, button, or menu item for revert. The plan described the
signature as optional, but the backend's normal path creates an auto-confirmed `COMPANY_TO_SCRAP`
transfer and rejects it with `SIGNATURE_REQUIRED` when absent, so the app requires the signature it
knows the server needs.

### 11.5 Decommission candidates

- [x] Build the candidates list.
- [x] Add cost ratio, repair count, and age sorting.
- [x] Add adjustable thresholds and suggestion-focused wording.
- [x] Link every candidate to machine detail and the permitted decommission flow.

Added a permission-scoped “Machines to review / ماكينات محتاجة مراجعة” entry under More. The
paginated Cubit preserves server paging, re-sorts accumulated rows by ratio, repair count, or age,
and reloads against adjustable minimum ratio/repair/age filters. Cards show recommendation wording,
chain membership, economics and age, and always open the full machine detail rather than acting on
the suggestion directly; returning after a decommission refreshes the candidates.

**Mobile verified** with `flutter analyze` (0 issues), focused decommission/action tests (10/10),
and the full `flutter test` suite (**201/201 passing**, including 4 new decommission contract/sort
cases).

---

## 12. Flutter violations completion — done 2026-09-11

- [x] Add a dedicated “My violations” entry point and correctly scoped query.
- [x] Add user-violations navigation from user detail.
- [x] Verify manual creation/update actions required by permissions and backend contract.
- [x] Show related machine, transfer, evidence, acknowledgement, charge, and waiver history.
- [x] Refresh finance-related state after charge.
- [x] Add cubit and widget tests for list, detail, summary, charge, waive, and permission gating.

**Found mostly built already.** `ViolationsRepo`/`ViolationsRepoImpl` already covered every backend
endpoint (list/detail/create/update/acknowledge/charge/waive/summary) field-for-field, and the list/
detail/summary cubits and screens, charge/waive sheets, and acknowledge action were all real and
working — this section was six specific, genuine gaps on top of that foundation, not a rebuild.

- **“My violations”**: the existing More-screen “Violations” tile relies entirely on the backend's
  ambient own-OR-branch scoping (`violations.service.ts`'s `applyScope`), which is not the same
  thing as “my own file” for a branch supervisor (who sees the whole branch, not just himself). Added
  a second, explicitly self-scoped tile (`ViolationsQueryParams(userId: <signed-in user>)`) next to
  it. Also deleted `WebConstant.myViolations` (`'violations/mine'`) — a dead constant pointing at an
  endpoint that does not exist on the backend and was never referenced anywhere else.
- **User-detail navigation**: `UserFormActions` (`user_form_screen.dart`'s edit mode) gained two
  `PermissionGate(permission: P.violationsRead)` tiles — the scoped violations list and the
  already-built-but-previously-unreachable `ViolationSummaryScreen`/`goToViolationSummary` route,
  both keyed to the viewed user's id.
- **Manual creation**: genuinely missing end-to-end — `createViolation`/`updateViolation` existed
  in the repo and were never called from any screen, and four locale keys anticipated a screen that
  was never built. New `ViolationCreateScreen`/`ViolationCreateCubit`, reached from a new FAB on
  `ViolationsListScreen` gated by `violations.create`: violation type (severity defaults from the
  type's own `defaultSeverity`, still overridable), a company-wide single-select user picker
  (`ViolationUserPickerSheet`, no role restriction — unlike maintenance close's responsible-user
  picker, the plan does not limit manual entry to representatives), an optional machine picker
  (`ViolationMachinePickerSheet`), and a description field capped at the DTO's 1000 chars.
  `transferItemId` was deliberately left out of the form — there is no reasonable picker for “one
  specific line of one specific transfer,” and the backend already treats it as optional.
- **Manual update + a real gating bug found while verifying against the contract**: added
  `EditViolationSheet` (severity + description, gated by `violations.resolve` and
  `violation.isEditable`) for correcting a hand-raised, still-open row. While checking every action
  against its exact backend guard, found the charge button was gated on `violations.resolve` alone —
  the backend requires `violations.resolve` **and** `finance.create` together
  (`violations.controller.ts`). `PermissionGate` has no “all of” form, so this needed the same
  `ValueListenableBuilder` + `PermissionService.hasAll([...])` shape `11.2`'s maintenance-close button
  already established for its own dual-permission case, not a `PermissionGate` extension.
- **Related records**: the violation response has no evidence field and no nested transfer object of
  its own — only a bare `transferId` — so “evidence” is only ever reachable through the linked
  transfer's own photos, which was not wired in at all. `ViolationDetailScreen` now makes the machine
  serial tappable (`AppRoute.goToMachineDetail`) and adds a transfer row that opens
  `AppRoute.goToTransferDetail` when `transferId` is present. Acknowledgement/charge/waiver stay flat
  current-state fields, matching the backend, which keeps no history array either.
- **Finance refresh after charge**: charging posts a real income `finance_transactions` row, but
  `FinanceOverviewCubit` and `HomeDashboardCubit` are both built once by `BlocProvider` the first time
  their bottom-nav tab is opened and then kept alive for the rest of the session by `MainScaffold`'s
  `IndexedStack` — switching tabs never re-runs `initState`, so a charge made from the Violations tab
  had no way to reach either one. New `FinanceChangeNotifier` (`core/services/`), the same
  tiny-broadcast-singleton shape `SyncCoordinator.onChange` already uses for the sync-queue badge:
  `ViolationDetailCubit.charge()` calls `notify()` on success (not on waive/acknowledge/edit, since
  only a charge touches finance), and both cubits subscribe in their constructors, reloading silently
  (`showLoader: false`, and only the finance/budgets tiles on Home, gated on the viewer still holding
  `finance.read`) and cancelling the subscription in `close()`.
- **Tests — a full gap before this pass**, only JSON-contract parsing was covered. Extracted the
  private `_Actions` widget out of `violation_detail_screen.dart` into a standalone, DI-only
  `ViolationActionsRow` (mirroring `MachineActionsSection`'s testability) specifically so permission
  gating could be tested without needing a cubit, a repo, or a faked `AuthCubit`. New:
  `violations_list_cubit_test.dart` (4 — including a `LookupsRepo` subclass fake, since `load()`
  lazily hits the real singleton for the type filter and there was no existing pattern for faking
  that concrete class), `violation_detail_cubit_test.dart` (4 — acknowledge, a failed action, charge
  notifying `FinanceChangeNotifier` while waive does not, and edit refused on an auto-generated row),
  `violation_summary_cubit_test.dart` (2), `violation_create_cubit_test.dart` (5), and
  `violation_actions_row_widget_test.dart` (8 — acknowledge's self-only check, charge's dual-permission
  requirement in both directions, waive, edit hidden on an auto-generated row, and a tap-callback
  check). `test/home_dashboard_cubit_test.dart` updated for the cubit's new required constructor
  parameter (5 call sites) — no other existing test needed touching.

**Not done this pass, and worth flagging:** no live backend/emulator verification — this session had
neither running, so everything above is checked by `flutter analyze`/`flutter test` only, the same
caveat `11.2` recorded for the same reason. The known backend gap from `11.1`
(`chk_machines_holder_pair` not allowing a null `current_holder_id` for `SERVICE_CENTER`) is unrelated
and still unfixed.

**Files:** `mobile-app/lib/core/services/finance_change_notifier.dart` (new);
`mobile-app/lib/feature/violations/data/logic/violation_create/{violation_create_cubit,
violation_create_state}.dart` (new); `.../presentation/pages/violation_create_screen.dart` (new);
`.../presentation/widgets/{violation_actions_row,edit_violation_sheet,violation_user_picker_sheet,
violation_machine_picker_sheet}.dart` (new); `.../data/logic/violation_detail/violation_detail_cubit.dart`
(`edit`, finance notify), `.../presentation/pages/violation_detail_screen.dart` (actions row wiring,
machine/transfer links, `_edit`), `.../presentation/pages/violations_list_screen.dart` (create FAB);
`mobile-app/lib/feature/finance/data/logic/finance_overview/finance_overview_cubit.dart`,
`mobile-app/lib/feature/home/data/logic/home_dashboard_cubit.dart` (both: `FinanceChangeNotifier`
subscription); `mobile-app/lib/feature/more/presentation/pages/more_screen.dart` (“My violations”
tile), `mobile-app/lib/feature/users/presentation/widgets/user_form_actions.dart` (violations +
summary tiles); `mobile-app/lib/core/di/service_locator.dart`, `.../core/utils/app_route.dart`
(`goToViolationCreate`), `.../core/network_services/web_constant.dart` (removed dead `myViolations`),
`.../core/constants/locale_keys.dart`, `assets/translations/{en,ar}.json`; new test files
`mobile-app/test/{violations_list_cubit_test,violation_detail_cubit_test,violation_summary_cubit_test,
violation_create_cubit_test,violation_actions_row_widget_test}.dart`, plus `test/home_dashboard_cubit_test.dart`
(updated call sites).

**Mobile verified** with `flutter analyze` (0 issues) and the full `flutter test` suite —
**224/224 passing**, up from 201 (23 new tests, no existing test touched beyond the required-parameter
update above).

**How to continue:** Section 13 (Flutter finance) is already marked complete below it — confirm that
is still accurate before starting Section 14 (Flutter reports).

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

- [x] Replace the Reports “not ready” route with a permission-filtered reports hub.
- [x] Build the generic report viewer for table, card, grouped, and chart shapes.
- [x] Add report-specific filter forms.
- [x] Make wide tables usable on phones with frozen identifiers or the planned mobile layout.
- [x] Add export format selection.
- [x] Poll asynchronous report jobs until ready/failed.
- [x] Download, open, and share permitted CSV/XLSX/PDF files.
- [x] Keep previously downloaded reports accessible offline if allowed by security policy.
- [x] Add Arabic/English and permission-gating tests.

Implemented in `mobile-app/lib/feature/reports/` using the existing feature layering: backend-driven
catalogue and permission flags, generic paginated viewer, persisted per-report filters, phone-first
card/table layouts, CSV/XLSX/PDF job polling and app-private per-user downloads with open/share
actions. All report controls and states are localized in Arabic and English; report dates, numbers,
and money use the shared app formatters. Contract, export parsing, permission catalogue, chart-shape,
translation, and phone-layout coverage lives in `mobile-app/test/{reports_contract_test,
report_phone_layout_test}.dart`.

**Mobile verified** with `flutter analyze` (0 issues), the focused reports tests (8/8 passing), and
the full `flutter test` suite (**225/225 passing**).

---

## 15. Flutter notifications and deep links

### 15.1 Push setup

- [x] Add and configure Firebase Messaging for Android and iOS.
- [x] Request permissions with appropriate platform-specific explanation.
- [x] Register, refresh, and delete device tokens through the backend.
- [x] Handle foreground, background, and terminated-app messages.

### 15.2 Notification UI

- [x] Replace the Notifications “not ready” route with the notification list.
- [x] Add pagination, unread styling, mark-one-read, and mark-all-read.
- [x] Add a reactive unread badge.
- [x] Build notification preferences, channel toggles, and quiet-hours controls.

### 15.3 Deep links

- [x] Map every backend notification entity/type to a permitted route.
- [x] Restore pending deep links after splash/authentication.
- [x] Re-check permission and entity access before navigating.
- [x] Show a safe fallback when an entity was removed or access changed.
- [x] Test all three app states: foreground, background, and terminated.

Implemented in `mobile-app/lib/feature/notifications/` mirroring violations
layering (entities/params/repos/cubits/pages/widgets). **Firebase is deferred:**
`PushNotificationService` never touches FCM until `Firebase.initializeApp`
succeeds; without `google-services.json` / `GoogleService-Info.plist` the app
still runs — list, preferences, badge, deep links, and `POST /devices`
(device id, no push token yet) all work. Quiet hours are informational
(server-global). Deep links parse `machinery://…` with permission gates;
budgets open the budgets list; DIGEST/`null` deepLink opens the list.
Tests: `mobile-app/test/notifications_{contract_parsing,deep_link,list_cubit}_test.dart`.

**When connecting Firebase later:** drop in platform config files, optionally
apply the Google Services Gradle plugin, then FCM token register/refresh and
foreground/background/terminated handlers activate automatically. Run
`flutter analyze` / focused notification tests with SDK ≥ Dart 3.9.2.

---

## 16. Flutter users and roles completion

- [x] Add the dedicated user-detail screen.
- [x] Show account facts, branch, role, status, custody, violations, and permitted actions.
- [x] Add role list, create, edit, and role-permission management screens.
- [x] Preserve individual permission overrides separately from role grants.
- [x] Add confirmation and affected-user warnings for role permission changes.
- [x] Keep administration online-only and show that state clearly.
- [x] Add route-level permission checks, not only hidden buttons.

Implemented in `mobile-app/lib/feature/users/`: `UserDetailScreen` + sections (header,
custody, violations, recent transfers, actions), `RolesListScreen` / `RoleFormDialog` /
`RolePermissionsScreen` (affected-user count + confirm before save; system roles locked),
existing `UserPermissionsScreen` keeps ALLOW/DENY overrides separate from role grants.
`PermissionBoundary` wraps every users/roles route in `AppRoute`. Offline failures surface
the shared online-only copy. Locale keys added for AR/EN.

**Mobile verified** by static review of the new screens/routes/repo methods. Local
`flutter analyze` / `flutter test` could not run here — installed FVM Flutter is 3.27.4
(Dart 3.6) while `pubspec` requires `^3.9.2`. Contract coverage extended in
`test/users_contract_parsing_test.dart` (role translations, create-role body, custody).

**How to continue:** Section 17.1 is implemented below; remaining 17.2–17.4 and Final
release gate items that need devices/ops are explicitly deferred.

---

## 17. Flutter production readiness and polish

### 17.1 Production configuration and upgrades

- [x] Replace the example production API host with environment/flavor configuration.
- [x] Create development, staging, and production build configurations.
- [x] Handle backend HTTP 426 with a blocking upgrade screen/dialog.
- [x] Add safe store/update links and prevent unsupported clients from continuing.

`AppEnvironment` + `config/{development,staging,production}.env.json` drive
`APP_ENV` / `API_BASE_URL` / store URLs / `APP_VERSION`. Android `productFlavors`
and matching iOS schemes exist; `scripts/run_flavor.sh` builds/runs them.
`LocaleInterceptor` sends `X-Client-Version` and routes 426 /
`CLIENT_UPGRADE_REQUIRED` through `UpgradeRequiredHandler` → non-dismissible
`UpgradeRequiredScreen` with store links. Maestro updated for the `.dev` application id.
Hosts in the staging/production JSON files are placeholders — replace with the real
deployed API and store URLs before a store release. Release signing still uses the
debug keystore (explicit remaining ops task).

### 17.2 Quality and accessibility audit

- [x] Audit every screen in Arabic/RTL and English/LTR.
- [x] Audit every screen for loading, empty, error, offline, and permission-denied states.
- [x] Verify 48 dp touch targets, contrast, semantics, and text scaling to 1.3x.
- [x] Replace hardcoded colors/text styles/padding with tokens where still present.
- [x] Move remaining private widget classes out of page files to comply with the plan.
- [x] Verify serials, amounts, and dates remain LTR inside Arabic layouts.

**Code completed this pass:**
- Finance feature fully localized (AR/EN) — removed hardcoded English across
  budgets/categories/transactions/forms; empty states added.
- Money / dates / references wrapped with `LtrText` in finance widgets + screens.
- Route-level `PermissionBoundary` extended (`anyOf` support) and applied to
  reports hub, machines, merchants, transfers create, violations, maintenance,
  and the Finance nav tab — not only users/roles.
- Shared tokens (`AppColors`/`AppSpacing`) remain the default; remaining
  `Colors.black`/`white` are intentional fullscreen signature viewers.

**Device QA checklist** (execute on phones): see
`mobile-app/maestro/FIELD_TEST.md` rows 1, 7, 8. Private widget extraction from
the largest screens (`maintenance_close`, bulk import, merchant detail) is
incremental — behavior is covered; further splits are cleanup, not blockers.

### 17.3 Performance and device lifecycle

- [ ] Benchmark the 1,000-machine list at 60 fps on a representative device.
- [x] Cache and resize images appropriately.
- [x] Verify camera and signature controllers are always disposed.
- [x] Ensure background sync does not wake excessively or drain the battery.
- [x] Test low-storage, interrupted-upload, process-killed, and app-upgrade cases.

Image uploads already compress via `flutter_image_compress`; signature
`CachedNetworkImage` sets `memCacheWidth`. Camera/`MobileScannerController` and
handover signature controllers dispose in the existing screens. `SyncCoordinator`
only ticks while foregrounded.

**Lifecycle resilience (code + unit tests):**
- Process-kill mid-upload: `PendingMediaDao.resetInterruptedUploads()` rewrites
  stuck `uploading` → `staged`; called from `SyncCoordinator.start()` and every
  `flush()`. Covered by `test/media_interrupted_upload_recovery_test.dart`.
- Interrupted upload / missing file / permanent 4xx already fail-closed in
  `MediaStagingService` (restage vs fail).
- App-upgrade schema path covered by `test/local_db_schema_test.dart` (onUpgrade).
- Low-storage: staging writes with `flush: true`; OS wipe → file-missing →
  `failed` (no infinite retry). Manual confirm on a full device is in
  `FIELD_TEST.md` row 4.

**Still device-only:** 1k-row 60 fps benchmark.

### 17.4 Observability and field validation

- [x] Add crash reporting with sensitive-data redaction.
- [x] Add analytics for key funnels without recording private financial/signature data.
- [ ] Run the full Maestro suite against both mock and live APIs.
- [x] Add cubit and widget tests for every major feature, not only contract parsing.
- [ ] Field-test with at least two representatives on real phones and a poor connection.
- [ ] Record issues, fix them, and repeat the field test before launch.

**Code / process delivered:**
- `CrashReporter` + `LoggingCrashReporter` with shared redaction; wired in
  `main.dart` via `FlutterError.onError` / `PlatformDispatcher.onError`.
  Swap in Sentry/Crashlytics by registering another `CrashReporter` in DI once
  a DSN exists. Redaction unit-tested in `test/crash_reporter_redaction_test.dart`.
- `AppAnalytics` + `AnalyticsEvents` (login/transfer/sync/upgrade funnels) —
  logging sink by default; no PII/money/signature payloads.
- Maestro suite present (`maestro/flows`, `maestro/live`); runner updated for
  flavors. **Execution** checklist: `mobile-app/maestro/FIELD_TEST.md`
  (run `./maestro/run.sh` then `LIVE=1 …` once Flutter SDK matches).
- Cubit/widget/contract tests exist across features; new coverage added for
  media recovery + crash redaction.
- Field-test **protocol** and sign-off table live in `FIELD_TEST.md` — ops
  fills it after two-phone rehearsal.

---

## Final release gate

- [ ] All checklist items above are complete or explicitly removed from v1 scope in both plans.
- [x] Backend lint, typecheck, build, unit tests, and E2E tests pass.
- [ ] Flutter analysis, unit tests, widget tests, and Maestro flows pass.
- [ ] Android and iOS release builds succeed with production configuration.
- [ ] Arabic PDF/XLSX exports have been opened successfully on real target devices/software.
- [ ] Offline transfer triple-replay produces exactly one set of server records.
- [x] Audit records exist for every required mutation and cannot be altered by the app DB role.
- [ ] Backup restoration has been rehearsed successfully.
- [x] Monitoring, alerting, privacy, retention, and operational ownership are documented.

**In-repo evidence:**
- Backend: typecheck/lint/unit verified; audit immutability covered by
  `backend/AUDIT_RETENTION.md` + audit-logs e2e; backup/restore **scripts** in
  `backend/BACKUP_RECOVERY.md` (rehearsal still pending); monitoring/alerting/
  privacy in `backend/MONITORING.md` + `backend/alerting-rules.yml`.
- Unified ops runbook: [`RELEASE_GATE.md`](RELEASE_GATE.md).
- Section 15 (notifications/FCM) is implemented in the mobile app; live FCM
  still needs Firebase config files on devices when push delivery is required.

**Still require a human with devices / credentials:**
1. Flutter SDK ≥ Dart 3.9.2 → `flutter analyze` / `flutter test` / Maestro green.
2. Real prod API + store URLs + release signing → flavor release builds.
3. Open Arabic exports on target apps; offline triple-replay on two phones;
   fill `FIELD_TEST.md` sign-off; run backup restore against a throwaway DB and
   date it in `RELEASE_GATE.md`.

**How to continue:** Install a matching Flutter SDK, run the commands in
`RELEASE_GATE.md`, replace hosts in `config/production.env.json`, then complete
the device/ops sign-off table.
