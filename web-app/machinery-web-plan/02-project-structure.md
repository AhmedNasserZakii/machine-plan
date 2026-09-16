# 02 — Project Structure

## Where it lives

```
mahmoud topay/
├── backend/api/                 ← unchanged
├── mobile-app/                  ← unchanged
└── web-app/
    ├── machinery-web-plan/      ← this folder
    └── (the Next.js app, created at the start of Sprint 0)
```

The app is a **sibling** of `mobile-app`, not a workspace member of it. No monorepo tooling, no
shared `node_modules`. The one artifact crossing the boundary is `backend/api/openapi.json`, read
at codegen time.

## Bootstrap

```bash
cd web-app
npx create-next-app@latest . --ts --tailwind --app --src-dir --import-alias "@/*" --eslint
npx shadcn@latest init
```

Then add exactly: `@tanstack/react-query @tanstack/react-query-devtools @tanstack/react-table
react-hook-form @hookform/resolvers zod next-intl date-fns recharts lucide-react`
and dev: `openapi-typescript vitest @testing-library/react @testing-library/user-event
@playwright/test msw eslint-plugin-tailwindcss`.

## Tree

```
web-app/
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx                 # html lang/dir, fonts, providers
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── change-password/page.tsx
│   │   │   └── (app)/
│   │   │       ├── layout.tsx             # shell: sidebar + topbar + auth gate
│   │   │       ├── page.tsx               # dashboard
│   │   │       ├── machines/
│   │   │       │   ├── page.tsx           # list
│   │   │       │   ├── new/page.tsx
│   │   │       │   ├── import/page.tsx
│   │   │       │   └── [id]/
│   │   │       │       ├── page.tsx       # detail (tabbed)
│   │   │       │       ├── edit/page.tsx
│   │   │       │       ├── timeline/page.tsx
│   │   │       │       └── maintenance/page.tsx
│   │   │       ├── transfers/
│   │   │       ├── merchants/
│   │   │       ├── maintenance/
│   │   │       ├── violations/
│   │   │       ├── finance/
│   │   │       ├── reports/
│   │   │       ├── users/
│   │   │       ├── roles/
│   │   │       ├── organization/
│   │   │       ├── notifications/
│   │   │       └── settings/
│   │   └── api/
│   │       └── bff/
│   │           ├── login/route.ts         # sets httpOnly cookies
│   │           ├── logout/route.ts
│   │           ├── refresh/route.ts
│   │           └── [...path]/route.ts     # authenticated proxy to NestJS
│   │
│   ├── features/                          # one folder per domain, mirrors Flutter
│   │   └── <feature>/
│   │       ├── api/                       # fetchers, one per endpoint group
│   │       ├── model/                     # types, enums, label maps, zod schemas
│   │       ├── hooks/                     # useXQuery / useXMutation + queryKeys
│   │       └── components/                # feature-owned UI
│   │
│   ├── components/
│   │   ├── ui/                            # shadcn primitives (owned, token-styled)
│   │   ├── data-table/                    # the DataTable system (08)
│   │   ├── form/                          # Field kit (08)
│   │   ├── feedback/                      # EmptyState, ErrorState, Skeletons, Toast
│   │   ├── layout/                        # Sidebar, Topbar, PageHeader, Breadcrumbs
│   │   └── common/                        # StatusChip, Money, SerialText, DateText, Can
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts                  # fetch wrapper, envelope, errors
│   │   │   ├── endpoints.ts               # every path string (mirrors WebConstant)
│   │   │   ├── error-codes.ts             # the canonical SCREAMING_SNAKE catalogue
│   │   │   ├── idempotency.ts
│   │   │   ├── pagination.ts              # PageMeta / CursorMeta helpers
│   │   │   └── generated/schema.d.ts      # openapi-typescript output — never edited
│   │   ├── auth/
│   │   │   ├── permissions.ts             # `P` — mirrors permission_keys.dart
│   │   │   ├── session.ts                 # cookie read/write, server side
│   │   │   ├── use-session.ts             # client hook over /auth/me
│   │   │   └── can.ts                     # hasPermission / hasAny / hasAll
│   │   ├── nav/
│   │   │   ├── nav-items.ts               # mirrors NavTabsBuilder, permission-gated
│   │   │   └── route-permissions.ts       # route pattern → required permission(s)
│   │   ├── query/
│   │   │   ├── query-client.ts
│   │   │   └── url-state.ts               # useUrlFilters: query string ↔ params
│   │   ├── format/                        # money, date, number, phone, duration
│   │   └── utils/
│   │
│   ├── i18n/
│   │   ├── routing.ts
│   │   ├── request.ts
│   │   └── messages/{ar,en}.json          # imported/synced from mobile translations
│   │
│   ├── styles/
│   │   ├── tokens.css                     # the ONLY place a colour is defined
│   │   ├── globals.css
│   │   └── print.css
│   │
│   └── middleware.ts                      # locale + session redirect
│
├── scripts/
│   ├── generate-api-types.sh              # openapi.json → generated/schema.d.ts
│   ├── sync-translations.ts               # mobile ar.json/en.json → i18n/messages
│   └── check-token-usage.ts               # fails on raw hex / physical direction
├── e2e/                                   # Playwright
├── .env.example
└── README.md
```

