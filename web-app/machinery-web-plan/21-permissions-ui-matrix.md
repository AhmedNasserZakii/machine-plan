# 21 — Permission → UI Matrix

> The single reference every feature file points at. If a control is not in this table, it does not
> ship. Mirrors `mobile-app/machinery-flutter-plan/21-permissions-ui-matrix.md`.

## The three levels, restated

1. **Route** — `route-permissions.ts` + the `(app)` layout gate (`06`).
2. **Navigation** — `nav-items.ts`; an item the user cannot use does not render.
3. **Control** — `<Can>` around the button, menu item, row action, tab or field.

All three, every time. Missing (1) means a URL leaks a page. Missing (2) means a dead link.
Missing (3) means a 403 the user did not deserve.

## Routes

| Route | Requires |
|---|---|
| `/` | authenticated |
| `/machines`, `/machines/[id]` | `machines.read` |
| `/machines/new`, `/machines/[id]/edit` | `machines.create` / `machines.update` |
| `/machines/import` | `machines.import` |
| `/transfers`, `/transfers/[id]` | `transfers.read` |
| `/transfers/new` | `transfers.create` |
| `/merchants`, `/merchants/[id]` | `merchants.read` |
| `/merchants/new`, `/merchants/[id]/edit` | `merchants.create` / `merchants.update` |
| `/maintenance`, `/maintenance/[id]` | `maintenance.read` |
| `/maintenance/new` | `maintenance.create` |
| `/maintenance/decommissions` | `machines.decommission` |
| `/maintenance/replacements` | `maintenance.read` |
| `/violations`, `/violations/[id]` | `violations.read` |
| `/violations/new` | `violations.create` |
| `/finance/**` | `finance.read` |
| `/finance/categories` | `finance.categories.manage` |
| `/finance/budgets/**` | `finance.budgets.manage` |
| `/reports`, `/reports/[slug]` | any of `ANY_REPORT`, then the per-report permission |
| `/reports/exports` | `reports.export` |
| `/users`, `/users/[id]` | `users.read` |
| `/users/new`, `/users/[id]/edit` | `users.create` / `users.update` |
| `/roles/**` | `roles.manage` |
| `/organization/branches`, `/organization/warehouses` | `branches.manage` |
| `/organization/lookups`, `/organization/sync` | `settings.manage` |
| `/audit` | `audit.read` |
| `/notifications`, `/settings` (profile/security/preferences) | authenticated |
| `/settings/system` | `settings.manage` |

## Controls

### Machines
| Control | Permission | Extra condition |
|---|---|---|
| New machine | `machines.create` | |
| Edit machine | `machines.update` | not `DECOMMISSIONED` |
| Bulk import | `machines.import` | |
| Delete machine | `machines.delete` | |
| Branch filter | `machines.read.all` | |
| Cost card / repair totals | `finance.read` | **see "money" below** |
| Create transfer from machine | `transfers.create` | in caller's custody, not `IN_TRANSIT` |
| Open maintenance order | `maintenance.create` | not `UNDER_MAINTENANCE` |
| Replace machine | `maintenance.update` | not already replaced |
| Decommission | `machines.decommission` | in a warehouse, no open order |
| Revert decommission | `machines.decommission` | is decommissioned |
| Export list | `reports.export` | |

### Transfers
| Control | Permission | Extra condition |
|---|---|---|
| New transfer | `transfers.create` | type in `creatable-types` |
| Confirm | `transfers.confirm` | `PENDING`, caller is the receiver |
| Reject | `transfers.reject` | `PENDING`, caller is the receiver |
| Cancel | `transfers.cancel` | `PENDING`, caller is the creator, window open |
| All-branches view | `transfers.read.all` | |
| Print receipt | `transfers.read` | |

### Merchants
| Control | Permission | Extra condition |
|---|---|---|
| New merchant | `merchants.create` | |
| Edit | `merchants.update` | |
| Deactivate | `merchants.delete` | holds no machines |
| Add subscription | `merchants.update` | |
| Collect subscription | `finance.create` | |
| Subscription amounts | `finance.read` | |
| Branch filter | `merchants.read.all` | |

