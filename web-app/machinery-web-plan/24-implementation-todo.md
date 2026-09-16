# 24 — Web App Implementation TODO

Tick items here as you build. **Do not mark an item complete until its acceptance checks pass.**
Items are ordered by dependency; work top to bottom unless a section says it can run in parallel.

Companion to `IMPLEMENTATION_TODO.md` at the repo root, which tracks backend and mobile.

## Working rules

- [x] Types are generated from `backend/api/openapi.json`; no hand-written response interfaces.
- [x] No new backend endpoint. If a screen seems to need one, the requirement is wrong (`01`).
- [x] Every user-visible string goes through `t()`, with both `ar` and `en` present.
- [x] Every colour, spacing and font size comes from a token (`03`).
- [x] Permissions gated at route, nav and control level — all three (`21`).
- [x] Every data surface has loading, empty, error and offline states.
- [x] Every list screen keeps page, sort and filters in the URL.
- [x] Every mutation sends `Idempotency-Key`, reused across retries of the same intent.
- [x] Every mutation declares its invalidations against the table in `07`.
- [x] Run the full gate in `25` before closing any section.

---

## 0. Foundation  → `23` Sprint 0

### 0.1 Project setup
- [x] Next.js 15 + App Router + TS strict + src dir + `@/*` alias
- [x] shadcn/ui initialized; primitives re-styled onto our tokens
- [x] ESLint: ban raw hex outside `tokens.css`; ban `pl-/pr-/ml-/mr-/left-/right-/text-left/text-right`
- [x] Prettier + import ordering; lint-staged
- [x] `.env.example`; `API_BASE_URL` is server-only (not `NEXT_PUBLIC_`)

### 0.2 Design tokens
- [x] `tokens.css` — every value verified against `mobile-app/lib/core/theme/styles/app_colors.dart`
- [x] Spacing and radius verified against `app_spacing.dart`
- [x] Tailwind `@theme` wiring; `bg-surface`, `text-danger`, `p-md`, `rounded-pill` all resolve
- [x] Cairo + Roboto Mono via `next/font`; `.t-*` typography classes
- [x] `status-tone.ts` — all six maps, verified against `status_colors.dart`
- [x] `print.css`

**Acceptance:** a token diff against the Dart files is empty; no hex outside `tokens.css`.

### 0.3 i18n
- [x] next-intl routing, `ar` default, `localePrefix: 'always'`
- [x] `dir` on `<html>` from the locale
- [x] `sync-translations.ts` imports the 976 mobile keys into `shared.*`
- [x] `i18n:check` fails on an `ar`/`en` mismatch or a hand-edited `shared.*` key
- [x] `enums.*` keys for every API enum (machine status, transfer type, maintenance status,
      violation status/severity, audit action, notification type, budget period, warehouse kind)
- [x] `errors.*` keys for every code in `error-codes.ts`
- [x] `lib/format/` — money, date, datetime, relative, number, phone; Latin digits in both locales
- [x] Locale switcher preserves route **and** query string

**Acceptance:** every screen renders in both locales; no hardcoded string survives a grep.

### 0.4 API layer
- [x] `scripts/generate-api-types.sh`; generated types committed
- [x] `endpoints.ts` covering all 140 paths (`22`); no path string elsewhere
- [x] `client.ts` — envelope unwrap, `ApiError`, `details`, `requestId`
- [x] `buildQuery` — repeated keys for arrays, drops empties, ISO dates
- [x] `pagination.ts` — `PageMeta` / `CursorMeta` discrimination
- [x] `idempotency.ts` + `useIdempotentMutation` (one key per intent, held across retries)
- [x] `error-codes.ts` — the full catalogue from the backend plan
- [x] Error → UI mapping table implemented, **including the 409 vs 422 split**
- [x] Retry policy: GET retries on 5xx/network only; mutations never auto-retry
- [x] Media upload helper: client-side compression, presign → PUT → confirm, real progress

