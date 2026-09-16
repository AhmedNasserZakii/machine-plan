# 06 — Auth, Session & Routing

## The decision: a thin BFF

The backend issues a 30-minute access token and a rotating 30-day refresh token. Putting the
refresh token in `localStorage` hands a 30-day account takeover to any XSS. So:

```
browser ──/api/bff/*──► Next.js route handler ──Bearer──► NestJS /api/v1/*
   │                          │
   └── httpOnly cookies ◄─────┘
```

- `mch_at` — access token, `httpOnly`, `secure`, `sameSite=lax`, expiry = token expiry.
- `mch_rt` — refresh token, `httpOnly`, `secure`, `sameSite=strict`, `path=/api/bff`, 30 days.
- `mch_session` — **not** a token. A non-sensitive readable flag (`1`) so middleware can redirect
  without decoding anything.

JavaScript never reads a token. The refresh token is scoped to the BFF path, so it is not even
sent on ordinary page navigations.

CSRF: cookies are `sameSite`, and the BFF additionally rejects any non-`GET` whose `Origin` header
does not match the app origin. That is sufficient here; a token-based CSRF scheme would add a
moving part without adding protection.

## The four BFF routes

| Route | Does |
|---|---|
| `POST /api/bff/login` | forwards `{phone, password}` to `auth/login`, sets the three cookies, returns the `/auth/me`-shaped profile. Tokens never enter the response body. |
| `POST /api/bff/logout` | calls `auth/logout`, clears cookies, returns 204. Clears cookies **even if** the upstream call fails — a user clicking logout must end up logged out. |
| `POST /api/bff/refresh` | calls `auth/refresh` with `mch_rt`, writes the rotated pair. Single-flight: concurrent calls share one upstream request. |
| `ALL /api/bff/[...path]` | the proxy. Attaches headers (`05`), streams the body, and on a `401` refreshes **once** and replays the original request **once**. |

The replay must preserve the original `Idempotency-Key`, or a mutation that 401s mid-flight
becomes a double-write. This is the single most important line in the proxy.

Refresh rotation means a reused refresh token revokes the whole device chain server-side, so the
proxy must never issue two concurrent refreshes. Guard it with a module-level in-flight promise
keyed by the refresh token value.

## Login flow

```
/ar/login
  → POST /api/bff/login
  → 200: cookies set
      → GET auth/me
          → mustChangePassword === true  → /ar/change-password  (hard gate, no skip)
          → otherwise                    → the `next` param, or /ar
  → 401 INVALID_CREDENTIALS  → inline field error, never a toast
  → 403 ACCOUNT_INACTIVE     → full-page explanation, "contact your director"
  → 423 ACCOUNT_LOCKED       → explanation + how long
  → 429                      → countdown; login is rate-limited to 10 / 15 min per phone+IP
```

The identifier is a **phone number**, not an email — field staff do not reliably have email.
Validate the Egyptian mobile format client-side (`^01[0125][0-9]{8}$`), `dir="ltr"` on the input,
`inputMode="tel"`, `autoComplete="username"`.

There is **no public sign-up and no self-service password reset.** Accounts are created by the
Director, and a forgotten password is reset by someone holding `users.update` via
`POST /users/:id/reset-password`. The login page says so rather than showing a dead "forgot
password" link.

"Remember this device" is not offered. The refresh cookie already lasts 30 days.

## Change password

Reached in two ways, and they behave differently:

1. **Forced** (`mustChangePassword`) — a route the user cannot leave. No sidebar, no nav, no
   dismiss. Every other `(app)` route redirects back here until it is done.
2. **Voluntary** from `/settings/security` — normal page, cancellable.

Both `POST auth/change-password` with `{currentPassword, newPassword}`. Password rules mirror the
mobile app's validators (minimum 8 characters; reuse the `shared.password_min_eight` key). On
success the server rotates tokens; the BFF writes the new pair before returning.

## Session in the client

```ts
// src/lib/auth/use-session.ts
export function useSession() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['session'],
    queryFn: () => api.get(endpoints.auth.me),
    staleTime: 5 * 60_000,
    retry: false,
  });
  return { user: data, permissions: data?.permissions ?? [], isLoading, error };
}
```

`/auth/me` is fetched **once** in the `(app)` layout and shared through the query cache. It is
the single source of truth for identity, branch and permissions — the same contract the mobile
app relies on.

Invalidate `['session']` after: change-password, and any mutation that could alter the caller's
own permissions. The backend caches effective permissions in Redis for 15 minutes, so a Director
editing their own overrides will not see an instant change; say so in the UI rather than
pretending otherwise.

## Permissions in the client

`src/lib/auth/permissions.ts` is a transliteration of
`mobile-app/lib/core/permissions/permission_keys.dart` — same constant names, same values:

