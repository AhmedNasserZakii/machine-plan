# 10 — Feature: Dashboard

Mobile counterpart: `feature/home/presentation/pages/home_dashboard_screen.dart`.

The landing page. **Every tile is permission-gated** and the whole page composes existing
endpoints — there is no dashboard endpoint and one is not being added (`01`).

## Composition

| Block | Source | Permission |
|---|---|---|
| Greeting + role + branch | `auth/me` | — |
| **Pending incoming transfers** | `transfers/pending/incoming` | `transfers.read` |
| **Pending outgoing transfers** | `transfers/pending/outgoing` | `transfers.read` |
| Machines by status | `reports/machines/inventory` | `machines.read` |
| My custody | `users/{me}/custody` | `machines.read` |
| Open maintenance orders | `maintenance-orders?status=OPEN&limit=5` | `maintenance.read` |
| Open violations | `violations?status=OPEN&limit=5` | `violations.read` |
| Month income vs expense | `finance/summary` | `finance.read` |
| Budget alerts | `finance/budgets/status` | `finance.budgets.manage` |
| Warranty expiring ≤30d | `reports/machines/warranty` | `reports.machines` |
| Idle machines | `reports/machines/idle` | `reports.machines` |
| Decommission candidates | `machines/decommission-candidates` | `machines.decommission` |
| Recent activity | `audit-logs?limit=10` | `audit.read` |

Fetch each block in its own query so one slow or failing block degrades alone. A 403 on a block
renders nothing (the gate should have prevented the call — log it as a gating bug).

## Layout

Responsive grid, `--content-max-width`. Order by urgency, because these users open this page to
find out what needs them today:

1. **Action required** — pending incoming transfers first. This is the top-left (top-right in
   Arabic) tile and it is the reason the dashboard exists. Each row: reference no, from party,
   machine count, age. Confirm/reject inline without leaving the page.
2. **Alerts** — budgets exceeded, overdue subscriptions, stuck transfers, warranty expiries.
3. **Overview** — status distribution chart, custody count, month finance summary.
4. **Recent activity** — audit feed.

Every tile has a "view all" link to its filtered list route, carrying the same filters in the
query string. A tile that shows a number the user cannot drill into is a dead end.

## Rules

- Skeletons per tile, never one page-wide spinner.
- Empty state per tile: "no pending transfers" is good news and should look like it (success tone,
  not a sad empty illustration).
- Counters are **links**, not plain text.
- Refetch on window focus; no polling beyond the two listed in `07`.
- A user with a minimal permission set (a viewer) must still get a coherent page, not three
  empty boxes. Collapse to a welcome card plus whatever they can see.

## Acceptance

- [ ] Every tile gated; a representative, an accountant and a director each get a sensible page.
- [ ] One failing block does not break the page.
- [ ] Every counter links to the correspondingly-filtered list.
- [ ] Verified in `ar` and `en`.
