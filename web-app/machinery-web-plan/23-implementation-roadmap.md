# 23 — Implementation Roadmap

Ten sprints. Each ends with something demonstrable to a real user and passes the gate in `25`.
Tick the matching section in `24` as you go.

The ordering is by **dependency and risk**, not by feature size. The foundation sprints look slow
and are not: every sprint after them is fast *because* of them.

---

## Sprint 0 — Foundation (no features)

Nothing user-visible ships. Do not skip it and do not shorten it.

- Next.js 15 project per `02`; strict TS; ESLint with the token and direction rules from `01`.
- `tokens.css` ported from the Dart theme; Tailwind `@theme` wiring; Cairo + Roboto Mono (`03`).
- next-intl with `ar`/`en`, `dir` switching, `sync-translations.ts` (`04`).
- `openapi-typescript` codegen wired into `npm run api:types` and CI (`05`).
- API client, `endpoints.ts`, `error-codes.ts`, idempotency, pagination helpers (`05`).
- BFF routes: login, logout, refresh, proxy — **including the 401-refresh-replay with the
  preserved idempotency key** (`06`).
- TanStack Query provider, query client defaults, `useUrlFilters` (`07`).
- App shell: sidebar, topbar, locale switcher, permission gates, `<Can>` (`06`, `08`).
- Vitest + Testing Library + MSW + Playwright skeletons (`25`).

**Done when:** you can log in, the shell renders in both locales with correct direction, `/auth/me`
drives the sidebar, and a deliberately-expired access token refreshes transparently.

---

## Sprint 1 — Auth + shell + dashboard skeleton

- `/login`, `/change-password` (both modes), logout, session expiry handling (`09`).
- Route guard table and the three-level gating end to end (`06`, `21`).
- Dashboard with two tiles only: pending incoming and pending outgoing transfers (`10`).
- `EmptyState`, `ErrorState`, skeletons, toasts, `ConfirmDialog`, `OfflineBanner` (`08`).

**Done when:** all five seeded roles can log in and each gets a correct, coherent sidebar.

---

## Sprint 2 — The DataTable system

Still mostly invisible, still the highest-leverage sprint in the project.

- `DataTable` with every requirement in `08`: semantic markup, whitelisted sorting, both pager
  shapes, selection, column visibility, density, sticky, four states, print.
- `FilterBar` with every filter type, chips, reset, saved views.
- Form kit: `AppForm` and every field type, with server `details[].field` mapping (`08`).
- Value primitives: `StatusChip`, `Money`, `SerialText`, `DateText`, `PhoneText`, chips (`08`).
- `print.css` (`03`).

**Done when:** a throwaway table over `machines` sorts, filters, paginates, selects and prints,
with all state in the URL, in both directions.

---

## Sprint 3 — Machines

- List with the full filter set; detail with all five tabs; create/edit form with the
  `requiresSim` rule and serial immutability (`11`).
- QR display and printable sticker.
- Command palette with `machines/lookup` (`08`, `11`).
- Machine lookup by serial.

**Done when:** a supervisor can find any machine by any of its four serials in under five seconds.

---

## Sprint 4 — Transfers

The riskiest feature. Give it a full sprint and expect to spend it.

- List with the three views; the four-step wizard; detail; confirm / reject / cancel (`12`).
- `<SignaturePad>` and the media upload pipeline (`05`, `12`).
- `transfers/validate` live validation; accessory match warnings.
- Printable hand-off receipt.
- Dashboard pending tiles wired properly.

**Done when:** a full custody chain — company → branch → representative → merchant and back —
can be executed on the web and the machine's status and holder are correct at every step.

---

## Sprint 5 — Merchants + maintenance

- Merchants: list, form with the duplicate pre-check, detail with all four tabs, subscriptions
  and collection (`13`).
- Maintenance: list, create, detail with the status stepper, send / receive / close / cancel (`14`).
- The maintenance → finance auto-transaction invalidation (`07`).

**Done when:** a machine can go out to a merchant, come back faulty, through maintenance, and
return to the fleet, with the cost landing in finance.

---

## Sprint 6 — Finance

- Overview, transactions list and form, detail, void (`16`).
- Category tree editor with drag-to-reparent and both delete refusals.
- Budgets with status and alerts.
- Export with the active filters.
- **Audit the `finance.read` money rule across every feature built so far** (`21`).

**Done when:** an accountant can do a full month's work without touching the mobile app, and a
supervisor without `finance.read` sees no amount anywhere.

---

## Sprint 7 — Violations + replacement + decommission

- Violations: list, create, detail, acknowledge / charge / waive; the violation → finance
  invalidation (`15`).
- Replacement flow and the chain view (`14`).
- Decommission: candidates, form, typed-serial confirmation, revert (`14`).
- User violation summary tab.

**Done when:** a machine's full lifecycle, from factory delivery to scrap, is exercisable on the web.

---

## Sprint 8 — Reports

- Hub built from `GET reports`; the generic viewer; a config entry per report (`17`).
- Group-by, drill-down, comparison mode.
- Export jobs with the persistent Exports panel (`07`, `17`).
- Print layouts for every report.

**Done when:** every one of the eighteen report endpoints renders, filters, drills down, exports
and prints.

---

## Sprint 9 — Admin

- Users, roles, the permission matrix and the per-user override editor (`18`).
- Branches, warehouses, the seven lookups (`19`).
- System settings, audit log with diffs, sync monitor (`19`).
- Notifications: bell, list, preferences (`20`).
- Web scanner (`20`).

**Done when:** a Director can set up a new branch from nothing — warehouses, lookups, users,
roles — without a developer or a database client.

---

## Sprint 10 — Hardening

- Full `21` role walk-through: log in as each of the five roles and check every screen.
- Accessibility pass: keyboard, focus order, screen reader, contrast (`25`).
- RTL/LTR pass on every screen.
- Print pass on every printable surface.
- Performance: bundle analysis, route-level code splitting, table virtualization if a list exceeds
  ~200 visible rows, image sizing.
- Error path pass: force a 401, 403, 404, 409, 422, 429, 500 and a network drop on every feature.
- E2E suite green (`25`).

**Done when:** the gate in `25` passes on every feature, not just the last one.

---

## Parallelization

With two developers, from Sprint 3 onward:

- **A**: machines → transfers → violations/decommission → reports
- **B**: merchants → maintenance → finance → admin

Sprints 0–2 are single-track. Splitting the foundation produces two incompatible foundations,
which is a worse outcome than a week of one person working alone.

## Explicitly out of scope for v1

Say no to these now, in writing, so they do not arrive as "small" mid-sprint additions:

- Offline support and any client-side write queue (`01`)
- Web push notifications (`20`)
- Dark mode (`03`)
- Real-time updates / websockets (`07`)
- A public or self-service anything: sign-up, password reset, merchant portal
- Any new backend endpoint (`01`)
