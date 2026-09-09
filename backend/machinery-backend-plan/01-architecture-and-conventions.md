# 01 — Architecture & Conventions

## Stack

| Concern | Choice |
|---|---|
| Framework | NestJS (latest LTS) |
| Language | TypeScript, `strict: true` |
| Database | PostgreSQL 15+ |
| ORM | TypeORM (DataMapper mode, migrations only — `synchronize: false` **always**) |
| Validation | `class-validator` + `class-transformer` via global `ValidationPipe` |
| Auth | JWT access + refresh, Passport strategies |
| Files | S3-compatible storage (MinIO for local dev) |
| Queue / jobs | BullMQ + Redis (notifications, report generation, budget checks) |
| Config | `@nestjs/config` with a validated schema — app must refuse to boot on a missing env var |
| Logging | `nestjs-pino` — structured JSON, one request-id per request |
| Docs | Swagger at `/api/docs`, generated from decorators |
| Tests | Jest — unit for services, e2e for each module's happy path + main failure path |

## Folder structure

```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── decorators/          # @CurrentUser, @Permissions, @Public, @IdempotencyKey
│   ├── guards/              # JwtAuthGuard, PermissionsGuard, BranchScopeGuard
│   ├── interceptors/        # ResponseInterceptor, AuditInterceptor, TimeoutInterceptor
│   ├── filters/             # AllExceptionsFilter -> unified error envelope
│   ├── pipes/
│   ├── dto/                 # PaginationDto, DateRangeDto, base response envelope
│   ├── enums/               # shared enums (MachineStatus, TransferType, ...)
│   ├── utils/
│   └── constants/
├── config/                  # database.config.ts, jwt.config.ts, storage.config.ts, ...
├── database/
│   ├── migrations/
│   ├── seeds/               # roles, permissions, system finance categories, lookup translations
│   └── data-source.ts
└── modules/
    ├── auth/
    ├── users/
    ├── roles/
    ├── branches/
    ├── machines/
    ├── batteries/
    ├── merchants/
    ├── transfers/           # the hand-off engine — the heart of the system
    ├── violations/
    ├── maintenance/
    ├── replacements/
    ├── decommission/
    ├── finance/
    │   ├── categories/
    │   ├── transactions/
    │   └── budgets/
    ├── reports/
    ├── notifications/
    ├── media/
    ├── sync/
    └── audit/
```

## Module internal layout (every module looks identical)

```
modules/machines/
├── machines.module.ts
├── machines.controller.ts        # HTTP only
├── machines.service.ts           # business logic
├── machines.repository.ts        # custom queries (optional — only if queries get complex)
├── dto/
│   ├── create-machine.dto.ts
│   ├── update-machine.dto.ts
│   ├── query-machines.dto.ts
│   └── responses/
│       ├── machine.response.ts
│       └── machine-detail.response.ts
├── entities/
│   ├── machine.entity.ts
│   └── machine-translation.entity.ts
├── mappers/
│   └── machine.mapper.ts
└── __tests__/
```

## Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Files | `kebab-case.<role>.ts` | `create-transfer.dto.ts` |
| Classes | `PascalCase` + role suffix | `TransfersService`, `CreateTransferDto` |
| DB tables | `snake_case`, plural | `transfer_items` |
| DB columns | `snake_case` | `confirmed_at` |
| Enums (TS) | `PascalCase` name, `SCREAMING_SNAKE` values | `MachineStatus.WITH_MERCHANT` |
| Enums (DB) | stored as `varchar` + a CHECK constraint, **not** native PG enums (easier to extend) |
| Endpoints | plural kebab nouns | `/api/v1/transfer-items` |
| Permissions | `resource.action` | `machines.create`, `finance.read` |

## Layering rules

- **Controller** → parses/validates input, calls one service method, returns a mapped DTO. Max ~10 lines per handler.
- **Service** → owns transactions, invariants, cross-module orchestration. Injects other services, never other controllers.
- **Repository / QueryBuilder** → data access only. No business rules.
- **Mapper** → entity → response DTO. Pure functions, no DB calls.

## Transactions

Any operation touching more than one table uses an explicit transaction:

```ts
await this.dataSource.transaction(async (manager) => { ... });
```

Mandatory for: creating a transfer, confirming a transfer, closing a maintenance order,
creating a replacement, decommissioning, and any finance auto-posting.

## Soft delete

Nothing operational is hard-deleted. Every main table carries `deleted_at TIMESTAMPTZ NULL`.
Finance transactions and transfers are **never** deleted — they are reversed/voided with a reason.

## Base columns on every table

```
id            UUID PK DEFAULT gen_random_uuid()
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
deleted_at    TIMESTAMPTZ NULL
created_by    UUID NULL REFERENCES users(id)
updated_by    UUID NULL REFERENCES users(id)
```

## Response envelope

Every successful response:

```json
{ "success": true, "data": { }, "meta": { "page": 1, "limit": 20, "total": 143 } }
```

`meta` present only on paginated endpoints. Error envelope is defined in `22-api-conventions-errors.md`.

## Versioning

URI versioning enabled: `app.enableVersioning({ type: VersioningType.URI })` → all routes under `/api/v1`.
