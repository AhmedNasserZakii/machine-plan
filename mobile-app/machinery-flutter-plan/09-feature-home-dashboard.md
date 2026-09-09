# 09 — Feature: Home / Dashboard

## Goal

One screen that answers "what needs me right now?" — and it looks completely different for a
representative than for the Director, because it is assembled from permission-gated blocks.

## Structure

```
features/home/
├── data/
│   ├── models/dashboard_summary_model.dart
│   ├── datasources/home_remote_datasource.dart
│   └── repositories/home_repository.dart
└── presentation/
    ├── cubit/ (home_cubit.dart, home_state.dart)
    ├── pages/home_page.dart
    └── widgets/
        ├── home_app_bar.dart
        ├── home_greeting_header.dart
        ├── pending_transfers_card.dart
        ├── my_custody_card.dart
        ├── quick_actions_grid.dart
        ├── quick_action_tile.dart
        ├── machines_status_summary_card.dart
        ├── machine_status_bar_chart.dart
        ├── finance_summary_card.dart
        ├── budget_alerts_card.dart
        ├── open_violations_card.dart
        ├── maintenance_summary_card.dart
        ├── recent_activity_list.dart
        ├── recent_activity_tile.dart
        ├── warranty_expiring_card.dart
        └── home_skeleton_loader.dart
```

Seventeen widget files for one screen. That is what the separation rule produces, and it is what
makes this screen maintainable when the sixth card gets added.

## Block visibility matrix

| Block | Shown when |
|---|---|
| `PendingTransfersCard` | always (empty state if none) — **first, always** |
| `MyCustodyCard` | role is representative or supervisor |
| `QuickActionsGrid` | always, contents permission-filtered |
| `MachinesStatusSummaryCard` | `machines.read.all` or supervisor |
| `FinanceSummaryCard` | `finance.read` |
| `BudgetAlertsCard` | `finance.read` and at least one budget in WARNING/EXCEEDED |
| `OpenViolationsCard` | `violations.read` (own violations for a rep, branch for a supervisor) |
| `MaintenanceSummaryCard` | `maintenance.read` |
| `WarrantyExpiringCard` | `machines.read.all` |
| `RecentActivityList` | always, scoped by permissions |

## What each role actually sees

**Representative**
1. تسليمات في انتظار توقيعك (the action item)
2. عندك ٢٣ ماكينة — ٤ في إيدك، ١٩ عند تجار
3. إجراءات سريعة: مسح QR · تسليم لتاجر · تسجيل تاجر · استلام من تاجر
4. مخالفاتك المفتوحة (٢)
5. آخر نشاط

**Branch supervisor**
1. تسليمات في انتظار توقيعك
2. ماكينات الفرع حسب الحالة (chart)
3. إجراءات سريعة: تسليم لمندوب · استلام من مندوب · فتح صيانة
4. مخالفات مفتوحة في الفرع
5. صيانة جارية
6. آخر نشاط

**Director**
Everything, with finance and warranty blocks at the top since those are the ones nobody else watches.

## Quick actions (permission-filtered)

| Action | Permission | Route |
|---|---|---|
| مسح QR | `machines.read` | `/machines/scan` |
| تسليم ماكينات | `transfers.create` | `/transfers/create` |
| تسجيل تاجر | `merchants.create` | `/merchants/form` |
| تسجيل مصروف | `finance.create` | `/finance/transactions/form?kind=expense` |
| تسجيل إيراد | `finance.create` | `/finance/transactions/form?kind=income` |
| فتح صيانة | `maintenance.create` | `/maintenance/form` |
| تقرير سريع | `reports.machines` | `/reports` |

Maximum 6 tiles; overflow into a "المزيد" tile.

## Data loading

One endpoint per block, loaded **in parallel** with `Future.wait`, each block rendering
independently. A slow finance query must not block the pending-transfers card.

Each block has three states: skeleton → data → error (with inline retry). Never one page-level
spinner — the most important card should appear as soon as it can.

## Offline behaviour

The dashboard renders from cached local data with a "آخر تحديث: منذ ساعتين" line and the
`OfflineBanner`. Blocks with no cached data show "محتاج اتصال" rather than a spinner.

## Refresh

Pull-to-refresh triggers `SyncService.flush()` then reloads all blocks. Auto-refresh on app resume
if the last load was more than 5 minutes ago.
