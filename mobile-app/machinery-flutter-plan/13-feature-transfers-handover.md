# 13 — Feature: Transfers / Hand-offs

> The core workflow of the app. Everything in `07` (offline) and `14` (signatures) exists to serve
> this screen.

## Screens

| Page | Route | Permission |
|---|---|---|
| `TransfersListPage` | `/transfers` | `transfers.read` |
| `TransferDetailPage` | `/transfers/:id` | `transfers.read` |
| `CreateTransferPage` | `/transfers/create` | `transfers.create` |
| `ConfirmTransferPage` | `/transfers/:id/confirm` | `transfers.confirm` |

## Structure

```
features/transfers/
├── data/
│   ├── models/ (transfer_model.dart, transfer_detail_model.dart, transfer_item_model.dart,
│   │            transfer_signature_model.dart, create_transfer_request.dart,
│   │            confirm_transfer_request.dart, item_adjustment_model.dart,
│   │            transfer_type_model.dart)
│   ├── datasources/ (transfers_remote_datasource.dart, transfers_local_datasource.dart)
│   └── repositories/transfers_repository.dart
└── presentation/
    ├── cubit/ (transfers_list_cubit.dart, transfer_detail_cubit.dart,
    │           create_transfer_cubit.dart, confirm_transfer_cubit.dart) + states
    ├── pages/
    └── widgets/
        ├── transfer_card.dart
        ├── transfer_status_chip.dart
        ├── transfer_type_label.dart
        ├── transfers_tab_bar.dart
        ├── transfers_filter_sheet.dart
        ├── pending_transfer_banner.dart
        ├── transfer_parties_header.dart
        ├── transfer_party_tile.dart
        ├── transfer_items_list.dart
        ├── transfer_item_tile.dart
        ├── transfer_item_expanded_details.dart
        ├── transfer_signatures_section.dart
        ├── signature_display_tile.dart
        ├── transfer_notes_section.dart
        ├── transfer_actions_bar.dart
        ├── transfer_type_selector.dart
        ├── transfer_recipient_selector.dart
        ├── machine_picker_sheet.dart
        ├── selected_machines_list.dart
        ├── selected_machine_tile.dart
        ├── item_condition_selector.dart
        ├── item_accessories_checkboxes.dart
        ├── item_photos_row.dart
        ├── item_photo_thumbnail.dart
        ├── battery_scan_field.dart
        ├── battery_mismatch_warning.dart
        ├── transfer_review_summary.dart
        ├── confirm_items_checklist.dart
        ├── confirm_item_adjustment_tile.dart
        ├── reject_transfer_dialog.dart
        └── cancel_transfer_dialog.dart
```

That is thirty widget files. Each is small, testable and reusable. This is the separation rule
paying off — the alternative is a 2,000-line `create_transfer_page.dart` nobody can safely change.

## TransfersListPage

Three tabs (`TransfersTabBar`):
1. **محتاجة توقيعك** — incoming pending. Badge count. This tab opens by default when non-empty.
2. **مستنية الطرف التاني** — outgoing pending.
3. **الكل** — full history with filters.

`PendingTransferBanner` at the top of the app when anything is waiting, tappable from any screen.

## CreateTransferPage — 4 steps

### Step 1 — Type & recipient
`TransferTypeSelector` shows only the types the current user may initiate, derived from their role
and the machines they hold. A representative sees "تسليم لتاجر" and "رجوع للفرع"; he never sees
"تسليم لفرع".

`TransferRecipientSelector` adapts: a user picker (branch-filtered), or a merchant picker with an
inline "تاجر جديد" shortcut that routes to the merchant form and comes back with the result.

**Inter-branch guard:** if the user tries to construct a branch-to-branch move, block it here with
an explanation — "الماكينة لازم ترجع للمخزن الرئيسي الأول" — rather than letting the server reject it
after all the data entry.

### Step 2 — Pick machines
- Big primary button: **"مسح QR"** → continuous scanner (`12`)
- Secondary: `MachinePickerSheet` — searchable list of machines in the user's custody, multi-select
- `SelectedMachinesList` with a count header and swipe-to-remove

Only machines the user actually holds are selectable. The eligibility check runs locally.

### Step 3 — Per-machine details
Each `SelectedMachineTile` expands to:
- `BatteryScanField` — scan or type the battery serial. Compared **locally** against the bonded
  battery; a mismatch shows `BatteryMismatchWarning` immediately:

  > ⚠ البطارية دي مش بتاعة الماكينة دي
  > المتوقع: BT-91223 · اللي اتمسح: BT-88410
  > التسليم هيتقبل بس هيتسجل مخالفة على المندوب.

  **It does not block.** This is the explicit business rule — accept and record, don't refuse.
- `ItemAccessoriesCheckboxes` — شاحن / كرتونة. The carton state defaults to what the machine was
  issued with, so the rep hands it back the same way.
- `ItemConditionSelector` — سليمة / تالفة / مش شغالة
- `ItemPhotosRow` — up to 4 photos, camera or gallery, compressed on capture, removable
- notes

A "طبّق على الكل" action sets the same accessories/condition across all items — with 20 identical
machines, per-item entry is punishing.

### Step 4 — Review & sign
`TransferReviewSummary`: recipient, machine count, a flag count for anything unusual
("٢ ماكينات من غير شاحن، ١ بطارية مختلفة"), then the signature flow (`14`).

## Sending

On submit the whole thing goes to the local DB and the sync queue (`07`). The user sees a success
screen immediately, with a "لسه مترفعتش" chip if offline. **Never** block the field worker on the
network.

## ConfirmTransferPage — the receiving side

This is where the receiver protects himself, so it must be easy to disagree with the sender.

1. `TransferPartiesHeader` — who sent it, when
2. `ConfirmItemsChecklist` — every machine with the sender's declaration, and each row editable via
   `ConfirmItemAdjustmentTile`: "الشاحن مش موجود؟ عدّل هنا"
3. Adjustments are highlighted so the difference between declared and received is visible at a glance
4. `TransferReviewSummary` recomputed from the adjustments
5. Signature (`14`)
6. Submit

Two exits: **تأكيد الاستلام** (with signature) and **رفض التسليمة** (`RejectTransferDialog`, reason
required). Make clear in the UI that rejection is for a delivery that did not physically happen —
individual problems are recorded via adjustments, not rejection.

### PAYLOAD_CHANGED

If the server returns `PAYLOAD_CHANGED`, the transfer was edited after the screen loaded. Show a
blocking dialog, reload, and require the user to review again before signing. Never auto-retry a
signature — the whole point is that the person signed for a specific set of facts.

## TransferDetailPage

Read-only record: parties, items with all flags and photos, signatures with method/time/device,
violations raised, notes, and status history. This is the printable proof of the hand-off.

## Offline

Everything in this feature works offline: create, confirm, reject, sign, photograph. See `07` for
queue behaviour and conflict resolution.
