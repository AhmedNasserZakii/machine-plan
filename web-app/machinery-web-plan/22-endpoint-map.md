# 22 — Endpoint → Screen Map

All **140 paths** from `backend/api/openapi.json`, mapped to the web screen that calls them.
Base: `/api/v1/…`, reached from the browser as `/api/bff/…` (`05`, `06`).

**Coverage rule:** every row must end up either mapped to a screen or explicitly marked
mobile-only. A row with no owner is a missed feature. Re-check this table after each sprint.

## Auth (8)

| Method | Path | Screen | Plan |
|---|---|---|---|
| POST | `auth/login` | `/login` (via BFF) | 09 |
| POST | `auth/refresh` | BFF only | 06 |
| POST | `auth/logout` | user menu | 09 |
| GET | `auth/me` | `(app)` layout — session | 06 |
| POST | `auth/change-password` | `/change-password`, `/settings/security` | 09 |
| POST | `auth/biometric/enroll` | — **mobile only** | — |
| POST | `auth/devices` | — **mobile only** (push) | 20 |
| DELETE | `auth/devices/{deviceId}` | `/settings/security` (revoke a device) | 09 |

## Devices (2)

| Method | Path | Screen | Plan |
|---|---|---|---|
| POST | `devices` | — **mobile only** | 20 |
| DELETE | `devices/{deviceId}` | `/settings/security` | 09 |

## Machines (13)

| Method | Path | Screen | Plan |
|---|---|---|---|
| GET | `machines` | `/machines` | 11 |
| POST | `machines` | `/machines/new` | 11 |
| POST | `machines/bulk` | `/machines/import` | 11 |
| GET | `machines/by-serial/{serial}` | search / scanner resolve | 11, 20 |
| GET | `machines/lookup` | command palette, transfer wizard | 08, 11, 12 |
| GET | `machines/{id}` | `/machines/[id]` | 11 |
| PATCH | `machines/{id}` | `/machines/[id]/edit` | 11 |
| GET | `machines/{id}/timeline` | detail → timeline tab | 11 |
| GET | `machines/{id}/cost-summary` | detail → costs tab (`finance.read`) | 11, 21 |
| GET | `machines/{id}/maintenance-history` | detail → maintenance tab | 11 |
| GET | `machines/{id}/replacement-chain` | detail → chain tab | 14 |
| POST | `machines/{id}/replace` | replacement dialog | 14 |
| GET | `machines/decommission-candidates` | `/maintenance/decommissions` | 14 |
| GET/POST | `machines/{id}/decommission` | decommission record / form | 14 |
| POST | `machines/{id}/decommission/revert` | decommission record | 14 |

## Machine catalogue (4)

| Method | Path | Screen | Plan |
|---|---|---|---|
| GET/POST | `machine-types` | `/organization/lookups?tab=types`, machine form | 19, 11 |
| PATCH | `machine-types/{id}` | lookups | 19 |
| GET/POST | `machine-models` | `/organization/lookups?tab=models`, machine form | 19, 11 |
| PATCH | `machine-models/{id}` | lookups | 19 |

## Transfers (11)

| Method | Path | Screen | Plan |
|---|---|---|---|
| GET | `transfers` | `/transfers` | 12 |
| POST | `transfers` | wizard step 4 | 12 |
| GET | `transfers/creatable-types` | wizard step 1 | 12 |
| GET | `transfers/recipients` | wizard step 1 | 12 |
| POST | `transfers/validate` | wizard step 2 (live) | 12 |
| GET | `transfers/pending/incoming` | dashboard, inbox view | 10, 12 |
| GET | `transfers/pending/outgoing` | dashboard, outbox view | 10, 12 |
| GET | `transfers/{id}` | `/transfers/[id]` | 12 |
| POST | `transfers/{id}/confirm` | confirm dialog | 12 |
| POST | `transfers/{id}/reject` | reject dialog | 12 |
| POST | `transfers/{id}/cancel` | cancel action | 12 |
| GET | `transfers/{id}/signatures/{signatureId}/media` | detail → evidence | 12 |

## Merchants & subscriptions (10)

