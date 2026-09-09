# 17 — Feature: Reports

## Goal

Everything in the system must be extractable as a report: machines, representatives, merchants,
transfers, violations, maintenance, expenses, income. Each report shares one contract so the mobile
app can render them with a single generic screen.

## Shared contract

Every report endpoint accepts:

```
?dateFrom= &dateTo= &branchId= &groupBy= &page= &limit= &sortBy= &sortDir= &format=
```

`format`: `json` (default) | `xlsx` | `csv` | `pdf`.
Non-JSON formats are produced by a BullMQ job and return `202 Accepted`:

```json
{ "jobId":"…", "status":"QUEUED", "pollUrl":"/api/v1/reports/jobs/…" }
```

Polling returns `{ "status":"READY", "downloadUrl":"…", "expiresAt":"…" }` (signed URL, 24h TTL).
Small JSON reports return synchronously.

## Report catalogue

| Key | Endpoint | Permission | Answers |
|---|---|---|---|
| machine-inventory | `/reports/machines/inventory` | `reports.machines` | Every machine, where it is, who holds it |
| machine-custody | `/reports/machines/custody` | `reports.machines` | Grouped by holder — "who has what" |
| machine-idle | `/reports/machines/idle` | `reports.machines` | Machines with no movement in N days |
| machine-lifecycle | `/reports/machines/:id/lifecycle` | `reports.machines` | Full printable history of one machine |
| machine-costs | `/reports/machines/costs` | `reports.machines` | Purchase vs cumulative repair, chain-aware |
| warranty-expiry | `/reports/machines/warranty` | `reports.machines` | Expiring within N days |
| transfers-log | `/reports/transfers` | `reports.transfers` | Every hand-off in a period |
| transfers-pending | `/reports/transfers/pending` | `reports.transfers` | Stuck, unconfirmed hand-offs |
| representative-performance | `/reports/representatives` | `reports.violations` | Per-rep: custody, placements, violations |
| violations-register | `/reports/violations` | `reports.violations` | All violations, filterable |
| merchant-portfolio | `/reports/merchants` | `merchants.read` | Merchants, machine counts, subscription status |
| maintenance-log | `/reports/maintenance` | `maintenance.read` | Orders, costs, locations, outcomes |
| expenses-by-category | `/reports/finance/expenses` | `reports.finance` | The nested category breakdown |
| income-by-category | `/reports/finance/income` | `reports.finance` | Same for income |
| profit-loss | `/reports/finance/pnl` | `reports.finance` | Income − expense, by period and branch |
| budget-performance | `/reports/finance/budgets` | `reports.finance` | Budget vs actual |
| branch-comparison | `/reports/branches/comparison` | `reports.finance` | Branches side by side |

## Selected shapes

### `/reports/machines/custody?groupBy=representative`

```json
{
  "generatedAt":"2026-09-07T…",
  "filters": { "branchId":"…", "groupBy":"representative" },
  "totals": { "machines": 1000, "holders": 47 },
  "groups": [
    { "holder": { "type":"REPRESENTATIVE", "id":"…", "name":"أحمد سالم" },
      "branch":"فرع الإسكندرية",
      "counts": { "total": 23, "inHand": 4, "withMerchants": 19 },
      "oldestHeldDays": 96,
      "openViolations": 2,
      "machines": [ { "id":"…","serial":"SN-00341","status":"WITH_MERCHANT",
                      "merchantName":"محل النور","since":"2026-04-11" } ] }
  ]
}
```

`groupBy` accepts `representative | supervisor | branch | merchant | status | model`.

### `/reports/representatives`

```json
{
  "period": { "from":"2026-06-01", "to":"2026-08-31" },
  "rows": [
    { "user": { "id":"…","fullName":"أحمد سالم" }, "branch":"فرع الإسكندرية",
      "machinesHeldNow": 23,
      "transfersReceived": 31, "transfersReturned": 14,
      "merchantsRegistered": 9,
      "violations": { "total": 4, "high": 1, "chargedAmount": 850.00 },
      "avgConfirmationDelayHours": 3.4,
      "machinesSentToMaintenance": 5,
      "score": 82 }
  ]
}
```

`score` is a transparent, documented formula — never a black box:
`100 − (highViolations × 10) − (mediumViolations × 5) − (lowViolations × 2) − (lateConfirmations × 1)`,
floored at 0. Publish the formula in the response under `scoreFormula`.

### `/reports/finance/pnl`

```json
{
  "period": { "from":"2026-01-01", "to":"2026-08-31" },
  "granularity":"MONTH",
  "series":[
    { "period":"2026-08", "income": 152300.00, "expense": 93450.00, "net": 58850.00 }
  ],
  "totals": { "income": 1102400.00, "expense": 764300.00, "net": 338100.00 },
  "byBranch":[
    { "branch": { "id":"…","name":"فرع الإسكندرية" },
      "income": 611200.00, "expense": 402100.00, "net": 209100.00 }
  ]
}
```

## Implementation rules

1. **Reports are read-only.** No report endpoint may write anything except a job record.
2. **Never load into memory to aggregate.** Every total comes from SQL `GROUP BY`.
3. **Use keyset pagination** for large lists (`?after=<cursor>`), offset pagination for small ones.
4. Reports respect branch scope and permissions exactly like the underlying modules. A supervisor
   running `machine-inventory` sees his branch only.
5. Voided finance transactions are excluded from all totals, always.
6. Every report response carries `generatedAt` and the exact `filters` used — printed exports must
   show them in the header so a PDF on someone's desk is self-describing.
7. Cache expensive aggregates in Redis for 5 minutes keyed by
   `report:{key}:{hash(filters)}:{userId}`. Invalidate nothing — 5 minutes of staleness on a report
   is acceptable and simpler than surgical invalidation.

## Export formatting

- **xlsx** via `exceljs`: one sheet per group, frozen header row, RTL sheet direction when the
  request locale is `ar`, numbers formatted as `#,##0.00`, dates as `yyyy-mm-dd`.
- **pdf** via a headless-Chromium HTML template with an Arabic-capable font (Cairo / Noto Naskh
  Arabic) embedded — do **not** rely on system fonts in the container.
- **csv** UTF-8 with BOM so Excel opens Arabic correctly.
