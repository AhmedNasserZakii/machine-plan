# 01 — Architecture & Conventions

> These are non-negotiable. Every other file in this folder assumes them.

## The stack

| Concern | Choice | Why this one |
|---|---|---|
| Framework | **Next.js 15**, App Router, React 19 | route-level auth in middleware, server components for the shell, one deploy artifact |
| Language | **TypeScript**, `strict: true` | the API contract is typed; losing that at the boundary defeats the point |
| Styling | **Tailwind CSS v4** with `@theme` tokens | logical properties (`ps-`/`pe-`) make RTL free; tokens live in CSS, one source |
| Components | **shadcn/ui** (Radix primitives, copied in, not a dependency) | accessible by construction, and we own the files so tokens apply cleanly |
| Server state | **TanStack Query v5** | caching, `keepPreviousData` pagination, invalidation after mutations |
| Tables | **TanStack Table v8** (headless) | sorting/selection/column visibility without owning layout |
| Forms | **react-hook-form + zod** | zod schemas double as the runtime guard on API payloads |
| i18n | **next-intl** | locale segment routing, RTL, number/date formatting per locale |
| Charts | **Recharts** | see `08`; follow the `dataviz` palette rules |
| Icons | **lucide-react** | matches the Material-ish weight of the mobile icon set |
| Dates | **date-fns** + `date-fns/locale/ar` | small, tree-shakeable, correct Arabic month names |

**Do not add a package that is not on this list without writing down why.** Specifically: no Redux,
no MobX, no Zustand for server data (TanStack Query owns it), no Axios (the API client in `05` is
a thin `fetch` wrapper), no CSS-in-JS, no second component library.

The only sanctioned client-side global store is a tiny one for UI-only state that must outlive a
route (sidebar collapsed, active branch filter). Use React context, not a library.

## Layering — mirrors the Flutter app

```
Flutter                                Web
─────────────────────────────────      ────────────────────────────────────────
feature/<f>/data/models/           →   features/<f>/api/*.ts      (DTO ↔ fetchers)
feature/<f>/domain/entities/       →   features/<f>/model/*.ts    (types, enums, labels)
feature/<f>/domain/repos/          →   features/<f>/api/*.ts      (same file; no repo class)
feature/<f>/data/logic/*_cubit     →   features/<f>/hooks/*.ts    (useQuery / useMutation)
feature/<f>/presentation/pages/    →   app/[locale]/(app)/<f>/    (route segments)
feature/<f>/presentation/widgets/  →   features/<f>/components/
```

The web collapses `repo` into the fetcher module because there is no second data source to
abstract over (no local DB). Everything else keeps the same boundary and the same names, so a
developer moving between the two codebases is never guessing.

## The nine rules

1. **The API is the contract, and it is frozen.** Types come from `openapi.json` via codegen
   (`05`). No hand-written response interfaces. No new endpoints.
2. **No raw endpoint strings in feature code.** They live in `src/lib/api/endpoints.ts`, which is
   the direct counterpart of `mobile-app/lib/core/network_services/web_constant.dart`.
3. **No raw colour, spacing or font-size values anywhere.** Only token classes
   (`bg-surface`, `text-danger`, `p-md`, `rounded-md`). A `#`-prefixed hex in `src/features/`
   or `src/app/` fails lint. Tokens live only in `src/styles/tokens.css`.
4. **No hardcoded user-visible strings.** Every one goes through `useTranslations()`. Reuse the
   existing mobile key names wherever the string is the same (`04`).
5. **No physical direction.** `ps-4` not `pl-4`, `me-2` not `mr-2`, `start-0` not `left-0`,
   `text-start` not `text-left`. Lint enforces it. RTL is not a later pass.
6. **Permissions gate three levels, always all three:** the route (middleware + layout),
   the navigation entry, and the action control itself. Never only one. A hidden button that is
   still reachable by URL is a bug, and so is a visible button that 403s.
7. **Every mutation sends `Idempotency-Key`.** The backend enforces it on every authenticated
   `POST`/`PUT`/`PATCH`/`DELETE` except a documented exemption list. The client generates one UUID
   per user intent and **reuses it across retries of that same intent** — that is the entire point.
8. **Every list screen is URL-driven.** Page, limit, sort, and every filter live in the query
   string. A filtered table must be shareable as a link and survive a refresh and the back button.
   This is the single biggest UX difference from mobile and it is not optional.
9. **Every data surface has four states:** loading (skeleton, not a spinner, matching the final
   layout), empty (with the action that fills it, permission-gated), error (with the localized
   `error.code` message and a retry), and success. A screen missing one of these is not done.

## Offline: explicitly out of scope

The mobile app is offline-first because a representative stands in a shop with no signal. A
browser user does not. Replicating the SQLite mirror, the outbox and the conflict rules in the
browser would double the number of places custody state can diverge from the server, for a user
who has wifi.

The web app therefore:

- reads and writes **straight through to the API**, always;
- shows a **connection banner** and disables mutation controls when `navigator.onLine` is false;
- never queues a mutation for later — a failed write is surfaced and retried by the user;
- provides a read-only **Sync Monitor** page over `GET /sync/status` so a Director can see which
  devices have unsynced work (`19`).

Write this decision into the project README too. It will be questioned later.

## Multi-tenancy by branch

The backend scopes every list to the caller's branch unless they hold the matching `*.read.all`
permission. The web app must **not** send `branchId` on a scoped endpoint — the global validation
pipe uses `forbidNonWhitelisted` and will 400 loudly, which is the desired behaviour.

For `*.read.all` holders, the app shell exposes a **branch switcher** that appends `branchId` as a
normal filter. It renders only when the user holds a `.read.all` permission, and its value is part
of the URL query string like any other filter.

## Rendering strategy

- The **shell** (sidebar, topbar, locale, theme) is a server component; it does not fetch data.
- Every **data view** is a client component using TanStack Query. Do not fetch list data in server
  components: the caching, invalidation-after-mutation and URL-filter behaviour all live client
  side, and splitting that across the boundary produces two sources of truth.
- Auth gating happens in **middleware** (redirect) and again in the dashboard **layout** (render).
  Middleware only checks that a session cookie exists; the layout checks actual permissions from
  `/auth/me`.

## Naming

- Files: `kebab-case.ts`, `kebab-case.tsx`. Components exported `PascalCase`.
- Hooks: `use<Thing>Query` / `use<Thing>Mutation` (`useMachinesQuery`, `useConfirmTransferMutation`).
- Query keys: `['machines', 'list', params]` / `['machines', 'detail', id]` — a `queryKeys` factory
  per feature, never an inline array literal.
- Enum-ish API values stay `SCREAMING_SNAKE` strings, exactly as the API sends them. Never map a
  status to a different casing on the client; map it to a **label** and a **tone** instead (`03`).

## Definition of done for any feature

Restated as a checklist in `24`, and gated by `25`:

- [ ] Route exists, is permission-gated at all three levels, and is in the nav under the right group.
- [ ] Types generated from `openapi.json`, not hand-written.
- [ ] All four data states implemented.
- [ ] `ar` and `en` strings present; screen verified in RTL and LTR.
- [ ] Filters/sort/pagination in the URL.
- [ ] Mutations send `Idempotency-Key` and invalidate the right query keys.
- [ ] Server `error.code` values handled specifically where the user can act on them.
- [ ] Keyboard reachable; focus visible; table has real `<th scope>`.
- [ ] Tests per `25`.
