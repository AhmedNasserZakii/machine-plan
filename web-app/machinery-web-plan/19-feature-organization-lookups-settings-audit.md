# 19 — Feature: Organization, Lookups, Settings, Audit & Sync Monitor

Largely **web-only**. The mobile app consumes these as read-only lookups; the web app is where they
are maintained. This is the Director's setup area and it should be built early enough that the
other features have real data to work with.

## Endpoints

| Area | Endpoints | Permission |
|---|---|---|
| Branches | `GET/POST branches`, `GET/PATCH branches/{id}`, `PATCH .../activate`, `PATCH .../deactivate`, `GET .../summary` | `branches.manage` |
| Warehouses | `GET/POST warehouses`, `GET warehouses/{id}` | `branches.manage` |
| Machine types | `GET/POST machine-types`, `PATCH machine-types/{id}` | `settings.manage` |
| Machine models | `GET/POST machine-models`, `PATCH machine-models/{id}` | `settings.manage` |
| Suppliers | `GET/POST suppliers` | `settings.manage` |
| Payment methods | `GET/POST payment-methods`, `PATCH payment-methods/{id}` | `settings.manage` |
| Maintenance locations | `GET/POST maintenance-locations` | `settings.manage` |
| Violation types | `GET/POST violation-types`, `PATCH violation-types/{id}` | `settings.manage` |
| Decommission reasons | `GET/POST decommission-reasons` | `settings.manage` |
| Settings | `GET settings`, `GET/PUT settings/{key}` | `settings.manage` |
| Audit | `GET audit-logs`, `GET audit-logs/entity/{type}/{id}`, `GET audit-logs/user/{userId}` | `audit.read` |
| Sync monitor | `GET sync/status` | `settings.manage` |

## `/organization/branches`

List: name · code · warehouse count · user count · machine count · status · created at.
Detail uses `branches/{id}/summary` — machines by status, users, merchants, open transfers, open
maintenance orders. This is the closest thing to a branch dashboard and it is what a Director opens
when they want to know how Alexandria is doing.

Activate / deactivate with confirmation. Deactivating a branch with active users or machines must
explain the consequence before it happens, not after.

## `/organization/warehouses`

Kinds: `COMPANY_MAIN`, `BRANCH`, `SCRAP`, `MAINTENANCE`. List with branch, kind, machine count.
Create with name, kind, branch (required for `BRANCH`), location.

`SCRAP` and `MAINTENANCE` warehouses are destinations in the transfer wizard (`12`); their
existence is a precondition for the decommission and maintenance flows, so seed them first.

## `/organization/lookups` — one screen, tabbed

Seven small CRUD tables behind tabs (tab in the URL). They share a single `<LookupTable>`
component; writing seven bespoke screens here would be a waste.

| Tab | Fields worth noting |
|---|---|
| Machine types | name (ar/en), **`requiresSim`** — drives the machine form (`11`) |
| Machine models | name, manufacturer, machine type |
| Suppliers | name, contact, phone |
| Payment methods | name, active |
| Maintenance locations | name, kind, contact |
| Violation types | name, **default severity**, **default amount** — templates for `15` |
| Decommission reasons | name, active |

Every lookup carries **ar and en names**. The backend's localization strategy
(`backend/machinery-backend-plan/02`) stores both; the form must collect both and the UI must
label which is which. A lookup created with only an Arabic name renders blank for an English user —
make it a required field, not a hopeful one.

Deactivating a lookup in use must not break historical records: deactivate, never delete, and say
so in the UI.

## `/settings`

Tabs:

- **Profile** — name, phone, branch, role (read-only), signature image if present.
- **Security** — change password (`09`), active sessions/devices if the contract exposes them.
- **Preferences** — locale, table density, default landing page, saved views. Client-side only,
  `localStorage`.
- **System** (`settings.manage`) — `GET settings` lists every key with its value, type and
  description; `PUT settings/{key}` edits one. Type-aware editors (boolean toggle, number,
  date, string, JSON). Show each key's description and its effect, and require confirmation on
  anything that changes a business rule (backdate limit, stuck-transfer threshold, cancel window,
  idle-machine threshold). These keys change behaviour across both clients — treat the screen with
  the seriousness that implies.

## `/audit` — audit log (web-only)

There is no mobile screen for this. `GET audit-logs` supports keyset pagination, so the table uses
"load more" (`05`).

Columns: timestamp · actor (`<UserChip>`) · action · entity type · entity · branch · IP · request id.
Filters: `entityType` (machine, battery, merchant, user, role, branch, warehouse, transfer,
transfer_signature, maintenance_order, replacement, decommission, finance_transaction, budget,
finance_category, violation, auth, finance) · `action` (the ~57-value catalogue) · `userId` ·
date range.

Expanding a row shows the before/after diff as a two-column field-by-field comparison with changed
values highlighted. That diff is the entire value of an audit log; a row that only says
"MACHINE_UPDATED" is not useful.

`GET audit-logs/entity/{type}/{id}` powers an **"Audit" section on every detail page** (behind
`audit.read`) — machine, transfer, user, transaction. `GET audit-logs/user/{userId}` powers the
user detail's activity view.

Note `FINANCE_READ_ACCESSED` in the action list: the backend logs finance *reads*. Surface it, and
be aware that an auditor will use it.

## `/organization/sync` — Sync Monitor (read-only)

The web app has no offline mode (`01`), but the Director needs to see the mobile fleet's health.
`GET sync/status` renders: devices, last sync time, pending operation counts, schema version, and
anything flagged as failing.

Read-only. No action from here — a stuck device is fixed on the device. Rows older than a threshold
get a warning tone, which is the one thing this page needs to do well.

## Acceptance

- [ ] Every lookup collects both `ar` and `en` names, both required.
- [ ] `requiresSim` on machine types visibly drives the machine form.
- [ ] Violation type defaults pre-fill the violation form.
- [ ] Lookups deactivate rather than delete; historical records stay intact.
- [ ] Branch summary matches the numbers shown elsewhere in the app.
- [ ] Audit rows expand to a readable before/after diff.
- [ ] Audit uses keyset pagination, not offset.
- [ ] System settings show each key's description and confirm business-rule changes.
- [ ] Sync monitor flags stale devices.
