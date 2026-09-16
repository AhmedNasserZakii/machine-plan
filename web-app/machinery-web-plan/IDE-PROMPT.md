# IDE Prompt — Web App Implementation

Two prompts. Use **A** once to start. Use **B** at the top of every session after that.

---

## A — Kickoff prompt (paste once, at the start)

```text
You are implementing a new web dashboard for an existing production system. The repo is
/Users/ahmednasser/Documents/mahmoud topay and it already contains a working NestJS backend and
a working Flutter mobile app. You are adding a third client. You are NOT redesigning anything.

## Read before writing any code

Read these in this order and do not start until you have:

1. web-app/machinery-web-plan/00-README.md      — scope and what is frozen
2. web-app/machinery-web-plan/01-architecture-and-conventions.md — the nine non-negotiable rules
3. web-app/machinery-web-plan/02-project-structure.md
4. web-app/machinery-web-plan/03-theming-and-design-tokens.md
5. web-app/machinery-web-plan/23-implementation-roadmap.md — the sprint order
6. web-app/machinery-web-plan/24-implementation-todo.md    — the checklist you will tick

Then read the actual sources of truth these were derived from:

- backend/api/openapi.json                                — the API contract (140 endpoints)
- mobile-app/lib/core/theme/styles/app_colors.dart        — the colour tokens
- mobile-app/lib/core/theme/styles/app_spacing.dart       — spacing and radius
- mobile-app/lib/core/theme/styles/status_colors.dart     — status → tone
- mobile-app/lib/core/permissions/permission_keys.dart    — the permission catalogue
- mobile-app/lib/core/network_services/web_constant.dart  — the endpoint catalogue pattern
- mobile-app/lib/feature/machines/                        — read ONE feature end to end; this is
                                                            the layering you mirror
- backend/machinery-backend-plan/22-api-conventions-errors.md — envelope, errors, pagination
- backend/machinery-backend-plan/04-auth-and-permissions.md   — the permission model

## Hard rules — violating any of these is a bug, not a judgement call

1. THE API IS FROZEN. Do not add, modify or propose a backend endpoint. If a screen seems to
   need one, the requirement is wrong — compose existing endpoints instead. 140 endpoints are
   mapped to screens in 22-endpoint-map.md; that map is complete.
2. TYPES ARE GENERATED, never hand-written. `openapi-typescript backend/api/openapi.json`.
   Feature model files re-export from the generated schema. Never redeclare a response shape.
3. THE DESIGN TOKENS ARE FROZEN and are a literal port of the Dart theme files. Zero raw hex and
   zero inline font sizes outside src/styles/tokens.css. If a value in my plan differs from the
   Dart file, the DART FILE IS RIGHT — tell me, do not silently pick one.
4. NO NEW PACKAGES beyond the list in 01-architecture-and-conventions.md without asking me first.
   Specifically: no Redux, no Zustand for server data, no Axios, no second component library,
   no CSS-in-JS.
5. ARABIC IS THE DEFAULT LOCALE AND RTL IS NOT A LATER PASS. Only logical CSS properties
   (ps-/pe-/ms-/me-/start-/end-/text-start). Never pl-, pr-, ml-, mr-, left-, right-, text-left,
   text-right. Every user-visible string goes through t(), with both ar and en present.
   Reuse the 976 existing keys in mobile-app/assets/translations/ where the string is the same.
6. PERMISSIONS GATE THREE LEVELS, ALWAYS ALL THREE: the route, the nav entry, and the control
   itself. See 21-permissions-ui-matrix.md. A hidden button still reachable by URL is a bug, and
   so is a visible button that 403s.
7. EVERY MUTATION SENDS AN Idempotency-Key, one per user intent, REUSED ACROSS RETRIES of that
   intent. A new key on a retry can double-create a transfer.
8. EVERY LIST SCREEN IS URL-DRIVEN. Page, limit, sort and every filter live in the query string.
   Changing any filter resets page to 1.
9. EVERY DATA SURFACE HAS FOUR STATES: loading (skeleton matching the final layout, not a
   spinner), empty (and filtered-empty is DIFFERENT copy from truly-empty), error (localized
   message + retry + copyable requestId), and success.
10. OFFLINE IS EXPLICITLY OUT OF SCOPE. The web app reads and writes straight through to the API.
    Do not build a write queue, a local mirror, or a service worker. Reasoning is in 01.

## How to work

Work sprint by sprint, in the order in 23-implementation-roadmap.md. Start at Sprint 0.

For each sprint:

1. Tell me which sprint you are starting and list what it contains from the roadmap.
2. Re-read the specific plan files that sprint references before writing its code.
3. Implement it fully. Do not stub, do not leave TODO comments in code, do not skip the boring
   parts (empty states, error handling, ar/en strings, permission gates). Those ARE the work.
4. Run the gate from 25-testing-and-quality-gates.md:
      npm run lint && npm run typecheck && npm run api:types && git diff --exit-code
      npm run i18n:check && npm run tokens:check && npm run test && npm run build
5. Tick the matching boxes in web-app/machinery-web-plan/24-implementation-todo.md. Tick a box
   ONLY when its acceptance check actually passes — an untrue checkmark is worse than an
   unchecked box. If something is partially done, leave it unchecked and say why.
6. Run the "Cross-cutting audits" section at the bottom of 24 against what you just built.
7. Stop, summarize what shipped, what you could not verify, and what is next. Wait for me.

Do not run ahead into the next sprint without me.

## Decide vs ask

DECIDE YOURSELF (do not ask me): component internals, file splits, prop shapes, naming within
the stated conventions, which shadcn primitive to base something on, test structure, how to
factor a hook.

ASK ME FIRST: anything needing a new package; anything that contradicts a plan file; anything
that would need a backend change; a genuine ambiguity in the API contract where guessing wrong
means rework.

If you find an error or a gap in my plan — a wrong endpoint path, a contradiction, a missing
case — say so plainly and propose the fix. The plan was written from the codebase, but the
codebase is the authority.

## Reporting

Be honest about state. If a test fails, show the output. If you skipped something, say so and
say why. Never report a sprint complete when part of it is not. I would rather hear "Sprint 3 is
done except bulk import, which needs the file-parsing decision" than discover it later.

## Start now

Begin with Sprint 0 (Foundation) from 23-implementation-roadmap.md. It ships nothing
user-visible and it is the most important sprint in the project — every sprint after it is fast
because of it. Do not shorten it.

Sprint 0 is done when: I can log in, the shell renders in both locales with correct direction,
/auth/me drives the sidebar, and a deliberately-expired access token refreshes transparently
without the UI seeing a 401.

Before writing code, confirm back to me: (a) the stack you are about to scaffold, (b) the exact
token values you read out of app_colors.dart, and (c) anything in the plan you think is wrong.
```

