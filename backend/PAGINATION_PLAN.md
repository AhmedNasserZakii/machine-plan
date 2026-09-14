# Pagination Audit & Implementation Plan — all GET endpoints

Audit source: `backend/api/openapi.json` (95 GET operations), cross-checked against the service
methods that back each route. Status as of 2026-09-15.

**Scope: backend *and* mobile app.** §§1-4 and 6 are backend; **§5 is the Flutter work**, and §5.2
is a blocker that must ship before two of the backend changes.

**Headline:** 36 of 95 GET endpoints paginate (32 offset, 4 keyset). Of the remaining 59, **42 are
correctly unpaginated** (single resources, aggregates, fixed catalogues, one tree) and **17 return
unbounded or silently-truncated arrays and must be fixed.** On the client, 14 screens already page
correctly, but two reference caches parse bare arrays and would silently truncate.

---

## 0. The existing machinery — reuse it, do not invent a second one

Everything needed already exists. No new primitive should be written for this work.

| Concern | Use | File |
| --- | --- | --- |
| Offset query params (`page`, `limit`, `sortDir`, `locale`) | `PaginationDto` | `src/common/dto/pagination.dto.ts` |
| Offset envelope (`items` + `page/limit/total/totalPages/hasNext`) | `PaginatedResult<T>` | `src/common/dto/paginated-result.ts` |
| Keyset envelope (`items` + `limit/nextCursor/hasNext`) | `CursorResult<T>` | `src/common/dto/paginated-result.ts` |
| Unwrapping into `{ success, data, meta }` | `ResponseInterceptor` — already handles both | `src/common/interceptors/response.interceptor.ts` |
| Limits | `DEFAULT_LIMIT=20`, `MAX_LIMIT=100`, `MAX_BULK_LIMIT=500` | `src/common/dto/pagination.dto.ts` |
| Reference pattern (offset) | `MerchantsController.findAll` → `MerchantsService.findAll` | `src/modules/merchants/merchants.controller.ts:55` |
| Reference pattern (keyset) | `MachinesController.timeline` → `MachineInsightsService.timeline` | `src/modules/machines/machines.controller.ts:141`, `machine-insights.service.ts:139` |

Client side is equally ready:

| Concern | Use | File |
| --- | --- | --- |
| Parse `{ data, meta }` | `PaginatedResponse<T>` | `mobile-app/lib/core/modules/paginated_response.dart` |
| Meta model (incl. `nextCursor`) | `PaginationMetaModel` | `mobile-app/lib/core/network_services/models/pagination_meta_model.dart` |
| Infinite scroll + pull-to-refresh | `PaginatedListView<T>` | `mobile-app/lib/core/shared_widgets/paginated_list_view.dart` |

### Decision rule — which endpoints get pagination

Apply in order; the first match wins.

1. Returns **one object** (a resource by id, a summary, a count, a status) → **no pagination.**
2. Returns a **tree** whose shape is the payload → **no pagination**; bound it with `maxDepth` instead.
3. Returns a **fixed, code-defined catalogue** (permissions, report types, settings keys, transfer
   types, roles) → **no pagination**; add an explicit Swagger note saying the set is bounded by code.
4. Returns a **seeded lookup table** an admin edits by hand (payment methods, violation types,
   maintenance locations, decommission reasons, machine types) → **no pagination**; add a hard
   `.take(MAX_LIMIT)` guard so the route can never be a source of unbounded IO.
5. Returns a list whose length **grows with business volume** and is read **newest-first while rows
   are still being written** (timelines, feeds, audit) → **keyset (`CursorResult`).**
6. Everything else that grows with business volume → **offset (`PaginatedResult` + `PaginationDto`).**

### Non-negotiable rules for every change below

- **Never break a response shape silently.** Adding `page`/`limit` to a route that returned a bare
  array changes `data` from `[...]` to `[...]` plus a new `meta` — that part is backward compatible
  (`PaginatedResponse.fromJson` already accepts both shapes). What is *not* compatible is the
  default page size truncating a client that used to get everything. Every item below names the
  Flutter call site that must be updated **in the same commit**.