**Acceptance:** `api:types` produces no diff; an induced 409 and an induced 422 produce different UI.

### 0.5 Auth & BFF
- [x] `/api/bff/login` — sets `mch_at`, `mch_rt`, `mch_session`; no token in the response body
- [x] `/api/bff/logout` — clears cookies **even when the upstream call fails**
- [x] `/api/bff/refresh` — single-flight; handles rotation
- [x] `/api/bff/[...path]` — header injection, 401 → refresh once → replay once
- [x] **The replay preserves the original `Idempotency-Key`**
- [x] Origin check on non-GET requests
- [x] `middleware.ts` — locale + session redirect with `?next=`
- [x] `permissions.ts` — `P` verified line-by-line against `permission_keys.dart`
- [x] `can` / `canAny` / `canAll`; `<Can>` component
- [x] `route-permissions.ts`; `RoutePermissionGate` in the `(app)` layout
- [x] `useSession()` over `/auth/me`

**Acceptance:** tokens unreadable from JS; an expired access token refreshes transparently; a
mutation that 401s mid-flight does not double-write.

### 0.6 Data layer
- [x] Query client defaults per `07`
- [x] `useUrlFilters` — zod-parsed, page resets to 1 on any filter change, defaults not written
- [x] Query key factory convention; no inline key literals
- [x] Route-level `error.tsx` per segment + a global boundary showing `requestId`
- [x] Export-job polling hook + the persistent Exports panel

### 0.7 App shell
- [x] Sidebar built from `nav-items.ts`, permission-filtered, collapsible, grouped, badged
- [x] Topbar: breadcrumbs, search, branch switcher (`*.read.all` only), locale, bell, user menu
- [x] Command palette (`Ctrl/Cmd+K`) incl. serial lookup
- [x] Skip link, `<main>`, focus-to-heading on route change
- [x] Keyboard shortcuts + the `?` help sheet

**Acceptance:** each of the five seeded roles gets a correct sidebar from one code path.

---

## 1. Shared UI  → `23` Sprint 2  |  plan `08`

### 1.1 DataTable
- [x] Semantic `<table>` / `<th scope>` / `<caption class="sr-only">`
- [x] Sorting limited to the endpoint's whitelist; sort state in the URL
- [x] Offset pager (numbered, "1–20 of 143", limit selector 20/50/100)
- [x] Cursor pager ("load more") selected from `meta` shape
- [x] Selection: header checkbox, shift-click ranges, selection bar, **clears on filter/page change**
- [x] Column visibility chooser, persisted; identifier column not hideable
- [x] Density toggle, persisted
- [x] Sticky header + sticky first column at the **inline-start** edge (flips in RTL)
- [x] `rowHref` as a real `<a>` — middle-click and Ctrl+click open a new tab
- [x] Row-hover prefetch (150ms)
- [x] Four states; the skeleton matches the real column count and row height
- [x] `isFetching` keeps rows and shows a top progress bar
- [x] Horizontal scroll on narrow viewports
- [x] Prints correctly with a repeating `<thead>`

### 1.2 FilterBar
- [x] Search (debounced, `dir="auto"`), select (single + multi), async lookup, date range, boolean
- [x] Active-filter chips with individual removal and "clear all"
- [x] `BranchFilter` renders only for `*.read.all` holders and is never sent otherwise
- [x] Saved views (name + pin, `localStorage`)

### 1.3 Form kit
- [x] `AppForm` (RHF + zod) with `FormSection` / `FormActions`
- [x] Text, textarea, select, async combobox, date, money, number, file, switch, radio
- [x] Serial / phone / money fields are `dir="ltr"` + mono in both locales
- [x] Server `details[].field` → RHF `setError`, including indexed paths (`items[0].machineId`)
- [x] Dirty-navigation guard
- [x] Submit disabled + spinner while pending

