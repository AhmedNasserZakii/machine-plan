# 17 — Feature: Reports

Mobile counterpart: `mobile-app/lib/feature/reports/` (hub, viewer, exports). On mobile a report is
something you glance at. On the web it is something you work in — this is the second-biggest reason
the web app exists, after bulk import.

## The nineteen endpoints

| Report | Endpoint | Permission |
|---|---|---|
| Catalogue | `reports` | any of `ANY_REPORT` |
| Machine inventory | `reports/machines/inventory` | `reports.machines` |
| Machine custody | `reports/machines/custody` | `reports.machines` |
| Machine costs | `reports/machines/costs` | `reports.machines` |
| Idle machines | `reports/machines/idle` | `reports.machines` |
| Warranty | `reports/machines/warranty` | `reports.machines` |
| Machine lifecycle | `reports/machines/{id}/lifecycle` | `reports.machines` |
| Transfers | `reports/transfers` | `reports.transfers` |
| Pending transfers | `reports/transfers/pending` | `reports.transfers` |
| Maintenance | `reports/maintenance` | `maintenance.read` |
| Violations | `reports/violations` | `reports.violations` |
| Merchants | `reports/merchants` | `merchants.read` |
| Representatives | `reports/representatives` | `users.read` |
| Branch comparison | `reports/branches/comparison` | `reports.machines` |
| Expenses | `reports/finance/expenses` | `reports.finance` |
| Income | `reports/finance/income` | `reports.finance` |
| P&L | `reports/finance/pnl` | `reports.finance` |
| Budgets | `reports/finance/budgets` | `reports.finance` |
| Export job status | `reports/jobs/{id}` | `reports.export` |

`GET reports` returns the catalogue the caller may run. **Build the hub from that response**, not
from a hardcoded list — same reasoning as `transfers/creatable-types` in `12`.

## `/reports` — hub

Cards grouped by domain (machines, transfers, maintenance, violations, people, finance), each with
a title, one-line description, and a "last run" hint from `localStorage`. Permission-filtered; an
empty group renders nothing.

Pinned reports (`localStorage`) surface at the top. An operations manager runs the same three
reports every morning.

## `/reports/[slug]` — viewer

One generic viewer configured per report, not nineteen bespoke pages:

```ts
type ReportConfig = {
  slug: string;
  endpoint: string;
  permission: string | string[];
  filters: FilterDef[];                // rendered by FilterBar
  view: 'table' | 'chart' | 'split';
  columns?: ColumnDef[];
  chart?: ChartDef;
  groupBy?: string[];                  // e.g. representative|supervisor|branch|merchant|status|model
  exportFormats: ('csv'|'xlsx'|'pdf')[];
};
```

Layout: header (title, description, permission-gated export menu) · filter bar (URL-driven) ·
result area · footer (row count, generated-at, active filter summary — the last one so a printed
report says what it was filtered by).

**Group-by** where the endpoint supports it (`representative`, `supervisor`, `branch`, `merchant`,
`status`, `model`): grouped tables with collapsible sections and subtotals. This is a desktop-only
capability and it is what people actually ask reports for.

**Drill-down**: every row links into its source record (a machine row → the machine detail,
carrying the report's date range as filters where relevant). A report that dead-ends is half a tool.

**Comparison mode** (web-only): two date ranges side by side with deltas, for the finance and
branch-comparison reports. Cheap to build on top of the same query, disproportionately useful.

## Export

`format` is `json | csv | xlsx | pdf`. `json` feeds the on-screen view; the rest download.

- Small exports stream straight back.
- Large ones return `202` + a job id → poll `reports/jobs/{id}` per `07`, tracked in the **Exports
  panel** so the user can navigate away and come back to a download link.
- Rate limit is 10 exports/hour per user; show the remaining count and handle 429 with the
  `Retry-After` countdown rather than a bare failure.
- `/reports/exports` lists recent jobs with status, size and a download link.

## Printing

Every report viewer prints properly (`03`): the header becomes a title block with the active
filters and the generated-at timestamp, the sidebar and controls disappear, `<thead>` repeats,
and charts render at print resolution. Directors print these for meetings. Test it.

## Charts

Per `08` and the `dataviz` rules: token palette, RTL-aware axes, an accessible table fallback,
compact currency axes with full values in tooltips, no pie chart beyond five slices.

## Acceptance

- [ ] The hub is built from `GET reports`, permission-filtered.
- [ ] One generic viewer serves all reports; adding a report is a config entry.
- [ ] Filters, group-by and date range are in the URL and shareable.
- [ ] Every row drills into its source record.
- [ ] 202 exports poll correctly and survive navigation.
- [ ] Export honours the on-screen filters exactly.
- [ ] Print output is correct in `ar` and `en`.