- **Every paginated query needs a total-ordering tiebreaker.** `ORDER BY name ASC` alone is not
  stable across pages when names collide; always add `, id ASC`.
- **Keyset cursors are opaque base64.** There are already two private copies of
  `encodeCursor`/`decodeCursor` — `src/modules/audit/audit-logs.service.ts:98` and
  `src/modules/machines/machine-insights.service.ts:537` — which is one copy too many before a
  third consumer arrives. Step 4.1 de-duplicates them first.
- Regenerate `openapi.json` with `npm run docs:generate` after every controller change, and verify
  with `npm run check:openapi` (it fails the build on drift). Keep `backend/api/test/*.e2e-spec.ts`
  in step with each route.

---

## 1. Current state — full inventory

### 1.1 Already paginated, offset (32) — no work

`/decommissions` · `/finance/export` · `/finance/transactions` · `/machines` ·
`/machines/decommission-candidates` · `/maintenance-orders` · `/merchants` · `/notifications` ·
`/replacements` · `/transfers` · `/transfers/pending/incoming` · `/transfers/pending/outgoing` ·
`/users` · `/users/{id}/violations` · `/violations` · and all 17 `/reports/*` list endpoints
(`branches/comparison`, `finance/budgets`, `finance/expenses`, `finance/income`, `finance/pnl`,
`machines/costs`, `machines/custody`, `machines/idle`, `machines/inventory`, `machines/warranty`,
`machines/{id}/lifecycle`, `maintenance`, `merchants`, `representatives`, `transfers`,
`transfers/pending`, `violations`).

### 1.2 Already paginated, keyset (4) — no work

`/audit-logs` · `/audit-logs/entity/{type}/{id}` · `/audit-logs/user/{userId}` ·
`/machines/{id}/timeline`

### 1.3 Correctly unpaginated (42) — document only

| Group | Endpoints | Why no pagination |
| --- | --- | --- |
| Single resource by id (20) | `/auth/me`, `/branches/{id}`, `/finance/budgets/{id}`, `/finance/categories/{id}`, `/finance/categories/{id}/breadcrumb`, `/finance/transactions/{id}`, `/machines/{id}`, `/machines/lookup`, `/machines/by-serial/{serial}`, `/maintenance-orders/{id}`, `/media/{id}`, `/media/blob`, `/merchants/{id}`, `/reports/jobs/{id}`, `/roles/{id}`, `/settings/{key}`, `/transfers/{id}`, `/transfers/{id}/signatures/{signatureId}/media`, `/users/{id}`, `/violations/{id}`, `/warehouses/{id}` | Rule 1 |
| Aggregate / scalar (7) | `/branches/{id}/summary`, `/finance/summary`, `/finance/by-category`, `/machines/{id}/cost-summary`, `/notifications/unread-count`, `/users/{id}/violations/summary`, `/sync/status` | Rule 1 |
| Fixed catalogue (6) | `/permissions`, `/reports`, `/roles`, `/settings`, `/transfers/creatable-types`, `/notification-preferences` | Rule 3 |
| Seeded lookup (5) | `/payment-methods`, `/violation-types`, `/maintenance-locations`, `/decommission-reasons`, `/machine-types` | Rule 4 — needs the safety cap in step 3.1 |
| Tree (1) | `/finance/categories/tree` | Rule 2 |
| Bounded chain (1) | `/machines/{id}/replacement-chain` | A machine has a handful of predecessor serials, capped by `MACHINE_ALREADY_REPLACED` |
| Documented exception (1) | `/sync/bootstrap` | Deliberately whole-database; but its sub-lists need caps — step 4.2 |

### 1.4 Must be fixed (17)

