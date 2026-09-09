# Machine Lifecycle & Finance API

NestJS backend implementing the specification in [`../machinery-backend-plan`](../machinery-backend-plan).

## Prerequisites

- Node.js 20.11+ (22 recommended)
- PostgreSQL 15+
- Redis (optional locally, **required** in production)
- An S3-compatible store (MinIO locally) once the media module lands

## Getting started

```bash
cp .env.example .env      # then fill in DB credentials and generate JWT secrets
npm install
npm run migration:run
npm run start:dev
```

Generate the two JWT secrets with:

```bash
openssl rand -hex 32
```

With Docker available, `docker compose up -d` in `../` starts Postgres, Redis and MinIO
(including bucket creation).

Without Docker, point `DB_*` at a local PostgreSQL and leave `REDIS_HOST` empty — the cache
falls back to an in-process driver. `env.validation.ts` rejects that fallback in production.

## Verifying the install

| Check | Command / URL |
|---|---|
| Liveness | `curl localhost:3000/health` |
| Readiness (DB, cache, storage) | `curl localhost:3000/health/ready` |
| API docs | <http://localhost:3000/api/docs> |
| Committed OpenAPI spec | `openapi.json` (rewritten on every non-production boot) |

## Scripts

| Script | Purpose |
|---|---|
| `npm run start:dev` | Watch mode |
| `npm run lint` / `lint:fix` | ESLint (zero warnings is the standard) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` / `test:e2e` | Unit / end-to-end suites |
| `npm run migration:generate -- src/database/migrations/Name` | Diff entities into a migration |
| `npm run migration:run` / `migration:revert` / `migration:show` | Migration workflow |
| `npm run seed` | Seed roles, permissions, lookups and system finance categories |
| `npm run seed:dev` | The above plus two branches and one sign-in-ready account per role |
| `npm run db:setup:dev` | `migration:run` followed by `seed:dev` |
| `npm run e2e:db:reset` | Drop, recreate, migrate and seed the isolated `machinery_e2e` database |

## Running the API for the mobile app

The Flutter app talks to this API directly — there is no separate local database on the
device. Bring the backend up once and the app has everything it needs:

```bash
npm run db:setup:dev
npm run start:dev
```

`seed:dev` creates two branches and six accounts that share the password `Dev#12345`. Unlike
the bootstrap Director, they have `must_change_password = false`, so the app lands on a real
screen instead of the change-password wall:

| Phone | Role | Scope |
|---|---|---|
| `01000000000` | Director | company — **seed password, forces a change on first login** |
| `01000000001` | Director | company |
| `01000000002` | Branch supervisor | فرع القاهرة |
| `01000000003` | Representative | فرع القاهرة |
| `01000000004` | Branch supervisor | فرع الإسكندرية |
| `01000000005` | Accountant | company |
| `01000000006` | Viewer | company |

The seed refuses to run with `NODE_ENV=production`, which is what keeps a known password out
of a real deployment.

The app resolves its base URL without any configuration: the iOS simulator uses
`http://localhost:3000`, the Android emulator uses `http://10.0.2.2:3000` (its alias for the
host machine). A physical device needs this machine's LAN address instead:

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:3000/api/v1/
```

Cleartext HTTP is allowed only in debug builds — Android via the debug manifest, iOS via
`NSAllowsLocalNetworking`, which is scoped to local addresses.

## Conventions worth knowing before writing code

Read `../machinery-backend-plan/01-architecture-and-conventions.md` first. The rules that
bite hardest if ignored:

1. **`synchronize` is permanently `false`.** Schema changes ship as migrations, and the
   indexes go in the same migration as the columns they serve.
2. **Controllers hold no business logic.** They validate, call one service method, and
   return a mapped DTO.
3. **Nothing mutates `machine.current_holder` directly** — every custody change goes
   through the transfer engine.
4. **Throw `AppException`, never `HttpException`.** It carries a stable error code that the
   Flutter app switches on, and `AllExceptionsFilter` localizes the message.
5. **Every user-visible name is localized** via a sibling `*_translations` table.
6. **Every write endpoint accepts `Idempotency-Key`**, because clients are offline-first.

## Layout

```
src/
├── main.ts                 # bootstrap: pipes, filters, interceptors, Swagger
├── app.module.ts
├── bootstrap/              # Swagger setup
├── common/
│   ├── cache/              # Redis driver + in-process fallback
│   ├── constants/          # locales, error codes
│   ├── decorators/         # @Public, @Permissions, @CurrentUser, @ReqLocale, @Idempotent
│   ├── dto/                # pagination, date range, translations, paginated result
│   ├── entities/           # BaseEntity, TranslationEntity
│   ├── enums/              # MachineStatus, TransferType, FinanceKind, ...
│   ├── errors/             # AppException + localized message catalogue
│   ├── filters/            # AllExceptionsFilter -> unified error envelope
│   ├── interceptors/       # ResponseInterceptor, TimeoutInterceptor
│   ├── middleware/         # request id / device headers, locale resolution
│   ├── types/              # AuthUser, BranchScope, RequestContext
│   └── utils/              # translation joins, reference numbers, stable hashing
├── config/                 # namespaced config + boot-time env validation
├── database/
│   ├── data-source.ts      # shared by the runtime and the TypeORM CLI
│   ├── migrations/
│   └── seeds/
└── modules/
    └── health/
```

## Response shapes

Success:

```json
{ "success": true, "data": {}, "meta": { "page": 1, "limit": 20, "total": 143 } }
```

Error — `code` is stable and machine-readable, `message` is localized to the request locale:

```json
{
  "success": false,
  "error": {
    "code": "MACHINE_ALREADY_IN_TRANSIT",
    "message": "الماكينة SN-00341 مرتبطة بعملية تسليم قيد الانتظار",
    "requestId": "01J...",
    "timestamp": "2026-09-07T12:00:00Z"
  }
}
```

`409` means "this collides with something that exists"; `422` means "this operation is not
legal right now". The mobile app treats them differently, so pick deliberately.

## Implementation progress

Phases follow `../machinery-backend-plan/23-implementation-roadmap.md`.

- [x] **Phase 0 — Foundation.** Config validation, TypeORM + migrations, response envelope,
      error filter, locale resolution, cache abstraction, pino, Swagger, health checks, CI.
- [x] **Phase 1 — Identity.** Users, roles, permissions, JWT with refresh rotation, guards,
      per-user overrides, seeds.
- [x] **Phase 2 — Organization & localization.** Branches, warehouses with their cardinality
      rules, the localized lookup catalogue.
- [ ] Phase 3 — Machines & batteries
- [ ] Phase 4 — Transfer engine + media
- [ ] Phase 5 — Merchants & violations
- [ ] Phase 6 — Maintenance, replacement, decommission
- [ ] Phase 7 — Finance
- [ ] Phase 8 — Offline & sync
- [ ] Phase 9 — Reports & notifications
- [ ] Phase 10 — Audit & hardening
