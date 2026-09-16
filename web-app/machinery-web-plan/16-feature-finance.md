# 16 — Feature: Finance

Mobile counterpart: `mobile-app/lib/feature/finance/` (8 screens). The most gated feature in the
product: the Director hands out finance permissions individually, and `finance.read` alone is
already a meaningful grant.

## Endpoints

| Method | Path | Screen |
|---|---|---|
| GET | `finance/summary` | overview |
| GET | `finance/by-category` | overview breakdown |
| GET/POST | `finance/transactions` | transactions list / create |
| GET/PATCH | `finance/transactions/{id}` | detail / edit |
| POST | `finance/transactions/{id}/void` | void |
| GET | `finance/export` | export |
| GET/POST | `finance/categories` | categories |
| GET | `finance/categories/tree` | tree editor |
| GET/PATCH/DELETE | `finance/categories/{id}` | category CRUD |
| GET | `finance/categories/{id}/breadcrumb` | path display |
| PATCH | `finance/categories/{id}/move` | reparent |
| GET/POST | `finance/budgets` | budgets |
| GET | `finance/budgets/status` | budget alerts |
| GET/PATCH/DELETE | `finance/budgets/{id}` | budget CRUD |
| GET/POST | `payment-methods` | lookup (`19`) |

Transaction sources: `MANUAL`, `AUTO_MAINTENANCE`, `AUTO_VIOLATION`, `AUTO_SUBSCRIPTION`.

## `/finance` — overview

Permission `finance.read`. A user without it never sees the sidebar group, the route, or any
amount anywhere else in the app — check that money is not leaking through a machine's cost card or
a maintenance order's cost column for such a user. That cross-feature leak is the single most
likely permission bug in this product, and `21` lists every place an amount appears.

Blocks: period selector (this month / last month / quarter / year / custom, in the URL) ·
income vs expense totals with period-over-period delta · net · a stacked bar of income/expense by
month · `finance/by-category` as a horizontal bar, drill-down on click · budget status cards
(`finance/budgets/status`) · recent transactions.

## `/finance/transactions`

Columns: date (sticky) · category (with breadcrumb path) · kind (income/expense) · amount
(`<Money>`, income `text-success`, expense `text-danger`) · payment method · source badge ·
reference (machine / merchant / violation link) · created by · voided marker.
Sortable: `transactionDate`, `amount`, `createdAt`.
Filters: kind · categoryId (tree picker, includes descendants) · date range · source · payment
method · min/max amount · branchId (`finance.read.all` only) · `includeVoided` (default off).

Footer row shows the **total of the current filtered set**, not just the current page — the number
an accountant is actually looking for. Take it from the response `meta` where available; otherwise
state plainly that it is the page total.

Actions: New transaction (`finance.create`) · Export (`finance/export`, `reports.export`).

## Transaction form

Fields: kind (income/expense — drives the category list) · category (tree picker, leaf only) ·
amount · date · payment method · description · attachments · optional links to machine / merchant /
maintenance order.

Rules with dedicated error handling:

| Code | Handling |
|---|---|
| `CATEGORY_KIND_MISMATCH` | the category tree is filtered by kind; if it still fires, refresh the tree |
| `FUTURE_DATE_NOT_ALLOWED` | date picker's max is today |
| `BACKDATE_LIMIT_EXCEEDED` | the picker's min comes from `settings`; show the limit in the hint text |
| `AUTO_TRANSACTION_IMMUTABLE` | auto-sourced transactions are read-only; no Edit button, and the detail page explains where the transaction came from with a link |

## `/finance/transactions/[id]`

Read-only detail with the full audit trail, the linked entity, attachments, and — for auto
transactions — a prominent link to the maintenance order, violation or subscription that created it.

**Void** (`finance.void`) is the only correction mechanism; there is no delete. The dialog requires
a reason, states that the transaction stays visible as voided, and is irreversible.
`TRANSACTION_ALREADY_VOIDED` → refresh.

## `/finance/categories` — tree editor (web-only strength)

`finance/categories/tree`. Two panes: the tree on the inline-start, the selected category's detail
and children on the other side.

- Expand/collapse, keyboard navigable, search-with-highlight.
- **Drag to reparent** → `PATCH finance/categories/{id}/move`. Optimistic is tempting here and
  still not allowed: the server rejects cycles (`CIRCULAR_CATEGORY_REFERENCE`) and a snapped-back
  tree confuses more than a brief spinner.
- Create / rename / delete inline.
- System categories are locked with a badge (`SYSTEM_CATEGORY_PROTECTED`).
- Delete refuses with `CATEGORY_HAS_CHILDREN` or `CATEGORY_HAS_TRANSACTIONS`; the dialog says
  which and offers "show the transactions" or "move the children first".
- Each category shows its transaction count and period total, which is what makes the tree useful
  rather than just structural.

A category tree is genuinely painful on a phone. This screen is one of the clearest wins of the
web app; give it the time.

## `/finance/budgets`

List: category · period (`DAY`/`WEEK`/`MONTH`/`YEAR`) · date range · limit · spent · remaining ·
a progress bar toned by `BUDGET_TONE` · alert threshold.

Form: category (expense only — `BUDGET_ON_INCOME_CATEGORY`), period, range, amount, alert
threshold %. `OVERLAPPING_BUDGET` maps to the date fields and names the conflicting budget.

`finance/budgets/status` drives dashboard alerts and the sidebar badge.

## Export

`GET finance/export` with the **current filters** — the export must match what the user is
looking at, or it is worse than useless. Formats `csv` / `xlsx` / `pdf`. If it returns `202`, it
goes through the export job flow in `07`.

## Acceptance

- [ ] A user without `finance.read` sees no amount anywhere in the app (verify against `21`).
- [ ] Income and expense are visually distinct beyond colour.
- [ ] Auto transactions are read-only with a link to their origin.
- [ ] Void requires a reason and is irreversible; there is no delete.
- [ ] The category tree handles reparenting, cycle rejection, and both delete refusals.
- [ ] Budget overlap maps to the date fields.
- [ ] Export carries the active filters.
- [ ] Amounts are `.t-mono` tabular and LTR in both locales.
