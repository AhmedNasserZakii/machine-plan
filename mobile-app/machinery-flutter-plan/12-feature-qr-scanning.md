# 12 — Feature: QR / Barcode Scanning

## Goal

With 1,000 machines and monthly hand-off waves, typing serials is the difference between a
five-minute job and a forty-minute one — and typos in a serial break the whole custody chain.
Scanning is the default input path; manual entry is the fallback that must always exist.

## Where scanning appears

| Context | Behaviour |
|---|---|
| Machines list search | scan → open that machine's detail page |
| Machine form (serial) | scan → fill the field |
| Machine form (battery) | scan → fill the field |
| **Transfer item picker** | **continuous mode** — scan many machines in a row |
| Bulk factory import | continuous mode |
| Maintenance order | scan → select the machine |
| Home quick action | scan → machine detail |

## Structure

```
features/scanning/
└── presentation/
    ├── cubit/ (scanner_cubit.dart, scanner_state.dart)
    ├── pages/
    │   ├── scanner_page.dart             # single-shot
    │   └── continuous_scanner_page.dart  # multi-scan session
    └── widgets/
        ├── scanner_camera_view.dart
        ├── scanner_overlay.dart
        ├── scanner_frame_painter.dart
        ├── scanner_torch_button.dart
        ├── scanner_manual_entry_button.dart
        ├── manual_entry_sheet.dart
        ├── scanned_item_tile.dart
        ├── scanned_items_sheet.dart
        ├── scan_counter_badge.dart
        ├── scan_result_feedback.dart
        └── scanner_permission_denied_view.dart
```

## Single-shot mode

Full-screen camera, dimmed overlay with a clear frame, torch toggle, and — prominently, not hidden —
a "كتابة يدوية" button. Stickers get scratched, faded and covered in grease; manual entry is not an
edge case in this business.

On detection:
1. haptic feedback + a short beep,
2. resolve via `GET /machines/lookup?code=` (or the local cache when offline) — the endpoint matches
   any of the unit's four serials: machine, battery, SIM or box,
3. success → return the machine and pop; not found → `ScanResultFeedback` shows
   "مالقيناش ماكينة بالكود ده" with retry and manual-entry options.

The response carries `matchedOn: MACHINE | BATTERY | SIM | BOX`, and the feedback must say which
one was read — "اتعرفنا عليها من سيريال الشريحة" — because scanning the box barcode of a machine
whose own sticker is unreadable is a legitimate flow, and the user needs to know the code they
scanned was not the machine's own serial. The local cache must index all four columns for the
offline path to behave the same way.

## Continuous mode — the one that matters for hand-offs

The rep is standing in front of a stack of machines. He scans them one after another without
touching the screen between scans.

```
┌──────────────────────────────────────┐
│              [🔦]  [✕]               │
│                                      │
│        ┌────────────────┐            │
│        │                │            │
│        │   [scan frame] │            │
│        │                │            │
│        └────────────────┘            │
│                                      │
│   ✓ SN-00341 — اتضافت                │
│                                      │
├──────────────────────────────────────┤
│  ▲ ١٢ ماكينة اتمسحت      [خلّصت]     │
└──────────────────────────────────────┘
```

- `ScanCounterBadge` shows the running count; tapping opens `ScannedItemsSheet` (a draggable sheet)
  listing everything scanned so far, each removable.
- Duplicate scan → distinct sound + "الماكينة دي متضافة قبل كده"; **not** added twice.
- Ineligible machine (not in your custody, already in transit, decommissioned) → rejected inline
  with the reason. The check runs against the **local cache** so it works offline.
- Debounce 800 ms so one sticker isn't read three times.
- "خلّصت" returns the whole list to the caller.

## Manual entry

`ManualEntrySheet`: a text field with the same validation and the same lookup path. Auto-uppercase,
trim whitespace, strip common OCR confusions if the serial format allows it. Show the resolved
machine's model and current holder before accepting, so the user can confirm they got the right one.

## Permissions & failure states

| State | UI |
|---|---|
| camera permission denied | `ScannerPermissionDeniedView` explaining why and a button to app settings; manual entry stays available |
| camera unavailable | fall straight through to manual entry |
| low light | auto-suggest the torch after 3 seconds without a detection |

Never dead-end the user at a broken camera. Manual entry is always one tap away.

## Technical notes

- Use whatever scanner package the project already has. If none, propose `mobile_scanner` and wait
  for approval (`01`).
- Formats: QR + Code128 + Code39. Configure explicitly — scanning all formats is slower and
  produces more false reads.
- **Dispose the controller** in `dispose()` and pause it when the app backgrounds. A leaked camera
  controller drains the battery of a phone that needs to last a full field day.
- Resolution: `ResolutionPreset.high` is enough; `max` slows detection without helping.
- Keep the screen awake during a continuous session (`WakelockPlus` if the project has it).

## Printing QR labels

Out of scope for the app, but the machine detail page shows a large scannable QR of the serial so a
supervisor can scan a machine from another phone when the physical sticker is gone.