```ts
export const P = {
  machinesRead: 'machines.read', machinesReadAll: 'machines.read.all',
  machinesCreate: 'machines.create', machinesImport: 'machines.import',
  machinesUpdate: 'machines.update', machinesDelete: 'machines.delete',
  machinesDecommission: 'machines.decommission',

  transfersRead: 'transfers.read', transfersReadAll: 'transfers.read.all',
  transfersCreate: 'transfers.create', transfersConfirm: 'transfers.confirm',
  transfersReject: 'transfers.reject', transfersCancel: 'transfers.cancel',

  merchantsRead: 'merchants.read', merchantsReadAll: 'merchants.read.all',
  merchantsCreate: 'merchants.create', merchantsUpdate: 'merchants.update',
  merchantsDelete: 'merchants.delete',

  maintenanceRead: 'maintenance.read', maintenanceCreate: 'maintenance.create',
  maintenanceUpdate: 'maintenance.update', maintenanceClose: 'maintenance.close',
  maintenanceSetCost: 'maintenance.set_cost',

  violationsRead: 'violations.read', violationsReadAll: 'violations.read.all',
  violationsCreate: 'violations.create', violationsResolve: 'violations.resolve',
  violationsWaive: 'violations.waive',

  financeRead: 'finance.read', financeReadAll: 'finance.read.all',
  financeCreate: 'finance.create', financeUpdate: 'finance.update',
  financeVoid: 'finance.void', financeCategoriesManage: 'finance.categories.manage',
  financeBudgetsManage: 'finance.budgets.manage',

  reportsMachines: 'reports.machines', reportsTransfers: 'reports.transfers',
  reportsViolations: 'reports.violations', reportsFinance: 'reports.finance',
  reportsExport: 'reports.export',

  usersRead: 'users.read', usersCreate: 'users.create', usersUpdate: 'users.update',
  usersDeactivate: 'users.deactivate', rolesManage: 'roles.manage',
  branchesManage: 'branches.manage', settingsManage: 'settings.manage',
  auditRead: 'audit.read',
} as const;

/** There is no blanket `reports.read`; "may they open Reports at all?" asks this. */
export const ANY_REPORT = [
  P.reportsMachines, P.reportsTransfers, P.reportsViolations, P.reportsFinance,
  P.merchantsRead, P.maintenanceRead,
] as const;
```

Helpers and the gate component:

```ts
export const can    = (perms: string[], p: string)    => perms.includes(p);
export const canAny = (perms: string[], ps: string[]) => ps.some(p => perms.includes(p));
export const canAll = (perms: string[], ps: string[]) => ps.every(p => perms.includes(p));
```

```tsx
// components/common/can.tsx — the counterpart of PermissionBoundary
<Can perm={P.machinesCreate}>            <AddMachineButton /></Can>
<Can anyOf={ANY_REPORT}>                 <ReportsNav /></Can>
<Can perm={P.financeVoid} fallback={null}><VoidButton /></Can>
```

`<Can>` renders `null` by default. It never renders a disabled control — a control the user can
see but never use is worse than an absent one. The exception is an action disabled for a *state*
reason ("already confirmed"), which stays visible with a tooltip explaining why.

## Three levels of gating — all of them, every time

1. **Middleware** (`src/middleware.ts`) — cheap and coarse. Checks the `mch_session` cookie and
   the locale segment; redirects an anonymous user to `/{locale}/login?next=<path>`. It does
   **not** check permissions: it cannot, without decoding a token it is not allowed to read.
2. **Route guard** (`(app)/layout.tsx` + `RoutePermissionGate`) — reads `/auth/me` and compares
   against `route-permissions.ts`. Renders `NoAccess` for a permitted-to-log-in-but-not-here user.
3. **Control gate** — `<Can>` around every button, menu item, table row action and form field.

```ts
// src/lib/nav/route-permissions.ts
export const routePermissions: Array<{ pattern: RegExp; anyOf: string[] }> = [
  { pattern: /^\/machines(\/|$)/,     anyOf: [P.machinesRead] },
  { pattern: /^\/machines\/new$/,     anyOf: [P.machinesCreate] },
  { pattern: /^\/machines\/import$/,  anyOf: [P.machinesImport] },
  { pattern: /^\/transfers(\/|$)/,    anyOf: [P.transfersRead] },
  { pattern: /^\/merchants(\/|$)/,    anyOf: [P.merchantsRead] },
  { pattern: /^\/maintenance(\/|$)/,  anyOf: [P.maintenanceRead] },
  { pattern: /^\/violations(\/|$)/,   anyOf: [P.violationsRead] },
  { pattern: /^\/finance(\/|$)/,      anyOf: [P.financeRead] },
  { pattern: /^\/reports(\/|$)/,      anyOf: [...ANY_REPORT] },
  { pattern: /^\/users(\/|$)/,        anyOf: [P.usersRead] },
  { pattern: /^\/roles(\/|$)/,        anyOf: [P.rolesManage] },
  { pattern: /^\/organization(\/|$)/, anyOf: [P.branchesManage] },
  { pattern: /^\/audit(\/|$)/,        anyOf: [P.auditRead] },
  { pattern: /^\/settings\/system/,   anyOf: [P.settingsManage] },
];
```

More specific patterns are declared **after** general ones and win; the matcher takes the last
match. Any `(app)` route absent from this table is available to every authenticated user
(dashboard, notifications, own profile).

