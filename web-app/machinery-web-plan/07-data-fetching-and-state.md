# 07 — Data Fetching & State

> The counterpart of the Cubit layer. Same responsibilities, different mechanism: TanStack Query
> owns server state, React owns the rest, and nothing else owns anything.

## The split

| State | Lives in | Example |
|---|---|---|
| Server data | TanStack Query | machines list, transfer detail, `/auth/me` |
| URL state | the query string, via `useUrlFilters` | page, sort, filters, active tab |
| Form state | react-hook-form | a machine form in progress |
| Ephemeral UI | `useState` | a dialog being open |
| Cross-route UI | one React context | sidebar collapsed, table density |

If a piece of state fits a row above, it does not go anywhere else. There is no Redux and no
client store mirroring server data — a mirror is where staleness bugs live.

## Query client

```ts
// src/lib/query/query-client.ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,   // a supervisor leaves a tab open all day
      retry: (failureCount, error) =>
        error instanceof ApiError && (error.status >= 500 || error.status === 0)
          ? failureCount < 2 : false,
    },
    mutations: { retry: false },    // never auto-retry a write (05)
  },
});
```

`retry: false` on 4xx matters: retrying a 403 or a 422 accomplishes nothing and triples the log noise.

## Query keys

One factory per feature. **No inline array literals anywhere.**

```ts
// features/machines/hooks/query-keys.ts
export const machineKeys = {
  all:     ['machines'] as const,
  lists:   () => [...machineKeys.all, 'list'] as const,
  list:    (p: MachinesQuery) => [...machineKeys.lists(), p] as const,
  details: () => [...machineKeys.all, 'detail'] as const,
  detail:  (id: string) => [...machineKeys.details(), id] as const,
  timeline:(id: string) => [...machineKeys.detail(id), 'timeline'] as const,
  costs:   (id: string) => [...machineKeys.detail(id), 'costs'] as const,
  chain:   (id: string) => [...machineKeys.detail(id), 'chain'] as const,
};
```

The hierarchy is what makes invalidation precise: `invalidateQueries({ queryKey: machineKeys.lists() })`
refreshes every machine list without touching a detail page the user is reading.

## The list hook pattern

Every list screen uses the same shape:

```ts
export function useMachinesQuery(params: MachinesQuery) {
  return useQuery({
    queryKey: machineKeys.list(params),
    queryFn: () => machinesApi.list(params),
    placeholderData: keepPreviousData,   // page 2 does not blank the table
  });
}
```

`keepPreviousData` on every paginated list. Without it, paging flashes an empty table and the
page height jumps — the most noticeable quality difference between a good and a bad admin UI.

## URL as state

```ts
// src/lib/query/url-state.ts
export function useUrlFilters<S extends z.ZodTypeAny>(schema: S) {
  // parses searchParams through the zod schema (defaults + coercion),
  // returns [values, setValues, reset]
  // setValues uses router.replace with scroll: false
  // any change to a filter resets page to 1 — ALWAYS
}
```

Rules:

- Changing any filter resets `page` to 1. Forgetting this leaves a user on page 7 of a 2-page
  result staring at an empty table, and it is the most common bug in this kind of screen.
- Filters are debounced **in the URL write**, not in the fetch — 300ms for text, immediate for
  selects.
- Defaults are not written to the URL. `?page=1&limit=20&sortDir=desc` on a fresh load is noise;
  the schema supplies them.
- The parsed object is the query key, so back/forward navigation hits the cache and is instant.

This is what makes "send me the link to those 40 idle machines in Alexandria" work, which is a
thing that happens every day and which the mobile app cannot do at all.

## Mutations

```ts
export function useConfirmTransferMutation(id: string) {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: (body) => transfersApi.confirm(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transferKeys.detail(id) });
      qc.invalidateQueries({ queryKey: transferKeys.lists() });
      qc.invalidateQueries({ queryKey: machineKeys.all });     // custody moved
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
```

`useIdempotentMutation` wraps `useMutation` and owns the idempotency key lifecycle from `05`:
generates one per intent, holds it across retries, clears it on success or on a payload change.
Feature code never touches the key.