| Method | Path | Screen | Plan |
|---|---|---|---|
| GET | `merchants` | `/merchants` | 13 |
| POST | `merchants` | `/merchants/new` | 13 |
| POST | `merchants/check` | form, national-ID blur | 13 |
| GET | `merchants/pickable` | transfer wizard | 12 |
| GET | `merchants/{id}` | `/merchants/[id]` | 13 |
| PATCH | `merchants/{id}` | `/merchants/[id]/edit` | 13 |
| PATCH | `merchants/{id}/deactivate` | detail action | 13 |
| GET | `merchants/{id}/machines` | detail → machines tab | 13 |
| GET/POST | `merchants/{id}/subscriptions` | detail → subscriptions tab | 13 |
| GET | `merchants/{id}/timeline` | detail → timeline tab | 13 |
| PATCH | `subscriptions/{id}` | subscription edit | 13 |
| POST | `subscriptions/{id}/collect` | collect dialog | 13 |

## Maintenance (7)

| Method | Path | Screen | Plan |
|---|---|---|---|
| GET | `maintenance-orders` | `/maintenance` | 14 |
| POST | `maintenance-orders` | `/maintenance/new` | 14 |
| GET | `maintenance-orders/{id}` | `/maintenance/[id]` | 14 |
| PATCH | `maintenance-orders/{id}` | detail edit | 14 |
| POST | `maintenance-orders/{id}/send` | stepper action | 14 |
| POST | `maintenance-orders/{id}/receive` | stepper action | 14 |
| POST | `maintenance-orders/{id}/close` | close dialog | 14 |
| POST | `maintenance-orders/{id}/cancel` | cancel action | 14 |
| GET/POST | `maintenance-locations` | lookups, order form | 19, 14 |

## Replacements & decommissions (3)

| Method | Path | Screen | Plan |
|---|---|---|---|
| GET | `replacements` | `/maintenance/replacements` | 14 |
| GET | `decommissions` | `/maintenance/decommissions?tab=history` | 14 |
| GET/POST | `decommission-reasons` | lookups, decommission form | 19, 14 |

## Violations (7)

| Method | Path | Screen | Plan |
|---|---|---|---|
| GET | `violations` | `/violations` | 15 |
| POST | `violations` | `/violations/new` | 15 |
| GET | `violations/{id}` | `/violations/[id]` | 15 |
| PATCH | `violations/{id}` | detail edit (manual only) | 15 |
| POST | `violations/{id}/acknowledge` | detail action | 15 |
| POST | `violations/{id}/charge` | charge dialog | 15 |
| POST | `violations/{id}/waive` | waive dialog | 15 |
| GET/POST | `violation-types` | lookups, violation form | 19, 15 |
| PATCH | `violation-types/{id}` | lookups | 19 |

## Finance (16)

| Method | Path | Screen | Plan |
|---|---|---|---|
| GET | `finance/summary` | `/finance` | 16 |
| GET | `finance/by-category` | `/finance` breakdown | 16 |
| GET | `finance/transactions` | `/finance/transactions` | 16 |
| POST | `finance/transactions` | `/finance/transactions/new` | 16 |
| GET | `finance/transactions/{id}` | transaction detail | 16 |
| PATCH | `finance/transactions/{id}` | transaction edit (manual only) | 16 |
| POST | `finance/transactions/{id}/void` | void dialog | 16 |
| GET | `finance/export` | export menu | 16, 17 |
| GET/POST | `finance/categories` | `/finance/categories` | 16 |
| GET | `finance/categories/tree` | tree editor | 16 |
| GET/PATCH/DELETE | `finance/categories/{id}` | tree editor | 16 |
| GET | `finance/categories/{id}/breadcrumb` | category path display | 16 |
| PATCH | `finance/categories/{id}/move` | tree drag-to-reparent | 16 |
| GET/POST | `finance/budgets` | `/finance/budgets` | 16 |
| GET | `finance/budgets/status` | dashboard + budgets list | 10, 16 |
| GET/PATCH/DELETE | `finance/budgets/{id}` | budget detail / form | 16 |
| GET/POST | `payment-methods` | lookups, finance forms | 19, 16 |
| PATCH | `payment-methods/{id}` | lookups | 19 |

## Reports (19)

Every row: `/reports/[slug]` via the generic viewer (`17`).