---

## B — Resume prompt (paste at the start of every later session)

```text
Continuing the web dashboard implementation in /Users/ahmednasser/Documents/mahmoud topay.

Read first:
- web-app/machinery-web-plan/01-architecture-and-conventions.md  (the nine rules)
- web-app/machinery-web-plan/24-implementation-todo.md           (what is done, what is next)
- web-app/machinery-web-plan/23-implementation-roadmap.md        (sprint order)

Then read the plan files for the sprint you are about to do, and open one already-built web
feature end to end so the new code matches what exists rather than what the plan describes in
the abstract. Where the existing code and the plan disagree, the EXISTING CODE WINS — tell me
about the divergence, do not "fix" it mid-feature.

The hard rules still apply in full: frozen API, generated types, frozen tokens, no new packages
without asking, ar/en + RTL from the start, three-level permission gating, idempotency keys
reused across retries, URL-driven lists, four states on every data surface, no offline.

Tell me which sprint you are picking up, confirm it against 24-implementation-todo.md, then
implement it fully, run the gate in 25-testing-and-quality-gates.md, tick the boxes that
genuinely pass, run the cross-cutting audits at the bottom of 24, and stop for review.
```

---

## Per-feature prompt (optional, for one feature at a time)

```text
Implement <FEATURE> for the web app.

Read, in order:
- web-app/machinery-web-plan/<NN>-feature-<feature>.md   (the spec)
- web-app/machinery-web-plan/21-permissions-ui-matrix.md (the controls and their gates)
- web-app/machinery-web-plan/22-endpoint-map.md          (which endpoints this feature owns)
- web-app/machinery-web-plan/07-data-fetching-and-state.md (the invalidation table)
- mobile-app/lib/feature/<feature>/                      (the mobile counterpart — mirror its
                                                          vocabulary and layering, not its layout)
- the matching section in backend/machinery-backend-plan/ (the business rules)

Then open the most recently completed web feature and match its structure exactly.

Build it completely: list, detail, forms, every permission gate, every error code the spec names,
loading/empty/filtered-empty/error states, ar + en strings, URL-driven filters, and the
invalidations from 07. Then run the gate in 25, tick the boxes in 24 that genuinely pass, and
report what is done and what is not.
```