| # | Endpoint | Defect | Target |
| --- | --- | --- | --- |
| 1 | `GET /suppliers` | unbounded `getMany()` | offset |
| 2 | `GET /finance/budgets` | unbounded `getMany()` | offset |
| 3 | `GET /finance/categories` | flattens the whole chart of accounts | offset |
| 4 | `GET /branches` | unbounded `getMany()` + `search` | offset |
| 5 | `GET /warehouses` | unbounded `getMany()` | offset |
| 6 | `GET /machine-models` | unbounded, grows with catalogue | offset |
| 7 | `GET /merchants/{id}/machines` | unbounded per merchant | offset |
| 8 | `GET /merchants/{id}/subscriptions` | unbounded plan history | offset |
| 9 | `GET /machines/{id}/maintenance-history` | unbounded repair history inside a `totals` envelope | offset (nested) |
| 10 | `GET /users/{id}/custody` | unbounded raw SQL inside a `UserCustodyResponse` envelope | offset (nested) |
| 11 | `GET /merchants/pickable` | **silent truncation** — `.take(200)`, no search, no signal | offset + `search` |
| 12 | `GET /transfers/recipients` | inherits the 200 cap on the merchant branch; user branch unbounded | offset + `search` |
| 13 | `GET /merchants/{id}/timeline` | `limit` with no cursor — page 2 unreachable | keyset |
| 14 | `GET /finance/budgets/status` | unbounded, grows with budget count | offset |
| 15 | `GET /sync/delta` | unbounded per-collection deltas | chunked cursor |
| 16 | `GET /sync/bootstrap` | `myMachines` / `myMerchants` unbounded | hard cap + `hasMore` flag |
| 17 | `GET /reports` (catalogue) | *(no change — listed for completeness of the sweep)* | none |

---

## 2. Tier 1 — plain list endpoints (offset). Do these first.

Each of these is the same six-step edit. **The recipe:**

1. In the module's `dto/`, change the query DTO to `extends PaginationDto` (it already extends
   `LocalizedQueryDto` or `ActiveFilterQueryDto`; `PaginationDto` extends `LocalizedQueryDto`, so
   for `ActiveFilterQueryDto` descendants keep `includeInactive` by re-declaring it or by making
   the DTO extend `PaginationDto` and adding the `includeInactive` field back).
2. In the service, change the return type to `Promise<PaginatedResult<T>>`, append
   `.orderBy(...).addOrderBy('<alias>.id', 'ASC').skip(query.skip).take(query.take)`, and swap
   `getMany()` for `getManyAndCount()`; return `new PaginatedResult(rows, total, query.page, query.limit)`.
3. In the controller, change the return type to `Promise<PaginatedResult<XResponse>>` and use
   `page.map(toXResponse)` instead of `rows.map(...)`.
4. Regenerate `openapi.json` (`npm run docs:generate`).
5. Update the Flutter repo + cubit + screen named in the row (use `PaginatedResponse` /
   `PaginatedListView`).
6. Add/extend the E2E spec: default page size, `page=2`, `limit` over `MAX_LIMIT` → 400, and
   `meta.total` correct under the caller's branch scope.

### 2.1 `GET /suppliers`

- `src/modules/finance/services/suppliers.service.ts:16` — `findAll`, `getMany()` → `getManyAndCount()`.
- `src/modules/finance/suppliers.controller.ts:20`.
- `QuerySuppliersDto` → `extends PaginationDto`; keep `search`, `includeInactive`.
- Order: `supplier.name ASC, supplier.id ASC`.
- **Flutter — this one bites twice. Read §5.2 before touching the backend.**
  `/suppliers` is read by `LookupsRepo.suppliers()` (`core/lookups/lookups_repo.dart:45`), whose
  `_fetch` is documented as "a bare array under `data`, with no paging around it" and caches for
  the whole session; and by `FinanceRepoImpl.suppliers()` (`finance_repo_impl.dart:374`), which
  persists the full list to `LocalStorage` as the **offline** reference cache. Paginating the
  route without §5.2 silently cuts every supplier picker to 20 rows, online and off.

### 2.2 `GET /finance/budgets`