**Declare every affected key.** A confirmed transfer changes the transfer, both transfer lists,
machine custody, the dashboard counters and the notification badge. Missing one produces a stale
number that the user will believe. When in doubt, invalidate the broader key — a redundant refetch
is cheap; a wrong count in front of a Director is not.

## Optimistic updates — where, and where not

Allowed only where the server cannot plausibly refuse and the value is cosmetic:

- marking a notification read
- toggling a saved-view / preference

**Never** optimistic for: transfer confirm/reject/cancel, maintenance state changes, finance
writes, decommission, permission edits. These can fail on business rules (422) and an optimistic
UI that then rolls back tells the user their custody changed when it did not. Show a pending
state and wait for the server.

## Cross-feature invalidation map

Keep this table accurate — it is the thing most likely to rot.

| Mutation | Invalidates |
|---|---|
| create/update machine | `machineKeys.all`, `['dashboard']` |
| bulk import machines | `machineKeys.all`, `['dashboard']` |
| create transfer | `transferKeys.all`, `machineKeys.all`, `['dashboard']`, `['notifications']` |
| confirm/reject/cancel transfer | as above |
| create/close maintenance order | `maintenanceKeys.all`, `machineKeys.all`, `financeKeys.all` (auto-transaction), `['dashboard']` |
| replace machine | `machineKeys.all`, `['replacements']`, `['dashboard']` |
| decommission / revert | `machineKeys.all`, `['decommissions']`, `['dashboard']` |
| charge/waive violation | `violationKeys.all`, `financeKeys.all` (auto-transaction), `userKeys.detail(userId)` |
| create/void finance transaction | `financeKeys.all`, `['budgets','status']`, `['dashboard']` |
| category create/update/move/delete | `['finance','categories']`, `financeKeys.lists()` |
| budget create/update/delete | `['budgets']`, `['budgets','status']`, `['dashboard']` |
| collect subscription | `['merchants', merchantId]`, `financeKeys.all` |
| user permissions / role permissions | `userKeys.detail(id)`, `['roles']`, and `['session']` **if the target is the caller** |
| deactivate user / branch | the matching list + detail |

The maintenance→finance and violation→finance edges are easy to miss: the backend creates an
`AUTO_MAINTENANCE` / `AUTO_VIOLATION` transaction as a side effect, so the finance screens are
stale until invalidated.

## Prefetching

- Hovering a table row for 150ms prefetches its detail query. Detail pages then open instantly,
  which is the single cheapest perceived-performance win in a table-heavy app.
- The `(app)` layout prefetches `/auth/me`, `notifications/unread-count`, and the branch list for
  `*.read.all` holders.
- Do not prefetch report endpoints — they are expensive server-side.

## Polling and freshness

| Data | Behaviour |
|---|---|
| `notifications/unread-count` | `refetchInterval: 60_000` and on window focus |
| `transfers/pending/incoming` | `refetchInterval: 60_000` while the transfers screen is open |
| dashboard counters | refetch on focus only |
| everything else | on focus and after invalidation |

No websockets. The backend does not expose one, and a minute of latency on a counter is fine for
this product. Do not add polling anywhere not listed here without a reason written down.

## Report exports (202 Accepted)

Export endpoints return `202` with a job id; `GET /reports/jobs/{id}` is polled until done.

```ts
useQuery({
  queryKey: ['reports', 'job', jobId],
  queryFn: () => reportsApi.job(jobId),
  refetchInterval: (q) => q.state.data?.status === 'DONE' ||
                          q.state.data?.status === 'FAILED' ? false : 2_000,
});
```

The job is tracked in an **Exports** panel that survives navigation, so a user can start a large
export, go do something else, and come back to a download link. Cap the poll at 5 minutes and then
tell the user to check the exports page — do not poll forever on a tab someone left open overnight.

## Error boundaries

- A route-level boundary (`error.tsx`) per feature segment, so a broken machines page does not
  blank the whole shell.
- A global boundary in the root layout as the backstop; it shows the `requestId` and a reload
  action.
- `useQuery` errors render inline `ErrorState`, they do not throw to the boundary. Only render
  errors and unexpected exceptions reach a boundary.