| Method | Path | Slug |
|---|---|---|
| GET | `reports` | hub catalogue |
| GET | `reports/machines/inventory` | `machines-inventory` |
| GET | `reports/machines/custody` | `machines-custody` |
| GET | `reports/machines/costs` | `machines-costs` |
| GET | `reports/machines/idle` | `machines-idle` |
| GET | `reports/machines/warranty` | `machines-warranty` |
| GET | `reports/machines/{id}/lifecycle` | machine detail → lifecycle |
| GET | `reports/transfers` | `transfers` |
| GET | `reports/transfers/pending` | `transfers-pending` |
| GET | `reports/maintenance` | `maintenance` |
| GET | `reports/violations` | `violations` |
| GET | `reports/merchants` | `merchants` |
| GET | `reports/representatives` | `representatives` |
| GET | `reports/branches/comparison` | `branches-comparison` |
| GET | `reports/finance/expenses` | `finance-expenses` |
| GET | `reports/finance/income` | `finance-income` |
| GET | `reports/finance/pnl` | `finance-pnl` |
| GET | `reports/finance/budgets` | `finance-budgets` |
| GET | `reports/jobs/{id}` | export job polling |

## Users, roles, permissions (13)

| Method | Path | Screen | Plan |
|---|---|---|---|
| GET | `users` | `/users` | 18 |
| POST | `users` | `/users/new` | 18 |
| GET | `users/{id}` | `/users/[id]` | 18 |
| PATCH | `users/{id}` | `/users/[id]/edit` | 18 |
| PATCH | `users/{id}/activate` | detail action | 18 |
| PATCH | `users/{id}/deactivate` | detail action | 18 |
| GET/PUT | `users/{id}/permissions` | permissions tab | 18 |
| POST | `users/{id}/reset-password` | detail action | 18 |
| GET | `users/{id}/custody` | custody tab, dashboard | 18, 10 |
| GET | `users/{id}/violations` | violations tab | 15, 18 |
| GET | `users/{id}/violations/summary` | violations tab | 15, 18 |
| GET/POST | `roles` | `/roles` | 18 |
| GET/PATCH | `roles/{id}` | `/roles/[id]` | 18 |
| PUT | `roles/{id}/permissions` | role matrix | 18 |
| GET | `permissions` | catalogue for both matrices | 18 |

## Organization (8)

| Method | Path | Screen | Plan |
|---|---|---|---|
| GET/POST | `branches` | `/organization/branches` | 19 |
| GET/PATCH | `branches/{id}` | branch detail | 19 |
| PATCH | `branches/{id}/activate` | branch detail | 19 |
| PATCH | `branches/{id}/deactivate` | branch detail | 19 |
| GET | `branches/{id}/summary` | branch detail dashboard | 19 |
| GET/POST | `warehouses` | `/organization/warehouses` | 19 |
| GET | `warehouses/{id}` | warehouse detail | 19 |
| GET/POST | `suppliers` | lookups, machine form | 19, 11 |

## Notifications (5)

| Method | Path | Screen | Plan |
|---|---|---|---|
| GET | `notifications` | bell, `/notifications` | 20 |
| GET | `notifications/unread-count` | badge (60s poll) | 20 |
| PATCH | `notifications/{id}/read` | bell / list | 20 |
| PATCH | `notifications/read-all` | bell / list | 20 |
| GET/PUT | `notification-preferences` | `/settings/notifications` | 20 |

## Media (5)

| Method | Path | Screen | Plan |
|---|---|---|---|
| POST | `media/presign` | photo + signature upload | 05, 12 |
| GET/PUT | `media/blob` | upload target | 05 |
| POST | `media/confirm` | after upload | 05 |
| POST | `media/upload` | small direct uploads | 05 |
| GET/DELETE | `media/{id}` | gallery view / remove | 05, 12 |

## Sync (4)

| Method | Path | Screen | Plan |
|---|---|---|---|
| GET | `sync/status` | `/organization/sync` (read-only monitor) | 19 |
| GET | `sync/bootstrap` | — **mobile only** | 01 |
| GET | `sync/delta` | — **mobile only** | 01 |
| POST | `sync/batch` | — **mobile only** | 01 |

## Settings & audit (5)

| Method | Path | Screen | Plan |
|---|---|---|---|
| GET | `settings` | `/settings/system` | 19 |
| GET/PUT | `settings/{key}` | `/settings/system` | 19 |
| GET | `audit-logs` | `/audit` | 19 |
| GET | `audit-logs/entity/{type}/{id}` | audit section on detail pages | 19 |
| GET | `audit-logs/user/{userId}` | user detail activity | 19 |

## Summary

| Bucket | Count |
|---|---|
| Mapped to a web screen | 134 |
| Mobile-only by design (sync × 3, biometric enroll, push device register × 2) | 6 |
| **Total** | **140** |