- `src/modules/finance/services/budgets.service.ts:86` — note it returns `BudgetListResult
  { budgets, view }`. Keep `view` (the localized category view) **outside** the page: return
  `{ page: PaginatedResult<Budget>, view }` from the service and let the controller return
  `page.map(...)` so `ResponseInterceptor` sees a `PaginatedResult`. If `view` must stay in the
  body, move it into each item rather than into `meta`.
- `src/modules/finance/budgets.controller.ts:41`.
- Order: `budget.period_start DESC, budget.id ASC` (already the tiebreaker — keep it).

### 2.3 `GET /finance/categories`

- `src/modules/finance/services/finance-categories.service.ts:78` — this filters an in-memory
  flattened tree, so paginate **after** filtering: `nodes.slice(query.skip, query.skip + query.take)`
  with `total = nodes.length`. Do not push `LIMIT` into `fullTree()` — that would break the tree.
- `src/modules/finance/finance-categories.controller.ts:45`.
- Leave `/finance/categories/tree` alone (rule 2).

### 2.4 `GET /branches`

- `src/modules/organization/branches.service.ts:31`.
- Careful: the query `leftJoinAndSelect`s `branch.warehouses`. With a join-to-many, `skip`/`take`
  make TypeORM issue a distinct-id subquery — that is correct, but verify `getManyAndCount()`
  counts branches, not branch×warehouse rows. Add an E2E case with a branch that has 2+ warehouses.
- Order: `branch.name ASC, branch.id ASC`.
- **Flutter — same offline-cache hazard as §2.1, see §5.2.** `/branches` is read from four places
  (`merchants_repo_impl.dart:414`, `machines_repo_impl.dart:384`, `users_repo_impl.dart:247`, and
  `finance_repo_impl.dart:371` via `_refs`, which writes the offline cache).

### 2.5 `GET /warehouses`

- `src/modules/organization/warehouses.service.ts:28`. Same join caveat (`warehouse.branch` is
  many-to-one, so no distinct-id subquery — simpler than branches).
- Order: `warehouse.type ASC, warehouse.name ASC, warehouse.id ASC`.
- **Do not** paginate `findByType` — it resolves a singleton and is used by the transfer engine.

### 2.6 `GET /machine-models`

- `src/modules/lookups/machine-catalogue.controller.ts:83`, backed by `lookup-crud.service.ts:69`.
- This is the one lookup that grows. `listQuery(...).getMany()` → add `skip`/`take`/count.
- Keep `machineTypeId` and `rawTranslations` filters.
- `/machine-types` stays unpaginated but gets the step 3.1 cap.

### 2.7 `GET /merchants/{id}/machines`

- `src/modules/merchants/merchants.service.ts:417` — `machinesOf` delegates to `heldMachines(id)`.
  Add a paginated overload rather than changing `heldMachines`, which other call sites use for
  counts and custody checks.
- `src/modules/merchants/merchants.controller.ts:130`.
- Order: `machine.serial ASC, machine.id ASC`.
- Flutter: `WebConstant.merchantMachines(id)` — merchant detail screen's machines tab.

### 2.8 `GET /merchants/{id}/subscriptions`

- `src/modules/merchants/merchants.service.ts:424` — `this.subscriptions.find({...})` →
  `findAndCount` with `skip`/`take`.
- `src/modules/merchants/merchants.controller.ts:168`.
- Order: `createdAt DESC, id ASC`.
- Flutter: `WebConstant.merchantSubscriptions(id)` — the "every plan" card on merchant detail.

### 2.9 `GET /finance/budgets/status`

- `src/modules/finance/services/budgets.service.ts:234`.
- Same treatment as 2.2. `asOf` and the computed spend-vs-budget stay per item.

---

## 3. Tier 2 — pickers that silently truncate. Highest user-visible risk.

These are worse than the unbounded ones: the API already drops rows and tells nobody.

### 3.1 Safety cap on the seeded lookups (do this first, it is one edit)

