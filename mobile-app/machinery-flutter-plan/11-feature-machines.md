# 11 — Feature: Machines

## Screens

| Page | Route | Permission |
|---|---|---|
| `MachinesListPage` | `/machines` | `machines.read` |
| `MachineDetailPage` | `/machines/:id` | `machines.read` |
| `MachineFormPage` | `/machines/form` | `machines.create` / `machines.update` |
| `MachineTimelinePage` | `/machines/:id/timeline` | `machines.read` |
| `MachineBulkImportPage` | `/machines/import` | `machines.import` |

## Structure

```
features/machines/
├── data/
│   ├── models/ (machine_model.dart, machine_detail_model.dart, battery_model.dart,
│   │            machine_type_model.dart, machine_model_model.dart,
│   │            timeline_event_model.dart, cost_summary_model.dart,
│   │            replacement_chain_model.dart, machines_filter.dart)
│   ├── datasources/ (machines_remote_datasource.dart, machines_local_datasource.dart)
│   └── repositories/machines_repository.dart
└── presentation/
    ├── cubit/ (machines_list_cubit.dart, machine_detail_cubit.dart,
    │           machine_form_cubit.dart, machine_timeline_cubit.dart,
    │           machine_bulk_import_cubit.dart) + states
    ├── pages/
    └── widgets/
        ├── machine_card.dart
        ├── machine_status_chip.dart
        ├── machine_serial_text.dart          ← LTR-wrapped serial (see 03)
        ├── machines_search_bar.dart
        ├── machines_filter_sheet.dart
        ├── machines_filter_chips.dart
        ├── machines_empty_state.dart
        ├── machine_header_section.dart
        ├── machine_info_section.dart
        ├── machine_battery_section.dart
        ├── machine_holder_card.dart
        ├── machine_warranty_card.dart
        ├── machine_cost_summary_card.dart
        ├── machine_repair_cost_bar.dart
        ├── machine_replacement_chain_card.dart
        ├── replacement_chain_tile.dart
        ├── machine_timeline_list.dart
        ├── timeline_event_tile.dart
        ├── timeline_event_icon.dart
        ├── machine_actions_sheet.dart
        ├── machine_form_fields.dart
        ├── battery_form_fields.dart
        ├── warranty_date_range_field.dart
        ├── bulk_import_row_tile.dart
        └── bulk_import_summary_card.dart
```

## MachinesListPage

- `MachinesSearchBar` with a **scan button** on the trailing side (see `12`) — scanning is the
  primary way people find a machine, typing is the fallback.
- `MachinesFilterChips` showing active filters, each removable with one tap.
- `MachinesFilterSheet`: status (multi), type, model, branch, holder type, warranty expiring,
  has open maintenance, minimum repair cost.
- Infinite scroll via the shared `PaginatedListView`.
- Results from the local cache first, refreshed from the network in the background.

### MachineCard

```
┌──────────────────────────────────────────┐
│ SN-00341            [مع تاجر] 🟢          │
│ POS Terminal — موديل X200                 │
│ 🔋 BT-91223                               │
│ 👤 محل النور (عن طريق أحمد سالم)          │
│ 📅 من ١١/٠٤/٢٠٢٦ · ⚠ ٣ صيانات             │
└──────────────────────────────────────────┘
```

Status carries a colour **and** an icon **and** a label (`03`).

## MachineDetailPage

Sections in order — each a separate widget file:
1. `MachineHeaderSection` — serial (LTR), model, status chip, QR button
2. `MachineHolderCard` — where it is now, who is responsible, since when, the custody chain
   (merchant + the rep behind them)
3. `MachineInfoSection` — type, model, manufacturer, has box, purchase price and date
4. `MachineIdentitySection` — the four serials of one unit: machine, battery, SIM and box, each
   LTR, each copyable on long-press, each with a lock icon because none of them can be edited.
   Battery keeps its explanatory text about the permanent bond; SIM shows
   "الشريحة جزء من هوية الماكينة — لو اتغيرت يبقى استبدال" and is hidden entirely for a type whose
   `requiresSim` is false (a PIN pad). Box serial shows "—" when the factory printed none, which is
   normal and must not look like missing data.