### Maintenance / decommission
| Control | Permission | Extra condition |
|---|---|---|
| New order | `maintenance.create` | machine not already in maintenance |
| Edit order | `maintenance.update` | not `CLOSED` |
| Send / receive | `maintenance.update` | status `OPEN` / `IN_PROGRESS` |
| Close order | `maintenance.close` | status `RETURNED` |
| Set / view cost | `maintenance.set_cost` (edit), `finance.read` (view) | |
| Cancel order | `maintenance.update` | `OPEN` or `IN_PROGRESS` |
| Decommission candidates | `machines.decommission` | |

### Violations
| Control | Permission | Extra condition |
|---|---|---|
| New violation | `violations.create` | |
| Edit | `violations.create` | manual source only |
| Acknowledge | — | caller is the subject, status `OPEN` |
| Charge | `violations.resolve` | not already charged |
| Waive | `violations.waive` | not already charged |
| Amounts | `finance.read` | |
| Branch filter | `violations.read.all` | |

### Finance
| Control | Permission | Extra condition |
|---|---|---|
| Finance section at all | `finance.read` | |
| New transaction | `finance.create` | |
| Edit transaction | `finance.update` | source `MANUAL`, not voided |
| Void | `finance.void` | not already voided |
| Category tree editing | `finance.categories.manage` | not a system category |
| Budgets | `finance.budgets.manage` | |
| Export | `reports.export` | |
| All-branches | `finance.read.all` | |

### Users, roles, admin
| Control | Permission | Extra condition |
|---|---|---|
| New user | `users.create` | |
| Edit user | `users.update` | |
| Reset password | `users.update` | |
| Activate / deactivate | `users.deactivate` | no custody; not the last director |
| Edit user overrides | `roles.manage` | **not the caller themselves** |
| Role matrix | `roles.manage` | not a system role |
| Branches / warehouses | `branches.manage` | |
| Lookups / system settings | `settings.manage` | |
| Audit log | `audit.read` | |

## Money: the cross-feature rule

`finance.read` gates **every monetary value anywhere in the product**, not just the finance
section. A supervisor without it can manage machines and maintenance but must never see:

- machine `purchasePrice`, `totalRepairCost`, `costVsPricePercent`, or the cost card
- the maintenance order `cost` column, cost field or close-dialog cost
- violation `amount` on the list, detail or user summary
- merchant subscription amounts and collections
- any finance figure on the dashboard
- cost columns in any report

Implement this as a single `<Money>` behaviour, not as thirty scattered checks: `<Money>` renders
`——` with a tooltip when the session lacks `finance.read`. Then audit every list column definition
against the bullet list above, because a column header that says "Cost" over a row of dashes still
leaks that a cost exists — hide the **column**, not just the value.

**This is the most likely permission bug in the app.** It gets its own E2E test (`25`).

## Branch scoping

`*.read.all` permissions control cross-branch visibility. Without one:

- the backend scopes the list automatically;
- the branch filter is **not rendered**, and `branchId` is **never sent** — the global validation
  pipe rejects it with a 400 (`01`);
- the topbar branch switcher does not appear.

A `BRANCH_SCOPE_VIOLATION` or an out-of-scope 404 reaching the UI means a gate is missing. Handle
it (`05`) and treat its appearance as a bug to fix, not a state to design around.

## Role sanity checks

Walk these before calling the app done. Each should produce a coherent, complete experience:

| Role | Sees | Must not see |
|---|---|---|
| `DIRECTOR` | everything | — |
| `BRANCH_SUPERVISOR` | machines, transfers, merchants, maintenance, violations, branch reports, users (read) | finance section, any amount, roles, lookups, audit |
| `REPRESENTATIVE` | own custody, own transfers, own merchants, own violations | other reps' data, finance, admin |
| `ACCOUNTANT` | finance in full, finance reports, machines (read) | transfers, users, admin |
| `VIEWER` | read-only lists | every create/edit/delete control |