The client gate is UX, not security. The API enforces the same rules and is the actual boundary.
That is why an unexpected 403 is still handled properly (`05`) rather than treated as impossible.

## Navigation

`src/lib/nav/nav-items.ts` mirrors `NavTabsBuilder` — the sidebar is built from permissions, never
from a role name, so a representative and a director get different sidebars from one code path.

```ts
export const navGroups: NavGroup[] = [
  { labelKey: 'web.nav.operations', items: [
    { href: '/',            labelKey: 'shared.nav_home',        icon: Home },
    { href: '/machines',    labelKey: 'shared.nav_machines',    icon: Factory,    perm: P.machinesRead },
    { href: '/transfers',   labelKey: 'shared.nav_transfers',   icon: ArrowLeftRight, perm: P.transfersRead,
      badge: 'pendingIncoming' },
    { href: '/merchants',   labelKey: 'shared.nav_merchants',   icon: Store,      perm: P.merchantsRead },
    { href: '/maintenance', labelKey: 'shared.nav_maintenance', icon: Wrench,     perm: P.maintenanceRead },
    { href: '/violations',  labelKey: 'shared.nav_violations',  icon: ShieldAlert,perm: P.violationsRead },
  ]},
  { labelKey: 'web.nav.finance', items: [
    { href: '/finance',            labelKey: 'shared.nav_finance', icon: Wallet, perm: P.financeRead },
    { href: '/finance/categories', labelKey: 'shared.finance_categories', perm: P.financeCategoriesManage },
    { href: '/finance/budgets',    labelKey: 'shared.finance_budgets',    perm: P.financeBudgetsManage },
  ]},
  { labelKey: 'web.nav.insights', items: [
    { href: '/reports', labelKey: 'shared.nav_reports', icon: BarChart3, anyOf: [...ANY_REPORT] },
  ]},
  { labelKey: 'web.nav.administration', items: [
    { href: '/users',        labelKey: 'shared.nav_users',   icon: Users,    perm: P.usersRead },
    { href: '/roles',        labelKey: 'shared.nav_roles',   icon: KeyRound, perm: P.rolesManage },
    { href: '/organization', labelKey: 'web.nav.organization', icon: Building2, perm: P.branchesManage },
    { href: '/audit',        labelKey: 'web.nav.audit',      icon: ScrollText, perm: P.auditRead },
    { href: '/settings',     labelKey: 'shared.nav_settings',icon: Settings },
  ]},
];
```

A group whose every item is filtered out renders nothing — no empty headers.

Unlike mobile, there is **no five-item cap and no "More" overflow**; a sidebar holds them all.
That is the point of the form factor.

## Route inventory

```
/{locale}/login
/{locale}/change-password
/{locale}/                              dashboard
/{locale}/machines                      list  ?status&branchId&modelId&holderType&search&page&sort
/{locale}/machines/new
/{locale}/machines/import
/{locale}/machines/[id]                 detail: overview | timeline | maintenance | costs | chain
/{locale}/machines/[id]/edit
/{locale}/transfers                     ?direction&status&type&dateFrom&dateTo
/{locale}/transfers/new
/{locale}/transfers/[id]
/{locale}/merchants                     ?branchId&isActive&search
/{locale}/merchants/new
/{locale}/merchants/[id]                detail: profile | machines | subscriptions | timeline
/{locale}/merchants/[id]/edit
/{locale}/maintenance                   ?status&locationId&dateFrom&dateTo
/{locale}/maintenance/new
/{locale}/maintenance/[id]
/{locale}/maintenance/decommissions     candidates + history
/{locale}/maintenance/replacements
/{locale}/violations                    ?status&severity&typeId&userId
/{locale}/violations/new
/{locale}/violations/[id]
/{locale}/finance                       overview
/{locale}/finance/transactions          ?kind&categoryId&dateFrom&dateTo&source
/{locale}/finance/transactions/new
/{locale}/finance/transactions/[id]
/{locale}/finance/categories            tree editor
/{locale}/finance/budgets
/{locale}/finance/budgets/new
/{locale}/finance/budgets/[id]
/{locale}/reports                       hub
/{locale}/reports/[slug]                viewer, one per report endpoint
/{locale}/reports/exports                job list
/{locale}/users                         ?branchId&roleId&isActive&search
/{locale}/users/new
/{locale}/users/[id]                    detail: profile | permissions | custody | violations
/{locale}/users/[id]/edit
/{locale}/roles
/{locale}/roles/[id]                    permission matrix editor
/{locale}/organization/branches
/{locale}/organization/warehouses
/{locale}/organization/lookups          machine types/models, suppliers, payment methods,
                                        maintenance locations, violation types,
                                        decommission reasons
/{locale}/organization/sync             Sync Monitor (read-only)
/{locale}/audit                         ?entityType&action&userId&dateFrom&dateTo
/{locale}/notifications
/{locale}/settings                      profile | security | preferences | system
```

Every list route's filters live in the query string (`01`, rule 8).