In `src/modules/lookups/lookup-crud.service.ts:69`, add `.take(MAX_LIMIT)` to `listQuery(...)`.
Covers `/payment-methods`, `/violation-types`, `/maintenance-locations`, `/decommission-reasons`,
`/machine-types`. Add a comment: these tables are seeded and admin-edited; the cap is a ceiling,
not pagination, and if one ever legitimately exceeds 100 rows it graduates to Tier 1.

### 3.2 `GET /merchants/pickable`

`src/modules/merchants/merchants.service.ts:754` currently ends `.take(200).getMany()` — a
representative with 201 in-scope merchants cannot reach the 201st, and the response carries no
signal that anything was cut.

- Add `search` (name / shop name, reusing `likePattern` from `src/common/utils/search-pattern.util.ts`)
  and `PaginationDto` to a new `QueryPickableMerchantsDto`.
- Return `PaginatedResult<Merchant>`; drop the magic 200.
- Order: `merchant.name ASC, merchant.id ASC`.
- Keep `toMerchantListItemResponse(merchant, 0)` — the machine count is still not worth a second
  query for a picker.
- Flutter: `WebConstant.merchantsPickable` — the transfer wizard's merchant step. Make it a
  debounced server-side search backed by `PaginatedListView` inside the picker sheet
  (`feature/transfers/presentation/widgets/machine_picker_sheet.dart` is the pattern to copy).

### 3.3 `GET /transfers/recipients`

`src/modules/transfers/transfers.service.ts:356` has three branches:

- **Merchant branch** (line 366) delegates to `merchants.pickable` → fixed for free by 3.2, but the
  method must now forward `page`/`limit`/`search` through.
- **Warehouse branch** (line 376) is bounded by warehouse count — safe, but add `.take(MAX_LIMIT)`.
- **User branch** (line 397) is an unbounded `getRawAndEntities()` over all active users of a role.
  Add `skip`/`take` and a `search` on `user.full_name`. Because it uses `getRawAndEntities`, the
  count needs a separate `getCount()` on a cloned builder — do not try to read it off `raw`.
- The empty branches (line 389) return `[]` — wrap as an empty `PaginatedResult` so the response
  shape is uniform across all four.
- Flutter: `WebConstant.transfersRecipients` — the transfer wizard's recipient step.

---

## 4. Tier 3 — envelopes, timelines and sync. Design work, not just plumbing.

### 4.1 Extract the cursor helpers (prerequisite for 4.3 and 4.4)

`encodeCursor` / `decodeCursor` exist twice, as private module-level functions with different
signatures — `audit-logs.service.ts:98` takes `(createdAt: Date, id: string)`,
`machine-insights.service.ts:537` takes `(at: Date, refId: string)`. They are the same function.

- Move one implementation to `src/common/dto/cursor.util.ts`, re-export from
  `src/common/dto/index.ts`, and delete both private copies.
- No behaviour change: the encoding must stay byte-identical so cursors held by devices mid-session
  keep working. Assert that with a golden-value test before deleting anything.
- Add a unit spec covering a round trip, a malformed cursor (must 400, not 500), and a cursor whose
  fields do not match the query's sort order.

### 4.2 `GET /machines/{id}/maintenance-history` — paginate inside the envelope

The response is `{ machineId, serial, totals, orders }`. `totals` is computed over **all** repairs
and must not change when the caller pages.

- `src/modules/maintenance/maintenance.service.ts:655` — `historyOf` returns `{ orders, totals }`.
  Keep the `totals` query whole-history; add `skip`/`take` + count to the orders query only.
- `src/modules/maintenance/machine-maintenance.controller.ts:28`.
- Because the envelope is not a bare list, `ResponseInterceptor` cannot lift the meta. Pick one:
  **(a)** return `PaginatedResult<MaintenanceListItemResponse>` and move `machineId`/`serial`/`totals`
  into `meta` — clean but needs a `PaginatedResult` subclass carrying extra meta; or
  **(b)** keep the envelope and add an `ordersMeta: PaginationMeta` field inside `data`.
  **Recommendation: (b)** — it is additive, the Flutter model changes in one place, and it does not
  bend `ResponseInterceptor` into carrying domain data. Apply the same choice to 4.3 for consistency.

