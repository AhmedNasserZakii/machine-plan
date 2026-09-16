# 11 — Feature: Machines

Mobile counterpart: `mobile-app/lib/feature/machines/`. The largest read surface in the product.

## Endpoints

| Method | Path | Screen |
|---|---|---|
| GET | `machines` | list |
| POST | `machines` | create |
| GET | `machines/{id}` | detail |
| PATCH | `machines/{id}` | edit |
| POST | `machines/bulk` | bulk import |
| GET | `machines/by-serial/{serial}` | serial lookup |
| GET | `machines/lookup` | command palette / scanner resolve |
| GET | `machines/{id}/timeline` | timeline tab |
| GET | `machines/{id}/cost-summary` | costs tab |
| GET | `machines/{id}/maintenance-history` | maintenance tab |
| GET | `machines/{id}/replacement-chain` | chain tab |
| GET | `machine-types`, `machine-models` | form + filters |

`replace`, `decommission`, `decommission/revert`, `decommission-candidates` belong to `14`.

## Statuses

`IN_COMPANY_WAREHOUSE`, `IN_BRANCH_WAREHOUSE`, `WITH_SUPERVISOR`, `WITH_REPRESENTATIVE`,
`WITH_MERCHANT`, `IN_TRANSIT`, `UNDER_MAINTENANCE`, `AT_FACTORY`, `AT_SERVICE_CENTER`,
`DECOMMISSIONED`, `REPLACED`. Tones in `03`; labels in `enums.machineStatus.*` (`04`).

Holder types: `FACTORY`, `WAREHOUSE`, `SUPERVISOR`, `REPRESENTATIVE`, `MERCHANT`, `SERVICE_CENTER`.

## `/machines` — list

The reference implementation of `DataTable` + `FilterBar`. Build this screen first and well;
every other list copies it.

**Columns** (visibility-configurable, identifier column locked):
serial (`<SerialText>`, sticky) · status chip · model · type · holder (`<HolderChip>`) ·
branch · warranty end (with a "expiring" warning tone under 30 days) · total repair cost
(`<Money>`) · repair count · purchase date · created at.

**Sortable** (endpoint whitelist): `createdAt`, `serial`, `status`, `warrantyEnd`, `totalRepairCost`.
Nothing else is clickable.

**Filters**: `search` (serial / battery / SIM / box — one box, `dir="auto"`) · `status` (multi) ·
`machineTypeId` · `machineModelId` · `holderType` · `holderId` (async combobox, dependent on
holderType) · `branchId` (`machines.read.all` only) · `warrantyExpiringBefore` (date) ·
`minRepairCost` · `includeRetired` (toggle, default off).

**Actions**: New machine (`machines.create`) · Bulk import (`machines.import`) ·
Export current view (`reports.export`).

**Bulk selection** (web-only power feature): with rows selected, offer *Export selected* and
*Open maintenance order for selected* — the latter loops `POST maintenance-orders`, one idempotency
key per machine, with a visible per-row progress list and a partial-failure summary. Do not
pretend a partial failure succeeded.

## `/machines/[id]` — detail

Header: serial (large, mono, copyable) · status chip · model + type · holder · primary actions.

Rail: purchase (price, date, supplier, invoice no) · warranty (start, end, days remaining, tone) ·
cost summary (total repair cost, repair count, cost-vs-price %) · QR (render `qrPayload` with
`qrcode.react`, printable sticker layout).

Tabs (`?tab=`):

| Tab | Source | Notes |
|---|---|---|
| overview | `machines/{id}` | identity, custody, notes |
| timeline | `machines/{id}/timeline` | vertical event feed, keyset-paginated, icon+tone per event type |
| maintenance | `machines/{id}/maintenance-history` | table of orders, links into `14` |
| costs | `machines/{id}/cost-summary` | breakdown + cost-vs-price gauge |
| chain | `machines/{id}/replacement-chain` | predecessor/successor graph (`14`) |

Actions, each permission- **and** state-gated:
Edit (`machines.update`) · Create transfer with this machine (`transfers.create`, only if in the
caller's custody and not `IN_TRANSIT`) · Open maintenance order (`maintenance.create`, not already
`UNDER_MAINTENANCE`) · Replace (`maintenance.update`) · Decommission (`machines.decommission`,
only when in a warehouse and no open order) · Print QR.

A state-blocked action stays **visible and disabled with a tooltip explaining why** — that is the
one exception to the `<Can>` rule in `06`, because "you can't because it's in transit" is
information the user needs.

## Machine form (`/new`, `/[id]/edit`)

Sections: identity (serial, battery serial, SIM serial, box serial) · classification (type →
model, dependent selects) · purchase (supplier, invoice no, price, date) · warranty (start, end) ·
assignment (branch, warehouse — create only) · notes.

Business rules that must be in the zod schema, not just on the server:

- `simSerial` is **required** when the selected machine type has `requiresSim === true`, and
  **rejected** when false. The field is hidden entirely when false — a PIN pad has no mobile line.
- `boxSerial` is optional for every type; not every factory prints one.
- `serial` is **immutable after creation** — disabled on edit with a tooltip. The server enforces
  it with `SERIAL_IMMUTABLE`; do not let the user type into a field that will be rejected.
- `warrantyEnd > warrantyStart`; `purchaseDate` not in the future.
- `purchasePrice > 0`.

Error mapping: `SERIAL_EXISTS` / `BATTERY_SERIAL_EXISTS` / `SIM_SERIAL_EXISTS` /
`BOX_SERIAL_EXISTS` each map to their own field with a link to the conflicting machine — the user
almost always wants to look at it.

## `/machines/import` — bulk import (web-only, high value)

`POST machines/bulk`. This is the flow that justifies the web app on its own: registering 200
machines from a factory delivery on a phone is not reasonable.

Wizard:

1. **Upload** — drag-drop CSV or XLSX. Provide a downloadable template with the exact headers,
   localized in the current locale, with an example row.
2. **Map columns** — auto-match by header name, let the user correct. Remember the mapping in
   `localStorage` for next time.
3. **Validate client-side** — required fields, serial format, duplicates *within the file*,
   `requiresSim` consistency per selected type. Show an error table with row numbers; let the user
   fix inline and re-validate without re-uploading.
4. **Preview** — first 20 rows as they will be sent, plus totals.
5. **Submit in chunks** of 50 with one idempotency key per chunk, a progress bar, and a
   per-chunk result.
6. **Result** — created / skipped / failed counts, a failures table with the server's per-row
   error code and message, and a "download failures as CSV" so the user can fix and re-import
   only those.

Never re-submit a succeeded chunk on retry: keep the chunk keys, resend only the failed ones.

## Command palette lookup

`Ctrl/Cmd+K` → typing something serial-shaped queries `machines/lookup`, which reports
`matchedOn: MACHINE | BATTERY | SIM | BOX`. Show which serial matched — "found by battery serial"
is important context — and navigate on Enter. This is the desk replacement for QR scanning (`12`).

## Acceptance

- [ ] Table: sorting only on whitelisted fields; filters and page in the URL; selection clears on
      filter change.
- [ ] `requiresSim` drives the SIM field in both directions.
- [ ] `serial` is not editable after creation.
- [ ] Each of the four serial-conflict codes maps to its own field with a link to the conflict.
- [ ] Bulk import handles a partial failure honestly and allows a failures-only re-import.
- [ ] Detail actions are gated by permission **and** machine status.
- [ ] Serials render LTR everywhere, including inside Arabic sentences.
