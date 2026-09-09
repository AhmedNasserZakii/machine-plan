# Machine Lifecycle & Finance System — Flutter App Plan

## What this is

A complete, implementation-ready specification for the mobile app that four kinds of people use:

| User | What they do in the app |
|---|---|
| **Director** | sees everything, creates accounts, assigns roles and individual permissions, controls who sees the money |
| **Branch supervisor** | receives machines from the company, issues them to representatives, receives returns, opens maintenance orders |
| **Representative** | receives machines, registers merchants, places machines with them, brings them back, signs for everything |
| **Accountant** | records expenses and income, manages categories and budgets, runs financial reports |

The same app serves all four. **The UI is driven entirely by the permission list returned from
`/auth/me`** — there are no role-specific builds and no hardcoded role checks in widgets.

## ⚠ Read this before writing a single line

**This plan describes a target architecture. If you are adding these features to an existing Flutter
project, the existing project's conventions win — always.**

Before implementing anything:

1. Read `pubspec.yaml` — know every package and version already available.
2. Read `lib/main.dart` / `lib/app.dart` — understand bootstrap.
3. Open one complete existing feature end to end — that is the pattern you mirror.
4. Identify what the project already uses for: state management, navigation, localization, theming,
   DI, networking, serialization, error handling.
5. Read `analysis_options.yaml`.

Then, for each feature file here, **translate the requirements into the project's existing patterns**.
Do not introduce a second state management solution. Do not add a package without asking. Do not
create a `domain/` layer if the project has none. See `01-architecture-and-conventions.md`.

## How to use this folder

| File | Read when |
|---|---|
| `01` | before anything — the non-negotiable rules |
| `02` | setting up folder structure |
| `03`–`07` | building the foundation (theme, l10n, network, DI/routing, local DB) |
| `08`–`20` | one file per feature, implement in order |
| `21` | the permission → UI matrix, referenced by every feature |
| `22` | sprint-by-sprint delivery order |

## The two hardest parts

1. **Offline-first.** A representative records a hand-off, captures a signature and four photos in a
   shop with no signal. Everything must work from the local database and sync later. See `07`.
2. **Signatures.** Every hand-off is signed by fingerprint or a drawn signature, and that signature
   has to mean something. See `14`.

Everything else is CRUD around those two.
