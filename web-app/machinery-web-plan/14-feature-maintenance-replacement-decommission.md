# 14 — Feature: Maintenance, Replacement & Decommission

Mobile counterpart: `mobile-app/lib/feature/maintenance/` (8 screens). Three related lifecycles
sharing one section of the app.

## Endpoints

| Method | Path | Screen |
|---|---|---|
| GET/POST | `maintenance-orders` | list / create |
| GET/PATCH | `maintenance-orders/{id}` | detail / edit |
| POST | `maintenance-orders/{id}/send` | send to location |
| POST | `maintenance-orders/{id}/receive` | receive back |
| POST | `maintenance-orders/{id}/close` | close with cost |
| POST | `maintenance-orders/{id}/cancel` | cancel |
| GET/POST | `maintenance-locations` | lookup (`19`) |
| POST | `machines/{id}/replace` | replacement |
| GET | `machines/{id}/replacement-chain` | chain view |
| GET | `replacements` | replacement history |
| GET/POST | `machines/{id}/decommission` | decommission |
| POST | `machines/{id}/decommission/revert` | revert |
| GET | `machines/decommission-candidates` | candidates |
| GET | `decommissions` | history |
| GET/POST | `decommission-reasons` | lookup (`19`) |

## Maintenance order lifecycle

`OPEN → IN_PROGRESS → RETURNED → CLOSED`, with `CANCELLED` reachable from `OPEN`/`IN_PROGRESS`.
Destination kinds: `COMPANY`, `REPRESENTATIVE`, `MERCHANT`, `FACTORY`.

The UI models this as an explicit stepper on the detail page. **The available action is a function
of the current status**, never of a guess:

| Status | Action | Permission |
|---|---|---|
| `OPEN` | Send to location | `maintenance.update` |
| `IN_PROGRESS` | Receive back | `maintenance.update` |
| `RETURNED` | Close with cost | `maintenance.close` + `maintenance.set_cost` |
| `OPEN`/`IN_PROGRESS` | Cancel | `maintenance.update` |

### `/maintenance` — list
Columns: order no (sticky) · machine serial · status chip · location · sent at · returned at ·
cost (`<Money>`) · fault description · created by.
Sortable: `sentAt`, `createdAt`, `cost`. Filters: status, location, date range, machineId, branch.

### `/maintenance/new`
Machine picker (async; blocked if already `UNDER_MAINTENANCE` → `MACHINE_ALREADY_IN_MAINTENANCE`),
fault description, reported-by, location, expected return, notes.

### `/maintenance/[id]`
Header: order no, status chip, machine link, stepper.
Rail: machine identity, location, dates, cost, linked finance transaction.
Body: fault description, work notes, parts, photos, status history.

**Close** requires a cost (`COST_REQUIRED`). The close dialog states plainly that closing creates
an `AUTO_MAINTENANCE` finance transaction — the user should not discover that on the accountant's
screen. Invalidate `financeKeys.all` after closing (`07`).

If the fault requires a machine swap, closing may carry a replacement payload
(`REPLACEMENT_PAYLOAD_REQUIRED`) — the close form offers "replace this machine" and collects the
replacement machine there.

## Replacement

`POST machines/{id}/replace` swaps a machine at a merchant, preserving the placement. The form
takes the replacement machine (must be available and in the right custody), the reason, and
optional photos.

`/maintenance/replacements` lists history. Each machine detail's **chain tab** renders the
predecessor → successor graph from `replacement-chain` as a horizontal stepper with each link's
date and reason. `MACHINE_ALREADY_REPLACED` means the chain already moved on — refresh.

## Decommission

The end of a machine's life, and the hardest thing in the app to undo.

`/maintenance/decommissions` has two tabs: **candidates** (`machines/decommission-candidates` —
machines whose repair cost is approaching or exceeding their value, with the cost-vs-price
percentage shown) and **history** (`decommissions`).

Decommission form: reason (`decommission-reasons`), notes, photos, final disposition.

Preconditions, checked client-side **and** handled from the server:

| Code | Meaning | UI |
|---|---|---|
| `MACHINE_NOT_IN_WAREHOUSE` | must be back in a warehouse first | explain, link to the transfer wizard |
| `OPEN_MAINTENANCE_ORDER` | close the order first | link to the order |
| `ALREADY_DECOMMISSIONED` | already done | refresh, show the record |

The confirm dialog requires **typing the machine serial** — the one `ConfirmDialog` variant that
demands typed confirmation (`08`). It states the cost-vs-price figure and that the machine leaves
the active fleet.

**Revert** (`decommission/revert`) exists for mistakes and is gated on `machines.decommission`.
Surface it on the decommission record for a limited window, with the same seriousness.

## Acceptance

- [ ] Actions derive from status, not from a guess; an illegal action is not offered.
- [ ] Closing an order states the finance side effect and invalidates finance queries.
- [ ] `COST_REQUIRED` and `REPLACEMENT_PAYLOAD_REQUIRED` are handled in the close form.
- [ ] All three decommission preconditions have a specific message and a way forward.
- [ ] Decommission requires typing the serial.
- [ ] Replacement chain renders correctly for a machine replaced more than once.
