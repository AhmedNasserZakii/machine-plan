# 12 — Feature: Transfers & Custody Hand-off

Mobile counterpart: `mobile-app/lib/feature/transfers/`. The most rule-heavy feature in the system
and the one where a shortcut costs real money.

## Endpoints

| Method | Path | Screen |
|---|---|---|
| GET | `transfers` | list |
| POST | `transfers` | create |
| GET | `transfers/{id}` | detail |
| POST | `transfers/validate` | live validation in the create wizard |
| GET | `transfers/creatable-types` | which types this user may start |
| GET | `transfers/recipients` | recipient picker |
| GET | `transfers/pending/incoming` | inbox + dashboard |
| GET | `transfers/pending/outgoing` | outbox + dashboard |
| POST | `transfers/{id}/confirm` | confirm |
| POST | `transfers/{id}/reject` | reject |
| POST | `transfers/{id}/cancel` | cancel |
| GET | `transfers/{id}/signatures/{signatureId}/media` | signature image |
| POST | `media/presign` · `media/confirm` · `media/upload` | photos + signature |

## Vocabulary

**Types**: `FACTORY_TO_COMPANY`, `COMPANY_TO_BRANCH`, `BRANCH_TO_REPRESENTATIVE`,
`REPRESENTATIVE_TO_MERCHANT`, `MERCHANT_TO_REPRESENTATIVE`, `REPRESENTATIVE_TO_BRANCH`,
`BRANCH_TO_COMPANY`, `COMPANY_TO_MAINTENANCE`, `MAINTENANCE_TO_COMPANY`, `COMPANY_TO_FACTORY`,
`FACTORY_TO_COMPANY_RETURN`, `COMPANY_TO_SERVICE_CENTER`, `SERVICE_CENTER_TO_COMPANY`,
`COMPANY_TO_SCRAP`.

**Statuses**: `PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`.

**Never hardcode the type list in the UI.** `GET transfers/creatable-types` returns what this
caller may start, with `allowedFromStatuses` and `receiverKind` per type. The wizard is built from
that response. A hardcoded list goes stale the moment the backend adds a type.

## `/transfers` — list

Three views over one table, as URL state (`?view=all|incoming|outgoing`):

- **Incoming** — awaiting my confirmation. The default view when the user holds
  `transfers.confirm`, because it is the thing that needs them.
- **Outgoing** — sent by me, awaiting the other side.
- **All** — full history.

Columns: reference no (sticky, mono) · type · status chip · from party · to party · machine count ·
created at · age (a pending transfer older than the stuck threshold gets a warning tone) ·
confirmed at.

Filters: `direction` · `status` (multi) · `type` (multi, from `creatable-types` plus historical) ·
date range · `machineId` (async) · `branchId` (`transfers.read.all` only).

Row actions on a `PENDING` row, gated: Confirm (`transfers.confirm`) · Reject (`transfers.reject`) ·
Cancel (`transfers.cancel`, creator only, within the cancel window).

## `/transfers/new` — create wizard

Four steps, each validated before the next. **Nothing is submitted until step 4.**

### 1 — Type and recipient
`creatable-types` drives the type list. Choosing a type sets `receiverKind`, which drives the
recipient source: `transfers/recipients?type=…` for users/warehouses, `merchants/pickable` for
merchants. Recipients are an async searchable combobox showing name + subtitle (the branch, or
null for a warehouse).

`INTER_BRANCH_DIRECT_TRANSFER_NOT_ALLOWED` is a real rule: a representative in Alexandria cannot
hand directly to one in Cairo; it goes through the company. Surface this as an explanation at the
recipient step, not as a failure at submit.

### 2 — Machines
Add by serial (paste or scan), or pick from a filtered list of machines currently in the caller's
custody whose status is in `allowedFromStatuses` for the chosen type.

