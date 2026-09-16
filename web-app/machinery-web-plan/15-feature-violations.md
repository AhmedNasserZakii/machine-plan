# 15 — Feature: Violations

Mobile counterpart: `mobile-app/lib/feature/violations/`.

## Endpoints

| Method | Path | Screen |
|---|---|---|
| GET/POST | `violations` | list / create |
| GET/PATCH | `violations/{id}` | detail / edit |
| POST | `violations/{id}/acknowledge` | acknowledge |
| POST | `violations/{id}/charge` | charge |
| POST | `violations/{id}/waive` | waive |
| GET/POST | `violation-types` | lookup (`19`) |
| PATCH | `violation-types/{id}` | lookup edit |
| GET | `users/{id}/violations` | user detail tab (`18`) |
| GET | `users/{id}/violations/summary` | user detail summary |

Statuses: `OPEN`, `ACKNOWLEDGED`, `WAIVED`, `CHARGED`, `CLOSED`. Severity: `LOW`, `MEDIUM`, `HIGH`.
Tones in `03`.

## `/violations` — list

Columns: reference (sticky) · type · severity chip · status chip · subject user (`<UserChip>`) ·
related machine · amount (`<Money>`) · occurred at · created by.
Sortable: `createdAt`, `severity`, `status`. Filters: status, severity, type, userId, branchId
(`violations.read.all` only), date range, `source` (manual vs auto).

Auto-generated violations (from system rules) are visibly marked and are **immutable**
(`AUTO_VIOLATION_IMMUTABLE`) — hide Edit on them rather than letting the user discover it.

## `/violations/new`

Fields: type (`violation-types`, which supplies a default severity and default amount), subject
user, related machine (optional), occurred at, description, severity (pre-filled from the type,
overridable), amount (pre-filled, overridable), evidence photos.

Selecting a type pre-fills severity and amount but does not lock them — the type is a template.

## `/violations/[id]`

Header: reference · type · severity chip · status chip · subject user.
Rail: subject, machine, amount, occurred at, created by, linked finance transaction if charged.
Body: description, evidence gallery, status history.

Actions:

| Action | Gate | Notes |
|---|---|---|
| Acknowledge | subject user, `OPEN` | records that the user has seen it |
| Charge | `violations.resolve`, not already charged | dialog confirms the amount; creates an `AUTO_VIOLATION` finance transaction — **say so**, and invalidate `financeKeys.all` |
| Waive | `violations.waive` | requires a reason |
| Edit | `violations.create`/`update`, manual only | |

`ALREADY_CHARGED` → refresh and show the charge record. Charging is not reversible from this
screen; a mistake is corrected by voiding the finance transaction (`16`), and the UI should say
that rather than implying an undo exists.

## User violation summary

`/users/[id]?tab=violations` uses `users/{id}/violations` plus
`users/{id}/violations/summary` — counts by status and severity, total charged, a trend over the
last six months. This is what a supervisor looks at before a performance conversation, so it needs
to be accurate and legible rather than clever.

## Acceptance

- [ ] Auto violations cannot be edited and are visibly marked.
- [ ] Charging states the finance side effect and invalidates finance queries.
- [ ] Severity and status both have icon + label, never colour alone.
- [ ] Branch filter only for `violations.read.all`.
- [ ] `ALREADY_CHARGED` refreshes cleanly.
