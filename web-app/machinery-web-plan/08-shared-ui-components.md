# 08 — Shared UI Components

> Build these **before** the first feature. Every feature file from `09` on assumes they exist.
> Roughly 70% of the app's surface is these components with different columns and different props.

## `DataTable` — the most important component in the product

Headless TanStack Table v8 underneath; layout, tokens and behaviour owned by us.

```tsx
<DataTable
  columns={machineColumns}
  data={data?.items ?? []}
  meta={data?.meta}                      // PageMeta | CursorMeta → picks the pager
  state={filters}                        // from useUrlFilters — URL is the source of truth
  onStateChange={setFilters}
  isLoading={isLoading}
  isFetching={isFetching}
  error={error}
  emptyState={<MachinesEmpty filtered={hasActiveFilters} />}
  rowHref={(row) => `/machines/${row.id}`}
  onRowPrefetch={(row) => prefetchMachine(row.id)}
  selection={{ enabled: can(P.machinesUpdate), bulkActions: machineBulkActions }}
  columnVisibility={{ storageKey: 'machines.columns' }}
  density
  sticky={{ header: true, firstColumn: true }}
/>
```

Requirements, all of them non-optional:

1. **Semantic HTML.** Real `<table>`, `<th scope="col">`, `<caption class="sr-only">`. Not divs
   with `role=`. Screen readers and `Ctrl+F` both depend on it, and so does printing.
2. **Sorting** only on columns the endpoint whitelists (`05`). A non-sortable header is not a
   button. Sort state is in the URL.
3. **Pagination** reads `meta`: numbered pager for `PageMeta`, "load more" for `CursorMeta`.
   Shows "1–20 of 143" localized, with a `limit` selector (20/50/100 — 100 is the backend max).
4. **Selection** with a header checkbox, shift-click ranges, a persistent "N selected" bar
   carrying bulk actions. Selection clears on any filter or page change — a bulk action must never
   operate on rows the user can no longer see.
5. **Column visibility** with a chooser, persisted per table in `localStorage`. Identifier columns
   cannot be hidden.
6. **Density** toggle (`03`), also persisted.
7. **Sticky** header and first column. The first column is the identifier (serial, reference no,
   name) and sticks to the **inline-start** edge, which flips in RTL.
8. **Row click** navigates via `rowHref` as a real `<a>` — middle-click and Ctrl+click must open a
   new tab. Never an `onClick` handler on a `<tr>`.
9. **Four states** (`01`, rule 9). The skeleton renders the real column count and row height, so
   nothing shifts when data lands.
10. **`isFetching` vs `isLoading`** — a background refetch shows a thin top progress bar and keeps
    the old rows. It must not blank the table.
11. **Horizontal scroll** on narrow viewports with the sticky first column; never a squashed
    unreadable grid.
12. **Print**: `print.css` drops sticky/scroll, repeats `<thead>`, hides selection and actions.

## Filter bar

```tsx
<FilterBar state={filters} onChange={setFilters} onReset={reset}>
  <SearchFilter    name="search" placeholder={t('machines.search_hint')} dir="auto" />
  <SelectFilter    name="status" options={machineStatusOptions} multiple />
  <BranchFilter    name="branchId" />           {/* only for *.read.all holders */}
  <LookupFilter    name="machineModelId" endpoint={endpoints.lookups.machineModels} />
  <DateRangeFilter from="dateFrom" to="dateTo" />
</FilterBar>
```

- Active filters render as removable chips above the table with a "clear all".
- The search box takes either Arabic text or a serial, so `dir="auto"`.
- Multi-select filters serialize as repeated query keys (`05`).
- `BranchFilter` renders only when the user holds the relevant `*.read.all` permission — for a
  branch-scoped user the backend already scopes the list, and sending `branchId` would 400.
- **Saved views** (web-only): name the current query string and pin it to the sidebar, stored in
  `localStorage`. Cheap to build, and it is what turns a filter bar into a daily tool.

## Form kit

react-hook-form + zod, wrapped so that field-level server errors land automatically.

```tsx
<AppForm schema={machineFormSchema} defaultValues={…} onSubmit={mutate}>
  <FormSection title={t('machines.identity')}>
    <TextField     name="serial" required dir="ltr" mono />
    <TextField     name="batterySerial" dir="ltr" mono />
    <TextField     name="simSerial" dir="ltr" mono showIf={(v) => v.requiresSim} />
    <SelectField   name="machineModelId" options={models} searchable />
    <DateField     name="purchaseDate" maxDate={today} />
    <MoneyField    name="purchasePrice" currency="EGP" />
    <TextAreaField name="notes" maxLength={500} />
  </FormSection>
  <FormActions submitLabel={t('shared.save')} />
</AppForm>
```

Rules:

- Every serial / phone / money input is `dir="ltr"` with `.t-mono`, in both locales.
- `MoneyField` never uses a raw `type="number"` — it formats with separators, parses on blur, and
  rejects a locale-dependent decimal separator ambiguity.
- `DateField` sends `yyyy-MM-dd`, displays `dd/MM/yyyy`, and its calendar respects `dir`.
- `SelectField` with `searchable` is an async combobox for anything that could exceed ~50 options
  (machines, merchants, users, categories) — it hits the endpoint's `search` param, debounced.
- **Server validation** (`05`): `details[].field` maps directly onto RHF field names, including
  indexed paths like `items[0].machineId`. `AppForm` does this mapping; no feature writes it.
- **Dirty guard**: navigating away from a dirty form asks for confirmation. Not optional —
  the machine and transaction forms are long.
- Submit is disabled while pending and shows a spinner in place of the label. The idempotency key
  makes a double-submit safe anyway, but the user should not be able to fire one.

## Status and value primitives

| Component | Notes |
|---|---|
| `<StatusChip status tone icon label />` | icon + label + tone, never colour alone (`03`) |
| `<SerialText value />` | `<bdi dir="ltr" class="t-mono">` + click-to-copy |
| `<Money value currency />` | `.t-mono`, negatives in `text-danger` with a real minus |
| `<DateText value format="date"\|"datetime"\|"relative" />` | locale-aware, `title` = full ISO |
| `<PhoneText value />` | LTR, `tel:` link |
| `<UserChip user />` | avatar initial + name + role |
| `<BranchChip branch />` | |
| `<HolderChip type id name />` | the custody holder, with a type icon |
| `<PermissionBadge code />` | localized permission label from `GET /permissions` |

## Feedback

- `<PageHeader title subtitle breadcrumbs actions />` — one per page, actions permission-gated.
- `<EmptyState icon title description action />` — filtered-empty and truly-empty are different
  copy (`04`).
- `<ErrorState error onRetry />` — shows the localized message and the copyable `requestId`.
- `<Skeleton>` variants matching each layout: table, detail header, card grid, chart.
- `<ConfirmDialog>` — destructive actions require typing a confirmation for the irreversible ones
  (decommission, void transaction, deactivate user). Everything else is a plain confirm.
- Toasts: success and transient errors only. **Never** for 403 or a validation error (`05`).
- `<OfflineBanner>` — `navigator.onLine === false`; disables mutation controls (`01`).

## Detail page layout

Every detail page uses the same scaffold, so machines, transfers, merchants, users and violations
are structurally identical:

```
PageHeader (breadcrumbs, title, status chip, primary actions)
┌───────────────────────────────┬──────────────────────┐
│ Tabs: overview | related | …  │  Summary rail        │
│ Tab content                   │  key facts, meta,    │
│                               │  quick actions       │
└───────────────────────────────┴──────────────────────┘
```

Tabs are in the URL (`?tab=timeline`) so a tab is linkable and survives refresh.
Below `1024px` the rail collapses above the tabs.

## Charts

Recharts, following the `dataviz` skill's rules. Non-negotiables:

- Categorical colours come from the token palette; never Recharts defaults.
- Every chart has an accessible table fallback (`<details>` with the underlying numbers) — a
  Director will want to copy a figure out of it.
- Axes flip in RTL (`03`); wrap once in `components/charts/`, not per chart.
- Currency axes use compact notation (`12.5K`) with full values in the tooltip.
- No pie chart with more than five slices. Use a bar chart.
- Chart containers have an explicit height; `ResponsiveContainer` inside a flex parent with no
  height renders nothing, which is the classic bug here.

## App shell

- **Sidebar** — permission-built from `nav-items.ts` (`06`), collapsible to icons, state persisted,
  grouped headings, active-route highlight, badge slot on Transfers and Notifications.
- **Topbar** — breadcrumbs, global search (`Ctrl/Cmd+K`), branch switcher (`*.read.all` only),
  locale switcher, notifications bell, user menu.
- **Command palette** (`Ctrl/Cmd+K`) — jump to any route the user may access, plus a direct
  serial lookup that hits `machines/lookup` and navigates straight to the machine. This is the
  web's answer to the QR scanner and it is faster than one, for a user at a desk.
- Skip-to-content link, `<main id="content">`, focus moved to the heading on route change.

## Keyboard

| Key | Action |
|---|---|
| `Ctrl/Cmd+K` | command palette |
| `/` | focus the filter bar's search |
| `Esc` | close dialog / clear search |
| `j` / `k` | move row focus in a table |
| `Enter` | open the focused row |
| `Ctrl/Cmd+Enter` | submit the focused form |
| `?` | shortcut help |

Worth the day it costs: an accountant entering thirty transactions uses the keyboard for all of them.