5. `MachineWarrantyCard` — window, days remaining, colour-coded, "الصيانة مجانية لحد ١٠/٠٢/٢٠٢٦"
6. `MachineCostSummaryCard` — purchase price vs cumulative repair cost with
   `MachineRepairCostBar`, repair count, cost ratio, recommendation chip
7. `MachineReplacementChainCard` — only when part of a chain; horizontal list of
   `ReplacementChainTile`s with the current one highlighted
8. `MachineTimelineList` — last 5 events + "شوف الكل"
9. `MachineActionsSheet` — permission-filtered actions

### Actions

| Action | Permission | Also requires |
|---|---|---|
| تسليم | `transfers.create` | machine in the caller's custody |
| فتح صيانة | `maintenance.create` | machine in the company warehouse |
| تعديل البيانات | `machines.update` | |
| إخراج من الخدمة | `machines.decommission` | machine in the company warehouse |
| طباعة QR | `machines.read` | |

Disabled actions show **why** in a subtitle ("لازم الماكينة تكون في المخزن الرئيسي") rather than
being greyed out silently.

## MachineFormPage

All four serial fields are **read-only in edit mode** with a lock icon and the note
"السيريال مايتغيرش — لو المصنع بدّل الماكينة اعمل استبدال". The backend rejects a `PATCH` carrying
any of them with `422 SERIAL_IMMUTABLE`, so the form must not offer them at all rather than let a
user type and then fail.

Fields: serial (+ scan), model, type (auto-filled from model), battery serial (+ scan),
**SIM serial (+ scan)**, **box serial (+ scan)**, purchase price, purchase date, factory invoice no,
warranty start/end (`WarrantyDateRangeField`), has box, notes.

The SIM field is driven by the selected model's type:

- `requiresSim = true` → the field is visible and required. Submitting it empty is caught client-side
  before the request, and the server's
  `details: [{ field: 'simSerial', constraint: 'required for this machine type' }]` paints onto the
  same field if it ever gets through.
- `requiresSim = false` (PIN pad) → the field is **hidden and cleared**, because the server rejects a
  SIM serial for such a type. Changing the model after typing a SIM must clear it, otherwise the
  user gets a 400 for a value they can no longer see.

Box serial is optional for every type. `hasBox` stays a separate switch: `boxSerial` is *which*
carton, `hasBox` is whether it is currently with the machine — do not merge the two controls.

## MachineTimelinePage

Vertical timeline, newest first, grouped by month. Each `TimelineEventTile` shows an icon coloured
by event type, title, actors ("من محمود عادل إلى أحمد سالم"), timestamp, and expands to reveal
details — condition, charger/box flags, battery match, cost, photos, signatures.

Uses `occurredAt` for ordering, not `createdAt` (see `07`).

## MachineBulkImportPage

Factory intake. Add rows manually or scan repeatedly; each `BulkImportRowTile` shows serial,
battery serial, SIM serial and box serial with inline validation and a duplicate check against local
data — including against the other rows in the same batch, since the server rejects the whole batch
on one duplicate. Submit sends the
whole batch; on partial failure the server returns per-row errors which are painted onto the rows.
`BulkImportSummaryCard` shows counts before submit.

## Offline

Fully readable offline from the local cache. Creating and editing machines is **online-only** —
factory intake happens at the warehouse where there is a connection.

## Rules

1. Serials always render LTR inside Arabic text (`MachineSerialText`) — all four of them.
1b. A machine card shows the machine serial only. The SIM and box serials belong on the detail
   page: putting four serials on a list tile makes the one people actually search by harder to find.
2. Cost ratio uses **chain totals** when the machine is part of a replacement chain.
3. Never show a raw status enum — always the localized label.