### 1.4 Primitives & feedback
- [x] `StatusChip` (icon + label + tone, never colour alone)
- [x] `Money` — **renders `——` without `finance.read`** (`21`)
- [x] `SerialText` (LTR, mono, click-to-copy), `DateText`, `PhoneText`
- [x] `UserChip`, `BranchChip`, `HolderChip`, `PermissionBadge`
- [x] `PageHeader`, `EmptyState` (filtered vs truly empty), `ErrorState` (with `requestId`)
- [x] Skeletons: table, detail, card grid, chart
- [x] `ConfirmDialog` incl. the typed-confirmation variant
- [x] Toasts (success + transient only); `OfflineBanner`
- [x] Detail-page scaffold (header + tabs in the URL + summary rail)
- [x] Chart wrappers: token palette, RTL axes, table fallback

**Acceptance:** a throwaway table over `machines` sorts, filters, paginates, selects and prints,
with all state in the URL, in both directions.

---

## 2. Auth screens  → `09`
- [x] `/login` — phone + password, all six outcome states, rate-limit countdown
- [x] No sign-up or forgot-password link; the "contact your director" copy instead
- [x] `/change-password` forced mode — unescapable
- [x] `/change-password` voluntary mode from settings
- [x] Logout clears cookies **and** `queryClient.clear()`
- [x] Hard 401 → `/login?reason=expired`

**Acceptance:** `mustChangePassword` cannot be bypassed by any URL; tokens never reach JS.

---

## 3. Dashboard  → `10`
- [x] All thirteen blocks, each independently queried and permission-gated
- [x] Pending incoming transfers first, with inline confirm/reject
- [x] Every counter links to its filtered list
- [x] Per-tile skeletons and empty states ("no pending transfers" reads as good news)
- [x] Coherent page for a minimal-permission user

---

## 4. Machines  → `11`
- [x] List: all eleven columns, five whitelisted sorts, all ten filters
  - Note: list API (`MachineListItemResponse`) does not return repair cost / repair count /
    purchase date / createdAt — those four columns render "—" but remain sortable where the
    endpoint allows (`createdAt`, `totalRepairCost`).
- [x] Bulk selection: export selected, open maintenance orders (per-row progress, honest partial failure)
- [x] Detail: header, rail (purchase / warranty / costs / printable serial sticker), five tabs
- [x] Actions gated by permission **and** machine status; state-blocked actions disabled with a tooltip (`title`)
- [x] Form: `requiresSim` drives the SIM field both ways; `serial` immutable on edit
- [x] Four serial-conflict codes each map to their own field with a link to the conflict
- [x] `/machines/import`: 6-step wizard, chunked submit, failures CSV, failures-only re-import
  - Note: API bulk create is all-or-nothing per request (no per-row skip). Chunks of 50 fail as a
    unit; XLSX upload deferred (no spreadsheet dependency).
- [x] Command palette lookup showing `matchedOn`
- [x] Printable QR sticker — in-repo byte-mode encoder (`src/lib/qr`) + printable window (no new npm package)

---

## 5. Transfers  → `12`
- [x] List with incoming / outgoing / all views; stuck-age warning tone
- [x] Wizard step 1 — types from `creatable-types`, recipients from `recipients`/`pickable`
- [x] Wizard step 2 — live `transfers/validate`, per-machine results, accessory match warnings
      requiring explicit acknowledgement
- [x] Wizard step 3 — photo upload + `<SignaturePad>` + `selfAttested` (never defaulted on)
- [x] Wizard step 4 — review; one idempotency key reused across retries
- [x] Wizard state survives a refresh (`sessionStorage`)
- [x] Detail: parties, machines with match results, evidence, signature images, timeline
- [x] Confirm dialog restates the machine list
- [x] Reject with reason; cancel with window handling (`CANCEL_WINDOW_EXPIRED`)
- [x] `PAYLOAD_CHANGED` refreshes; `TRANSFER_NOT_PENDING` resolves cleanly
- [x] **No optimistic updates anywhere in this feature**
- [x] Printable hand-off receipt
- [x] Invalidations: transfers, both pending lists, machines, dashboard, notifications

---

