# Machine Lifecycle & Finance System — Backend Plan (NestJS)

## What this is

A complete, implementation-ready specification for the backend of a system that does two things:

1. **Machine Lifecycle Tracking** — follow every machine from the moment it arrives from the factory,
   through every hand-off (company warehouse → branch → representative → merchant), through every
   maintenance/repair round, until it is decommissioned and moved to the scrap store.
2. **Company Finance Tracking** — record all company income and expenses under infinitely-nested
   categories, per branch, with budgets, alerts and reports.

## How to use this folder

Each file is a **self-contained feature spec**. An AI IDE (Cursor / Claude Code / Windsurf) or a
developer should implement them **in numeric order**, because later features depend on earlier ones.

Read these three first — they are global and every feature file assumes them:

| File | Why |
|---|---|
| `01-architecture-and-conventions.md` | Folder layout, module layering, naming, DTO/mapper rules |
| `02-database-localization-strategy.md` | How multi-language data is stored |
| `03-database-schema.md` | The full table list — the single source of truth for the schema |

Then implement feature files `04` → `21`, then `22` (API conventions) is a cross-cutting reference,
and `23` is the delivery roadmap with sprint slicing.

## Scale targets (drives indexing & pagination decisions)

- ~1,000 machines
- ~40 representatives
- multiple branches, one or more supervisors per branch
- monthly hand-off waves (bursts, not constant load)
- offline-capable mobile clients → sync bursts must be idempotent

## Non-negotiable rules for the implementer

1. **No business logic in controllers.** Controllers validate + delegate. Services own logic.
2. **No raw entity leaks.** Every response goes through a response DTO / mapper.
3. **Every state-changing machine operation goes through the Transfer engine** (`09`). Nothing
   mutates `machine.current_holder` directly.
4. **Every table that stores user-visible names is localized** per `02`.
5. **Every mutation writes an audit log entry** (`21`).
6. **Every write endpoint accepts an `Idempotency-Key`** (`20`) because clients are offline-first.
