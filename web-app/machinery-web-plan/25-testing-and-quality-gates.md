# 25 — Testing & Quality Gates

## The gate

No feature is done until every box below is ticked for it. This is the checklist referenced from
`01` and repeated per feature in `24`.

```
[ ] npm run lint         — 0 errors, 0 warnings
[ ] npm run typecheck    — clean
[ ] npm run api:types    — regenerates with no diff
[ ] npm run i18n:check   — no missing ar or en key
[ ] npm run tokens:check — no raw hex, no physical direction utilities
[ ] npm run test         — unit + component green
[ ] npm run test:e2e     — the feature's flow green
[ ] manual: ar + en, both directions
[ ] manual: the role walk-through for this feature (21)
[ ] manual: loading / empty / error / offline states
[ ] manual: print, where the feature prints
```

## Layers

### Unit (Vitest)
Pure logic only, no DOM: query-string building (repeated keys, dropped empties, date formats),
pagination meta discrimination, permission helpers (`can`/`canAny`/`canAll`), the effective
permission resolution shown in the override editor, money and date formatting in both locales,
zod schemas including the `requiresSim` conditional, error mapping from `code` to UI treatment.

### Component (Testing Library + MSW)
Every shared component in `08`, and one representative screen per feature. MSW fixtures are built
from `openapi.json` examples so they cannot drift from the contract.

Per screen, at minimum:
- renders the loading skeleton, then the data
- renders empty, and **filtered-empty separately**
- renders an error with a working retry
- a permission-gated control is absent without the permission and present with it
- a filter change writes the URL and resets `page` to 1
- a server 400 with `details` lands on the right form field

Query the DOM the way a user does — by role and by label, not by test id. A test that passes
against an inaccessible DOM is testing the wrong thing.

### E2E (Playwright)
Against a real backend seeded with `npm run db:setup:dev` in `backend/api`. Run each flow as the
role that actually performs it.

Required flows:

| # | Flow | Role |
|---|---|---|
| 1 | login → forced password change → dashboard | new user |
| 2 | create machine → find by serial → edit → timeline | supervisor |
| 3 | bulk import 50 machines incl. a partial failure and a failures-only re-import | supervisor |
| 4 | full custody chain: company → branch → rep → merchant → back, with signatures | multiple |
| 5 | confirm a transfer, verify machine status and holder changed | representative |
| 6 | reject a transfer, verify custody returned to the sender | representative |
| 7 | register a merchant, hit the duplicate pre-check, place a machine | representative |
| 8 | open maintenance → send → receive → close with cost → verify the finance transaction | supervisor |
| 9 | create, charge and waive violations; verify the finance transaction | supervisor |
| 10 | finance: transaction → void → category reparent → budget → export | accountant |
| 11 | decommission: candidate → preconditions → typed confirm → revert | director |
| 12 | run a report, group, drill down, export (202 job) and download | director |
| 13 | create a user, set a DENY override, log in as them, verify the UI is gated | director |
| 14 | edit a role's permissions, verify the affected-user warning and the result | director |
| 15 | **the money-leak test** — log in without `finance.read` and assert no amount is visible on machines, maintenance, violations, merchants, the dashboard or any report | supervisor |
| 16 | locale switch preserves route **and** query string, on a filtered table | any |
| 17 | session expiry: revoke the refresh token mid-session, assert a clean logout | any |

Flow 15 exists because the rule in `21` is the most likely bug in the app. Write it early, not
in Sprint 10.

## Accessibility

- `axe-core` via `@axe-core/playwright` on every route in the E2E suite; zero serious or critical
  violations.
- Keyboard-only traversal of each feature's primary flow. A mouse-only path is a bug.
- Focus visible everywhere; focus moves to the page heading on route change; focus is trapped in
  dialogs and returns to the trigger on close.
- Tables use real `<th scope>` and a `<caption>`.
- Form fields have real `<label>`s; errors are associated via `aria-describedby` and announced.
- Contrast ≥ 4.5:1 for text. Check `--color-warning` (`#D69E2E`) on white specifically — it is the
  token most likely to fail, so warning chips use the warning *surface* with darker text rather
  than the raw warning colour on white.
- Every status is conveyed by icon + text, never by colour alone (`03`).

## RTL

A `describe` block per feature that renders it in `ar` and asserts:
no horizontal overflow; chevrons and arrows flipped; trash/check not flipped; serials, phones,
amounts and dates rendering LTR; the table's first column sticking to the inline-start edge.

Snapshot both locales for the shared components in `08`. For feature screens, prefer assertions
over snapshots — a screenshot diff on a data table is noise.

## Performance budgets

| Metric | Budget |
|---|---|
| First-load JS (shared) | ≤ 200 KB gzipped |
| Per-route JS | ≤ 120 KB gzipped |
| LCP on the dashboard, mid-tier laptop | ≤ 2.0 s |
| A 100-row table render | ≤ 100 ms |
| Interaction to next paint | ≤ 200 ms |

Virtualize a table only when a list genuinely exceeds ~200 visible rows — the `limit` cap is 100,
so most tables never need it, and virtualization costs accessibility and `Ctrl+F`.

## CI

```yaml
on: [pull_request]
jobs:
  web:
    - npm ci
    - npm run api:types && git diff --exit-code    # generated types must be committed and current
    - npm run lint
    - npm run typecheck
    - npm run i18n:check
    - npm run tokens:check
    - npm run test -- --coverage
    - npm run build
    - npm run test:e2e        # against a seeded backend service container
```

`git diff --exit-code` after codegen is the mechanism that keeps the web app honest about the API
contract — the same discipline as the backend's `check:openapi`.

## Manual pre-release checklist

- [ ] Log in as each of the five seeded roles; walk every screen; compare against `21`.
- [ ] Every screen in `ar` and in `en`.
- [ ] Force each error status (401, 403, 404, 409, 422, 429, 500) and a network drop, per feature.
- [ ] Print every printable surface in both locales.
- [ ] Test on the browsers the users actually have — Chrome and Edge on Windows, Safari on macOS.
- [ ] Test at 1366×768. That is the real screen in the branch office, not a 27-inch monitor.