## Feature folder template

Every feature looks the same. `machines` in full:

```
features/machines/
├── api/
│   ├── machines.api.ts          # list, byId, bySerial, create, update, bulk, lookup
│   ├── machine-catalogue.api.ts # machine-types, machine-models, suppliers
│   └── machine-lifecycle.api.ts # timeline, cost-summary, maintenance-history,
│                                # replacement-chain, replace, decommission
├── model/
│   ├── machine.types.ts         # re-exports from generated/schema.d.ts, never redefines
│   ├── machine-status.ts        # MACHINE_STATUSES + labelKey + tone
│   └── machine-form.schema.ts   # zod, incl. the requiresSim conditional rule
├── hooks/
│   ├── query-keys.ts
│   ├── use-machines-query.ts
│   ├── use-machine-query.ts
│   ├── use-machine-form-mutation.ts
│   └── use-machine-bulk-import.ts
└── components/
    ├── machines-table.tsx
    ├── machines-filter-bar.tsx
    ├── machine-status-chip.tsx
    ├── machine-identity-card.tsx
    ├── machine-warranty-card.tsx
    ├── machine-cost-card.tsx
    ├── machine-timeline.tsx
    ├── machine-form.tsx
    └── machine-qr-dialog.tsx
```

Compare with `mobile-app/lib/feature/machines/` — same nouns, same split. That is deliberate.

## The features list

Sixteen, matching the mobile app one-for-one plus two web-only admin surfaces:

`auth`, `dashboard`, `machines`, `transfers`, `merchants`, `maintenance`, `violations`,
`finance`, `reports`, `users`, `roles`, `notifications`, `scanning`, `audit`*, `organization`*,
`settings`.

\* web-only: `audit` (`/audit-logs`, no mobile screen) and `organization`
(branches / warehouses / lookups, which mobile only consumes read-only).

## Environment

```bash
# .env.example
API_BASE_URL=http://localhost:3000/api/v1     # server-side only; never NEXT_PUBLIC_
NEXT_PUBLIC_APP_NAME=Machinery
NEXT_PUBLIC_CLIENT_VERSION=1.0.0              # sent as X-Client-Version
SESSION_COOKIE_NAME=mch_session
SESSION_COOKIE_SECURE=false                   # true everywhere but local http
```

`API_BASE_URL` is **not** public. The browser talks to `/api/bff/*` on its own origin; only the
Next.js server knows the NestJS host. That removes CORS entirely and keeps the refresh token out
of JavaScript's reach. See `06`.

## Scripts

```jsonc
{
  "dev": "next dev",
  "build": "next build",
  "lint": "next lint --max-warnings=0",
  "typecheck": "tsc --noEmit",
  "api:types": "bash scripts/generate-api-types.sh",
  "i18n:sync": "tsx scripts/sync-translations.ts",
  "i18n:check": "tsx scripts/sync-translations.ts --check",   // fails on a missing ar or en key
  "tokens:check": "tsx scripts/check-token-usage.ts",
  "test": "vitest run",
  "test:e2e": "playwright test"
}
```

`api:types` must be re-run after every backend change, and `openapi.json` drifting is already
caught on the backend by `npm run check:openapi`.