Per machine, show the accessory checks the contract supports:
`batterySerialScanned` / `batteryMatches`, `simSerialScanned` / `simMatches`,
`boxSerialScanned` / `boxMatches`. A mismatch is a **warning with an explicit acknowledgement**,
not a silent pass — handing over a machine with the wrong battery is exactly what this field is
for.

Call `POST transfers/validate` (debounced) on every list change and render per-machine results
inline. That endpoint is exempt from idempotency precisely so it can be called freely.

Blocking codes here: `INVALID_MACHINE_STATUS`, `NOT_IN_YOUR_CUSTODY`, `MACHINE_ALREADY_IN_TRANSIT`,
`MACHINE_RETIRED`. Each renders on the offending row with the machine's serial, not as a page-level
error.

### 3 — Evidence
- **Photos** — up to the server's limit (`TOO_MANY_PHOTOS`); compress client-side per `05`;
  thumbnail grid with remove; presign → PUT → confirm, with real progress.
- **Signature** — a canvas pad (`<SignaturePad>`, pointer events, undo, clear, guide line),
  exported as PNG and uploaded through the same media endpoints. This is the desk substitute for
  the mobile fingerprint flow. **The contract does not change** — the server receives a signature
  media id either way.
- **Self-attested** — where the contract allows `selfAttested` (a warehouse or factory party that
  cannot sign), show it as an explicit checkbox with its consequence spelled out, never as a
  default.
- `SIGNATURE_REQUIRED` from the server means step 3 was skippable when it should not have been —
  fix the client rule, and handle the error anyway.

### 4 — Review and submit
Full read-only summary. One idempotency key generated when the wizard reaches step 4 and reused on
every retry (`05`). Wizard state persists in `sessionStorage` so a refresh mid-wizard does not
lose twenty scanned serials.

## `/transfers/[id]` — detail

Header: reference no · type · status chip · created by · created at.
Parties: from and to, with kind icons. Machines: table with per-item accessory match results.
Evidence: photo lightbox, signature images (fetched via
`transfers/{id}/signatures/{signatureId}/media`), self-attested marker.
Timeline: created → confirmed / rejected / cancelled, with actor and timestamp.

Actions:

- **Confirm** — a dialog that restates what is being received, requires a signature if the
  contract requires one, and warns that it is irreversible. `PAYLOAD_CHANGED` (the transfer was
  edited since it was loaded) → refresh and re-present. `TRANSFER_NOT_PENDING` → refresh; someone
  else acted.
- **Reject** — requires a reason. Machines return to the sender's custody.
- **Cancel** — creator only, `PENDING` only, within the window. `CANCEL_WINDOW_EXPIRED` explains
  that it must now be rejected by the recipient instead.
- **Print receipt** — web-only, and genuinely wanted: a printable hand-off sheet with parties,
  machines, serials, signature images and timestamps. `print.css` (`03`).

## Invalidation

Confirm / reject / cancel invalidates: this transfer, both pending lists, all transfer lists,
`machineKeys.all` (custody moved), the dashboard and the notification count (`07`).

## Rules

- **No optimistic updates** on any transfer action (`07`). A rolled-back "confirmed" is a lie
  about custody.
- The confirm dialog is the one place a `ConfirmDialog` is not enough — show the machine list
  again inside it. Users confirm the wrong transfer otherwise.
- A stale `PENDING` row that has already been acted on elsewhere must resolve cleanly: catch
  `TRANSFER_NOT_PENDING`, refetch, and show what actually happened.

## Acceptance

- [ ] Type list comes from `creatable-types`, never hardcoded.
- [ ] `transfers/validate` runs live and reports per machine.
- [ ] Accessory mismatches require explicit acknowledgement.
- [ ] Signature pad produces an upload accepted by the same media endpoints as mobile.
- [ ] One idempotency key per wizard submission, reused across retries.
- [ ] `PAYLOAD_CHANGED` (409) refreshes; `INVALID_MACHINE_STATUS` (422) explains — different UI.
- [ ] Wizard survives a page refresh.
- [ ] Receipt prints correctly in both locales.
