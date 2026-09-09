# 23 — Implementation Roadmap

Build order matters. Each phase leaves the system in a demoable, testable state.

## Phase 0 — Foundation (week 1)

- NestJS project, strict TS, ESLint + Prettier, husky pre-commit
- Config module with schema validation; `.env.example` committed
- TypeORM + PostgreSQL, `synchronize: false`, migration workflow scripted
- Docker Compose: postgres, redis, minio
- Global pieces from `01`: response interceptor, exception filter, validation pipe, pino logger
- Swagger at `/api/docs`
- CI: lint + typecheck + test on every push

**Done when:** `docker compose up` gives a running API with `/health` green and one migration applied.

## Phase 1 — Identity (week 2)

Files `04`, `05`.

- users, roles, permissions, role_permissions, user_permission_overrides, refresh_tokens
- JWT auth, refresh rotation, argon2, lockout
- `PermissionsGuard`, `BranchScopeGuard`, `@CurrentUser`
- seeds: permission catalogue, 5 roles, one Director account
- `GET /auth/me` returning effective permissions

**Done when:** you can log in as each seeded role and see different permission sets.

## Phase 2 — Organization & localization (week 2–3)

Files `02`, `06`.

- branches, warehouses with the partial unique indexes
- the whole translation-table pattern + `joinTranslation` helper + locale middleware
- lookup tables and their translations: machine types, models, payment methods, violation types,
  maintenance locations, decommission reasons
- seeds in both `ar` and `en`

**Done when:** the same endpoint returns Arabic or English names based on `Accept-Language`.

## Phase 3 — Machines (week 3–4)

File `07`.

- machines, batteries, all indexes
- CRUD, bulk factory intake, QR lookup by machine or battery serial
- machine detail response with warranty computation
- **not yet:** timeline, cost summary (they need transfers and maintenance)

**Done when:** 1,000 seeded machines are searchable by serial in under 100 ms.

## Phase 4 — The transfer engine (week 4–6) ← the hard part

File `09`.

- transfers, transfer_items, transfer_signatures, transfer_item_photos
- `TRANSFER_RULES` map, create / confirm / reject / cancel
- row locking, the pending-transfer unique guard, `previous_status` rollback
- payload hashing for signatures
- media module (`19`) delivered alongside, because signatures need it

**Do not move on until the concurrency tests pass.** Everything downstream assumes custody is
correct.

**Done when:** a machine can travel company → branch → rep → merchant → rep → branch → company with
signatures at every step, and every illegal move is rejected.

## Phase 5 — Merchants & violations (week 6–7)

Files `08`, `10`.

- merchants, subscriptions
- violation types, auto-detection on confirm, the violation lifecycle
- `GET /users/:id/violations/summary`

**Done when:** returning a machine with a mismatched battery accepts the hand-off and files a
violation automatically.

## Phase 6 — Maintenance, replacement, decommission (week 7–9)

Files `11`, `12`, `13`.

- maintenance orders with the open-order unique index
- warranty suggestion, close flow, `total_repair_cost` accumulation
- replacement chain with the recursive CTE
- decommission with the frozen cost snapshot
- machine timeline (`07`) can now be built — all its sources exist
- machine cost summary, chain-aware

**Done when:** a machine's full life story renders from a single endpoint.

## Phase 7 — Finance (week 9–11)

Files `14`, `15`, `16`.

- finance categories with LTREE, move, cycle prevention, system category seeds
- transactions with all indexes, void, the auto-source unique guard
- **wire the auto-postings**: maintenance close → expense; violation charge → income;
  subscription collect → income
- budgets, status computation, escalation-only alerting
- summary and by-category endpoints

**Done when:** closing a maintenance order with `responsibleParty = COMPANY` puts an expense under
`صيانة` without anyone typing it.

## Phase 8 — Offline & sync (week 11–12)

File `20`.

- `client_uuid` columns and dedupe on every client-created entity
- idempotency interceptor + table
- `/sync/bootstrap`, `/sync/delta`, `/sync/batch` with per-operation results
- `occurredAt` handling and clock-skew guards

**Done when:** the same batch pushed three times produces exactly one set of records.

## Phase 9 — Reports & notifications (week 12–14)

Files `17`, `18`.

- report catalogue, shared contract, Redis caching
- xlsx/csv/pdf export jobs with an embedded Arabic font
- FCM integration, templates, preferences, quiet hours, dedupe keys
- all scheduled jobs

**Done when:** a supervisor gets a push the moment a delivery needs his signature, and an xlsx
export of expenses by category opens correctly in Excel with Arabic intact.

## Phase 10 — Audit, hardening, launch (week 14–16)

File `21`.

- audit interceptor + queue, partitioned table, revoked UPDATE/DELETE
- rate limiting, Helmet, CORS allowlist
- load test: 40 concurrent reps syncing 20-machine batches
- backup strategy: nightly `pg_dump` + PITR, **restore rehearsal actually performed**
- Sentry, uptime monitoring, log retention

## Cross-cutting definition of done (every phase)

- [ ] migrations written and reversible
- [ ] unit tests on services, e2e on the module's happy path + main failure path
- [ ] Swagger complete with error codes
- [ ] seeds updated for both locales
- [ ] no `any`, no `// TODO`, zero lint warnings
- [ ] audit entries written for every mutation
- [ ] indexes created in the same migration as the columns they serve

## Risk register

| Risk | Mitigation |
|---|---|
| Custody race conditions | row locks + unique partial index + dedicated concurrency tests in Phase 4 |
| Offline duplicate submissions | `client_uuid` + idempotency keys, tested with triple replay |
| Duplicate finance postings | unique index on `(source_ref_type, source_ref_id)` |
| Arabic in PDF/Excel exports | embed fonts, UTF-8 BOM, test on a real Windows Excel early |
| Category tree corruption after a move | wrap in a transaction, cycle check, subtree path rewrite test |
| Losing signature evidence | media never auto-deleted, `payload_hash` stored, audit insert-only |