### 4.3 `GET /users/{id}/custody` — paginate inside the envelope

`src/modules/users/user-custody.service.ts:27` runs one raw SQL statement with no `LIMIT`.

- Add `LIMIT $n OFFSET $m` plus a `COUNT(*) OVER()` window column so the total comes back in the
  same round trip (the query is expensive — do not run it twice).
- Keep `ORDER BY held_since ASC, machine.serial ASC` and append `, machine.id ASC`.
- `src/modules/users/users.controller.ts:71`, `UserCustodyResponse` gains `machinesMeta` per 4.2(b).
- **Do not touch `countHeldByUser`** (`src/modules/users/custody.port.ts:33`) — the deactivation
  guard in `users.service.ts:262` depends on a count over the whole set, not a page.
- Flutter: `WebConstant.userCustody(id)`.

### 4.4 `GET /merchants/{id}/timeline` — keyset, matching the machine timeline

`src/modules/merchants/merchants.service.ts:678` takes a `limit` and has no cursor, so the client
can see the newest N hand-offs and nothing before them.

- Mirror `MachineInsightsService.timeline` exactly: `QueryMerchantTimelineDto extends
  LocalizedQueryDto` with `limit` (max `MAX_TIMELINE_PAGE`, default 30) and `cursor`.
- The method merges transfers, subscriptions and collections. For a keyset over a merged feed the
  cursor must be `(occurred_at, ref_id)` over the **merged** ordering — so the three source queries
  each need `WHERE (occurred_at, ref) < (cursor)` and `LIMIT limit + 1`, merged and re-sliced in
  memory. That over-fetches at most `3 × (limit+1)` rows, which is the correct trade.
- Return `CursorResult<MerchantTimelineEntryResponse>`.
- Flutter: `WebConstant.merchantTimeline(id)` — the merchant detail timeline.
  `feature/machines/data/logic/machine_timeline/machine_timeline_cubit.dart` is the cubit to copy.

### 4.5 `GET /sync/bootstrap` — cap, do not paginate

The route is documented as deliberately unpaginated (`sync.controller.ts:41`) and that decision is
sound: it is the device's whole local database. But `collect()` (`sync.service.ts:108`) builds
`myMachines` via `machines.inCustodyOf` and `myMerchants` via `merchants.visibleForSync`, both of
which end in a bare `getMany()`.

- Cap each at `MAX_BULK_LIMIT` (500) and add a `truncated: { myMachines: boolean, myMerchants: boolean }`
  block to `SyncBootstrapResponse`, so a device that is over the cap knows to fall back to online
  reads rather than believing it has a complete local copy.
- Bump `SYNC_SCHEMA_VERSION` — the Flutter sync coordinator must handle the new field.
- Flutter: `core/services/sync/sync_coordinator.dart`.

### 4.6 `GET /sync/delta` — chunked cursor

`sync.service.ts:84` returns every row changed since the cursor. A device offline for a month, or
the first delta after a bulk import, pulls an unbounded payload over a field connection.

- Keep `since` as the semantic cursor, add `limit` (default 200, max `MAX_BULK_LIMIT`).
- Cap each collection at `limit`; when **any** collection is capped, set `nextSince` to the
  `updated_at` of the last row returned rather than the pre-query wall clock, and add
  `hasMore: true`. The client then loops until `hasMore` is false.
- This is the one item here with a real correctness hazard: `nextSince` is currently read *before*
  the queries run specifically to avoid a gap (see the comment at `sync.service.ts:78`). The chunked
  version must keep that property — when nothing is capped, keep the existing pre-query timestamp;
  only when capped does the cursor become row-derived. Write the E2E for both paths.
- Bump `SYNC_SCHEMA_VERSION`; update `core/services/sync/sync_coordinator.dart` to loop.

---

## 5. Mobile app — what changes on the client