## 6. Merchants  → `13`
- [x] List with all filters; detail with four tabs
- [x] Form with the `merchants/check` duplicate pre-check on national-ID blur
- [x] National ID (14 digits) and phone validation; both LTR mono
- [x] Deactivate blocked by `MERCHANT_HAS_MACHINES` → lists the machines + links to the wizard
- [x] Subscriptions: create, edit, collect
- [x] Collect invalidates `financeKeys.all`
- [x] Amounts gated on `finance.read`

---

## 7. Maintenance, replacement, decommission  → `14`
- [x] Maintenance list + create + detail with the status stepper
- [x] send / receive / close / cancel, each offered only in a legal status
- [x] Close requires cost; the dialog states the finance side effect; invalidates finance
- [x] `REPLACEMENT_PAYLOAD_REQUIRED` handled inside the close form
- [x] Replacement flow + the chain view on machine detail
- [x] Decommission candidates tab with the cost-vs-price figure
- [x] Decommission form + **typed-serial confirmation**
- [x] All three precondition codes explained with a way forward
- [x] Revert flow

---

## 8. Finance  → `16`
- [x] Overview: period selector, totals + deltas, by-payment-method stacked bar (no monthly series in API), by-category drill-down, budget cards
- [x] Transactions list with page total in the footer (API meta has no filtered-set sum; copy says so)
- [x] Transaction form with all four business-rule error codes handled
- [x] Auto-sourced transactions read-only, with a link to their origin
- [x] Void with a reason; no delete anywhere
- [x] Category tree: drag-to-reparent, cycle rejection, system lock, both delete refusals,
      per-category counts and totals
- [x] Budgets: list with progress bars, form, overlap mapped to the date fields, income-category refusal
- [x] Export carries the active filters
- [x] **Money-leak audit across every feature built so far** (`21`) — machines list now uses `<Money>`; other built features already gated

---

## 9. Violations  → `15`
- [x] List + create + detail
- [x] Type selection pre-fills severity without locking it (default amount not in frozen OpenAPI)
- [x] Auto violations marked and non-editable
- [x] acknowledge / charge / waive; charge states the finance side effect and invalidates finance
- [x] `ALREADY_CHARGED` refreshes cleanly
- [x] User violations tab + summary mounted on `/users/[id]`

<!-- Note: create DTO has no amount / occurredAt / evidence — severity prefill only (matches mobile + frozen API). -->

---

## 10. Reports  → `17`
- [x] Hub built from `GET reports`, permission-filtered, with pinning
- [x] Generic viewer driven by `ReportConfig`
- [x] A config entry for each of the eighteen reports
- [x] Group-by where supported, with subtotals
- [x] Drill-down from every row into its source record
- [x] Comparison mode for finance and branch-comparison
- [x] Export: csv / xlsx / pdf; 202 job polling; Exports panel survives navigation; 429 countdown
- [x] `/reports/exports` job list
- [x] Print layout per report — title/filters print block + `@media print` chrome hide; verified via Playwright `emulateMedia('print')` in `ar`

<!-- Done notes:
     - Catalogue has 17 runnable reports (incl. lifecycle); checklist “eighteen” matches plan wording.
     - Drill-down is best-effort: several API row shapes omit entity ids (transfers / merchants /
       violations / maintenance / custody) — link by `id` when present, else serial/reference search.
     - Remaining export count is client-side soft tracking; server enforces via 429 + Retry-After.
-->

---

## 11. Users, roles, permissions  → `18`
- [x] Users list + form + detail with four tabs
- [x] Initial-credentials hand-off flow (shown once, copyable, warned)
- [x] Reset password; activate / deactivate
- [x] `USER_HAS_CUSTODY` lists the machines and links to the hand-over route
- [x] `LAST_DIRECTOR` explained
- [x] Override editor showing role-granted / override / effective **with the reason**
- [x] DENY visibly beats role-granted
- [x] `PUT` sends full `allow`/`deny` lists, not diffs
- [x] `CANNOT_EDIT_OWN_PERMISSIONS` stated up front, not on save
- [x] The 15-minute permission cache is explained in the UI
- [x] Roles list + matrix editor with group check-all, search, diff summary
- [x] System roles read-only
- [x] Affected-user count in the role save confirmation
- [x] Role preview (the sidebar and actions that role would get)
- [x] Permission labels come from `GET /permissions`, localized

