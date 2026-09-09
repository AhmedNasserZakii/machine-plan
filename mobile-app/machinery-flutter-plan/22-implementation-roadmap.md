# 22 — Implementation Roadmap

Build in this order. Each phase produces something demoable.

## Phase 0 — Foundation (week 1)

Files `01`, `02`, `03`, `04`, `05`, `06`.

- project skeleton or integration into the existing app (run the discovery checklist first)
- theme tokens, Cairo font, RTL verified on a real device
- l10n with `ar` + `en`, `flutter gen-l10n` wired into the build
- Dio + interceptors + `ApiResult` + `AppFailure`
- DI container, router with guards, shell with a permission-driven bottom bar
- shared widgets in `core/widgets/` — one file each

**Done when:** an empty app runs, switches language, flips direction correctly, and routes.

## Phase 1 — Auth (week 2)

File `08`.

- splash, login, change password
- secure token storage, refresh with the single-flight guard
- `AuthCubit` singleton, permission caching
- offline login with cached credentials
- biometric login enrolment

**Done when:** each seeded role logs in and sees a different bottom bar.

## Phase 2 — Local DB & sync skeleton (week 3) ← do this before features

File `07`.

- local database schema and DAOs
- `SyncQueueItem`, `PendingMedia`, `SyncService` with triggers and backoff
- `ConnectivityService`, `OfflineBanner`, `SyncStatusBadge`, sync queue screen
- `/sync/bootstrap` + `/sync/delta` consumption

**Do not build features before this exists.** Retrofitting offline support into finished screens
means rewriting every repository. This is the single most expensive mistake available on this project.

**Done when:** bootstrap populates the local DB and the app renders from it with the network off.

## Phase 3 — Machines & scanning (weeks 4–5)

Files `11`, `12`.

- machines list from cache, filters, search
- machine detail with all sections
- single-shot and continuous scanner, manual entry fallback
- machine form, bulk import
- timeline (once transfers exist, this fills in)

**Done when:** a rep can scan a sticker and see the machine's full record with no signal.

## Phase 4 — Transfers & signatures (weeks 6–8) ← the hard part

Files `13`, `14`.

- the 4-step create flow, continuous scanning into it
- per-item accessories, condition, battery scan, local mismatch warning
- photo capture + compression + local staging
- signature canvas and biometric path, payload hashing
- confirm flow with adjustments
- full offline path through the queue, conflict dialogs

Budget more time here than feels reasonable. This is where the product lives or dies.

**Done when:** a full offline hand-off of 12 machines with photos and a signature syncs correctly,
and pushing it twice creates nothing extra.

## Phase 5 — Merchants (week 9)

File `15`.

- list, detail, form with offline creation
- contact actions, machines at merchant
- subscriptions and collection

**Done when:** a rep registers a merchant and places 3 machines, offline, in one sitting.

## Phase 6 — Maintenance, violations (weeks 10–11)

Files `16`, `17`.

- maintenance orders, close flow with the finance posting preview
- replacement form and chain preview
- decommission with the cost snapshot, candidates list
- violations register, my-violations, charge and waive

**Done when:** closing a maintenance order shows exactly what it will do to the books before it
does it.

## Phase 7 — Finance (weeks 12–13)

File `18`.

- overview, transactions list and form with offline creation
- the nested category picker and category management
- budgets with the pace indicator
- category breakdown with direct + rolled-up totals

**Done when:** a 4-level category tree is navigable on a phone without frustration.

## Phase 8 — Reports, notifications, users (weeks 14–15)

Files `19`, `20`, `10`.

- generic report viewer, table/card/grouped/chart shapes
- export flow with job polling
- FCM, deep links in all three app states, preferences
- user management and the permission editor

**Done when:** a push wakes a terminated app and lands on the right confirm screen.

## Phase 9 — Polish & hardening (week 16)

- every screen tested in `ar` and `en`, both directions
- empty, loading, error and offline states on **every** screen (audit this deliberately — it is
  always the thing that ships broken)
- accessibility: 48 dp targets, contrast, text scaling to 1.3×
- performance: 1,000-machine list scrolls at 60 fps, images cached
- battery: no leaked camera controllers, sync does not wake constantly
- crash reporting, analytics on key flows
- field test with two real representatives on real phones in a real shop with bad signal

## Cross-cutting checklist per feature

- [ ] mirrors the existing project's patterns exactly
- [ ] **every widget in its own file under `widgets/`** — no private widget classes in pages
- [ ] no new packages without approval
- [ ] all strings in `ar` and `en` ARB files
- [ ] theme tokens only — zero hardcoded colours or text styles
- [ ] `EdgeInsetsDirectional` / `AlignmentDirectional` throughout
- [ ] serials, amounts and dates rendered LTR inside Arabic
- [ ] loading, empty, error and offline states implemented
- [ ] permission gating at navigation, widget and route level
- [ ] offline behaviour defined and implemented (works / queued / clearly online-only)
- [ ] cubit unit tests + widget tests for the main screen
- [ ] zero new lint warnings

## Highest-risk items

| Risk | Why it bites | Mitigation |
|---|---|---|
| Offline retrofitted late | forces a rewrite of every repository | Phase 2 before any feature |
| Signature UX rushed | people sign without seeing what they signed | payload summary is mandatory on the signing screen |
| RTL bugs found late | half the app looks broken to the actual users | test both locales from Phase 0 |
| Photo sizes | field uploads never complete on 3G | compress on capture, never on upload |
| Deep category picker | daily friction for the accountant | search + recents + breadcrumb from day one |
| Camera leaks | phone dies before the field day ends | dispose controllers, pause on background |
| Sync conflicts handled silently | a signed hand-off vanishes | blocking dialog, never a snackbar |