The plan above is backend work, but it is **not backend-only**: three of the Flutter reference
caches assume the exact shapes these routes return today, and two of them persist that assumption.

### 5.1 What is already right

`PaginatedResponse`, `PaginationMetaModel` and `PaginatedListView` are real and in use. Fourteen
screens already page correctly and need no work:

`finance_transactions_screen` · `machine_timeline_screen` · `machines_list_screen` ·
`decommission_candidates_screen` · `maintenance_list_screen` · `maintenance_responsible_picker_sheets` ·
`merchants_list_screen` · `notifications_list_screen` · `transfers_list_screen` ·
`machine_picker_sheet` · `users_list_screen` · `violations_list_screen` ·
`violation_machine_picker_sheet` · `violation_user_picker_sheet`

### 5.2 Blocker — the two reference caches must be fixed *before* §2.1 and §2.4

| Cache | File | Reads | Behaviour |
| --- | --- | --- | --- |
| Session lookup cache | `core/lookups/lookups_repo.dart:53` (`_fetch`) | `/payment-methods`, `/violation-types`, `/maintenance-locations`, `/decommission-reasons`, **`/suppliers`** | Parses a bare array — the helper's own doc comment says "no paging around it" — filters `isActive`, holds it for the whole session |
| Offline reference cache | `feature/finance/domain/repos/finance_repo_impl.dart:379` (`_refs`) | **`/branches`**, **`/suppliers`**, `/payment-methods` | Fetches the whole list and `json.encode`s it into `LocalStorage`; that copy is what the app uses when offline |

Neither reads `meta`. Neither sends `page` or `limit`. So the moment `/suppliers` or `/branches`
starts defaulting to 20 rows, both caches fill with 20 rows and report success — the session cache
holds the truncated list until the app restarts, and the offline cache holds it until the next
online fetch, which will also be truncated. This is silent data loss in the offline path, which is
the path this app exists for.

**Fix, in this order:**

1. Add a `fetchAll(path)` helper that loops `page` until `meta.hasNext` is false, capped at
   `MAX_LIMIT` per request and a sane total (say 10 pages), and have both caches use it. It must
   send `limit=100` explicitly rather than relying on the server default.
2. Have it fail loudly — `Left(ServerFailure)`, not a partial list — if the cap is hit, so a
   genuinely oversized table surfaces as a bug instead of a quietly short picker.
3. Only then ship §2.1 and §2.4.

For the pickers that the lookup cache feeds, the better long-term answer is a debounced
server-side `search` (as in §3.2) rather than caching the whole table; step 1 is the safe
intermediate that unblocks the backend work.

### 5.3 Client work per backend change

| Backend item | Flutter call site | Work |
| --- | --- | --- |
| §2.1 `/suppliers` | `lookups_repo.dart:45`, `finance_repo_impl.dart:374` | §5.2 first; then optional server-side search in the picker |
| §2.2 `/finance/budgets` | `finance_repo_impl.dart` (`financeBudgets`) | `PaginatedListView` on the budgets screen |
| §2.3 `/finance/categories` | `finance_repo_impl.dart:241`, `category_picker_screen.dart` | The picker uses a plain `ListView` — move to `PaginatedListView` or server-side search. `financeCategoriesTree` (line 215) is unaffected |
| §2.4 `/branches` | `merchants_repo_impl.dart:414`, `machines_repo_impl.dart:384`, `users_repo_impl.dart:247`, `finance_repo_impl.dart:371` | §5.2 first; the three dropdowns then need `limit=100` or a searchable picker |
| §2.5 `/warehouses` | **none** — `WebConstant.warehouses` is declared but never called | No client work. Confirm before deleting the constant |
| §2.6 `/machine-models` | machine registration form | Server-side search; a model list is long enough to warrant it |
| §2.7 `/merchants/{id}/machines` | `merchants_repo_impl.dart:139` | Merchant detail machines tab → `PaginatedListView` |
| §2.8 `/merchants/{id}/subscriptions` | `merchants_repo_impl.dart:157` and `:317` | Detail card → `PaginatedListView`. Line 317 is a post-create refetch; make sure it reads page 1, not "all" |
| §3.2 `/merchants/pickable` | **none** — `WebConstant.merchantsPickable` is declared but never called | No client work; the wizard reaches it via `/transfers/recipients` |
| §3.3 `/transfers/recipients` | `transfers_repo_impl.dart:517` | The real picker. Debounced server-side search in a `PaginatedListView` sheet; copy `machine_picker_sheet.dart` |
| §4.2 `/machines/{id}/maintenance-history` | `machines_repo_impl.dart:339` | Parse the new `ordersMeta`; page the orders list, keep `totals` pinned to the header |
| §4.3 `/users/{id}/custody` | `users_repo_impl.dart:76` | Same shape change |
| §4.4 `/merchants/{id}/timeline` | `merchants_repo_impl.dart:175` | Keyset; copy `machine_timeline_cubit.dart` |
| §4.5–4.6 sync | `core/services/sync/sync_coordinator.dart` | Handle `truncated`, loop on `hasMore`, new `SYNC_SCHEMA_VERSION` |