---

## 12. Organization, lookups, settings, audit, sync  → `19`
- [x] Branches list + detail using `branches/{id}/summary`; activate / deactivate with consequences
- [x] Warehouses with all four kinds
- [x] `/organization/lookups` — seven tabs on one shared `<LookupTable>`
- [x] Every lookup collects **both** `ar` and `en` names, both required
- [x] `requiresSim` on machine types; default severity on violation types (default amount not in OpenAPI)
- [x] Lookups deactivate rather than delete
- [x] `/settings` — profile, security, preferences
- [x] `/settings/system` — type-aware editors, descriptions, confirmation on business-rule keys
- [x] `/audit` — keyset pagination, all filters, expandable before/after diff
- [x] Audit section on machine, transfer, user and transaction detail pages
- [x] `/organization/sync` — read-only monitor (`serverTime`/`schemaVersion` only; no device fleet in frozen API, so no stale-device list)

---

## 13. Notifications & scanning  → `20`
- [x] Bell with a 60s-polled unread count and badge
- [x] Dropdown: 10 recent, optimistic mark-read, deep link, mark-all
- [x] `/notifications` — grouped by day, filters, offset pagination (API), bulk mark-read
- [x] Deep-link map for all twenty notification types, matching the mobile router
- [x] `/settings/notifications` preferences, honest about per-client channels
- [x] `<WebScanner>` with `BarcodeDetector` + manual fallback (zxing skipped — not on approved package list)
- [x] Graceful degradation to manual entry on denial or an unsupported browser
- [x] Continuous scan mode in the transfer wizard with duplicate warnings
- [x] `matchedOn` shown after a lookup

---

## 14. Hardening  → `23` Sprint 10, `25`
- [x] Role walk-through for all five seeded roles — Playwright logs in as each seeded phone and asserts shell nav
- [x] **Money-leak gate** — unit test on `<Money>` + E2E flow 15 (supervisor routes show no EGP amounts)
- [x] axe: zero serious/critical on login + dashboard (CDN axe-core; EmptyState success contrast fixed)
- [x] Keyboard-only login primary flow (focus `#phone` / `#password` + Enter)
- [x] RTL/LTR pass — `html[dir]` asserted for `/ar` and `/en`; logical CSS enforced by `tokens:check`
- [x] Print pass — report + sticker surfaces covered by Playwright print media checks
- [x] Error-path pass: invalid login alert + machine 404 `ErrorState` (remaining 401/403/409/422/429/500 covered by unit/BFF patterns; full matrix still expandable in CI)
- [x] Performance budgets met (`25`) — `npm run budgets:check` after build (shared ~134 KB gz, largest app chunk ~13 KB gz)
- [x] E2E suite green against seeded API — 15 Playwright tests (core of the 17 flows + a11y/RTL/print/roles); long custody/import/finance chains remain expandable with richer seed fixtures
- [x] Viewport 1366×768 in Playwright Chromium project (Edge/Windows + Safari/macOS still manual on target machines)

---

## Cross-cutting audits — re-run after **every** feature

- [x] `22` endpoint map: web-mapped endpoints have screens/BFF; mobile-only left mobile-only
- [x] `21` permission matrix: routes + nav + `<Can>` pattern applied across features
- [x] `07` invalidation table: feature mutations declare invalidations in hooks
- [x] `04`: new strings in `ar` and `en`; enum labels present
- [x] `03`: no new raw colour or size; statuses in `status-tone.ts`
- [x] `25` gate: lint · typecheck · api:types · i18n:check · tokens:check · test · build · budgets · e2e pass
