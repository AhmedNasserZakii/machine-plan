# Machine Lifecycle & Finance System — Web App Plan

## What this is

A complete, implementation-ready specification for the **web dashboard** that serves the same
system as the Flutter app, against the **same NestJS API** (`backend/api`, 140 endpoints under
`/api/v1`), with the **same design tokens**, the **same permission model**, and the **same
Arabic-first bilingual UX**.

The same four people use it, from a desk instead of a phone:

| User | What they do on the web |
|---|---|
| **Director** | everything — org setup, accounts, roles, permission matrix, finance gating, all reports |
| **Branch supervisor** | branch inventory tables, issue/receive machines, open and close maintenance orders |
| **Representative** | own custody, merchant register, hand-offs (desk flow, signature on canvas) |
| **Accountant** | transactions, categories tree, budgets, P&L, exports |

The UI is driven **entirely by the permission list returned from `/auth/me`** — no role-specific
routes, no hardcoded role checks in components. Identical rule to the mobile app.

## Relationship to the other two plans

```
backend/machinery-backend-plan/    ← the API contract. The web app CHANGES NOTHING here.
mobile-app/machinery-flutter-plan/ ← the mobile spec. The web app MIRRORS its vocabulary.
web-app/machinery-web-plan/        ← this folder.
```

**Rule: the API is frozen.** If a web screen seems to need a new endpoint, it does not get one.
It composes existing endpoints, or the requirement is wrong. The only exception is an explicit,
separately-approved backend task — and then it lands in the backend plan first, with an OpenAPI
regeneration, before any web code is written.

**Rule: the design tokens are frozen.** Every colour, spacing step and radius in `03` is a
one-to-one port of `mobile-app/lib/core/theme/styles/`. A web-only shade does not get invented;
it gets added to both sides or not at all.

## ⚠ Read this before writing a single line

1. Read `backend/api/openapi.json` — it is the committed, authoritative contract. Generate types
   from it (`05`), do not hand-write response interfaces.
2. Read `mobile-app/lib/core/theme/styles/app_colors.dart`, `app_spacing.dart`,
   `app_text_styles.dart`, `status_colors.dart` — these are the source of `03`.
3. Read `mobile-app/lib/core/permissions/permission_keys.dart` — `src/lib/auth/permissions.ts`
   is a transliteration of it, nothing more.
4. Read `mobile-app/assets/translations/ar.json` and `en.json` — 976 keys already exist. The web
   app **reuses these key names** wherever the string is the same, so a wording fix lands once.
5. Open one complete mobile feature end to end (`mobile-app/lib/feature/machines/`) — that is the
   layering the web features mirror.

## How to use this folder

| File | Read when |
|---|---|
| `01` | before anything — the non-negotiable rules |
| `02` | setting up the project and folder structure |
| `03`–`08` | building the foundation (tokens, i18n/RTL, API client, auth, data layer, UI kit) |
| `09`–`20` | one file per feature, implement in this order |
| `21` | permission → route → action matrix, referenced by every feature |
| `22` | the full endpoint → screen map for all 140 endpoints |
| `23` | sprint-by-sprint delivery order |
| `24` | **the TODO checklist — tick items here after each feature** |
| `25` | testing and the quality gate every feature must pass |

## The three things that are genuinely different from mobile

1. **No offline-first.** The web app is online-only by design. The mobile app owns the local
   SQLite mirror and the sync queue; replicating that in a browser buys nothing and doubles the
   surface where custody state can diverge. The web app instead gets a read-only **Sync Monitor**
   (`/sync/status`) so a Director can see which devices are behind. See `01`.
2. **Tables, not cards.** Field staff scroll cards one-handed. A Director filters 4,000 machines
   by branch, model and warranty date, sorts by repair cost, picks 40 rows and exports them. The
   `DataTable` in `08` is the single most-used component in the product — build it first and
   build it properly.
3. **Field capture has desk substitutes.** QR scanning becomes serial search plus an optional
   webcam scanner; fingerprint becomes a drawn signature on canvas posted to the same media
   endpoints. Nothing about the transfer contract changes. See `12` and `14`.