### 5.4 Pre-existing client bug, independent of the backend work

`ReportsRepoImpl.run` (`feature/reports/domain/repos/reports_repo_impl.dart:57`) computes
`hasNext: page * 20 < result.rowCount` — a hardcoded page size, ignoring the `meta` the backend
already sends. It happens to be right today only because the client never sends `limit` and the
server default is 20. Change either and the "load more" button on every report lies.

Fix: read `meta.hasNext` off `PaginatedResponse` like every other feature.
(`rowCount` is the pre-slice total — `reports.controller.ts:429` — so the arithmetic is sound; the
constant is the problem.)

---

## 6. Guardrail — stop the next unpaginated list from landing

After the tiers are done, add an ESLint rule or a test that fails the build when a
`@Get()` handler's return type is a bare array type (`Promise<X[]>`) unless the handler is on an
explicit allowlist matching §1.3. A simple version: a unit test that walks the compiled route table
(`app.getHttpAdapter().getInstance()._router`) and asserts every GET route is either in the
allowlist or declares `page`/`limit`/`cursor` in its OpenAPI parameters. The audit script used to
produce this document is the seed for it:

```
# from backend/api
python3 - <<'EOF'
import json
s = json.load(open('openapi.json'))
for p, ops in sorted(s['paths'].items()):
    o = ops.get('get')
    if not o: continue
    names = [x.get('name') for x in o.get('parameters', [])]
    paged = ('page' in names and 'limit' in names) or 'cursor' in names
    print(('PAGED ' if paged else 'BARE  '), p)
EOF
```

---

## 7. Suggested order of work

| Step | Scope | Risk | Why here |
| --- | --- | --- | --- |
| 1 | §3.1 lookup cap | trivial | One line, removes five unbounded queries |
| 2 | §5.2 client reference caches | medium | **Blocks §2.1 and §2.4** — ship it before they land |
| 3 | §2.1–2.6 plain lists | low | Pure recipe, no envelope or cursor design |
| 4 | §2.7–2.9 nested lists | low | Same recipe, one level down |
| 5 | §3.2–3.3 pickers | medium | Fixes real silent truncation; touches the transfer wizard |
| 6 | §4.1 cursor util | trivial | Prerequisite |
| 7 | §4.2–4.3 envelopes | medium | Needs the 4.2(b) decision applied consistently |
| 8 | §4.4 merchant timeline | medium | Merged-feed keyset is the fiddliest query |
| 9 | §4.5–4.6 sync | high | Schema version bump, client loop, offline correctness |
| 10 | §6 guardrail | low | Locks the result in |

Close each step with, in `backend/api`:

```
npm run lint && npm run typecheck && npm run test && npm run test:e2e
npm run docs:generate && npm run check:openapi
```

then, in `mobile-app`: `flutter analyze`, the feature's widget tests, and the affected Maestro flow
under `mobile-app/maestro/`.
