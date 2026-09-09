# 16 — Feature: Maintenance, Replacement & Decommission

## Screens

| Page | Route | Permission |
|---|---|---|
| `MaintenanceListPage` | `/maintenance` | `maintenance.read` |
| `MaintenanceDetailPage` | `/maintenance/:id` | `maintenance.read` |
| `MaintenanceFormPage` | `/maintenance/form` | `maintenance.create` |
| `CloseMaintenancePage` | `/maintenance/:id/close` | `maintenance.close` |
| `ReplacementFormPage` | `/machines/:id/replace` | `machines.create` |
| `DecommissionPage` | `/machines/:id/decommission` | `machines.decommission` |
| `DecommissionCandidatesPage` | `/machines/candidates` | `machines.read` |

## Structure

```
features/maintenance/
├── data/
│   ├── models/ (maintenance_order_model.dart, maintenance_detail_model.dart,
│   │            close_maintenance_request.dart, replacement_request.dart,
│   │            decommission_request.dart, decommission_candidate_model.dart)
│   ├── datasources/maintenance_remote_datasource.dart
│   └── repositories/maintenance_repository.dart
└── presentation/
    ├── cubit/ (maintenance_list_cubit.dart, maintenance_detail_cubit.dart,
    │           maintenance_form_cubit.dart, close_maintenance_cubit.dart,
    │           replacement_cubit.dart, decommission_cubit.dart,
    │           decommission_candidates_cubit.dart) + states
    ├── pages/
    └── widgets/
        ├── maintenance_card.dart
        ├── maintenance_status_chip.dart
        ├── maintenance_location_chip.dart
        ├── maintenance_filter_sheet.dart
        ├── maintenance_header_section.dart
        ├── maintenance_machine_card.dart
        ├── maintenance_fault_section.dart
        ├── maintenance_timeline_section.dart
        ├── maintenance_cost_section.dart
        ├── warranty_status_banner.dart
        ├── maintenance_form_fields.dart
        ├── location_selector.dart
        ├── fault_description_field.dart
        ├── close_cost_fields.dart
        ├── free_warranty_switch.dart
        ├── responsible_party_selector.dart
        ├── responsible_person_picker.dart
        ├── maintenance_result_selector.dart
        ├── finance_posting_preview.dart
        ├── replacement_form_fields.dart
        ├── replacement_chain_preview.dart
        ├── decommission_reason_selector.dart
        ├── decommission_cost_snapshot_card.dart
        ├── decommission_confirm_dialog.dart
        ├── candidate_machine_card.dart
        └── cost_ratio_indicator.dart
```

## MaintenanceFormPage (open an order)

Fields: machine (scan or pick — restricted to machines in the company warehouse), location
(`LocationSelector`: الورشة الداخلية / المصنع / مركز صيانة خارجي), fault description, sent date, notes.

`WarrantyStatusBanner` appears as soon as a machine is selected:

> 🟢 الماكينة لسه في الضمان لحد ١٠/٠٢/٢٠٢٦ — الصيانة المفروض مجانية

or

> 🔴 الضمان خلص من ٧ شهور — الصيانة هتتحسب بفلوس

This is the single most useful thing on the screen, because it decides whether money is about to be
spent.

## CloseMaintenancePage — where the money is decided

Steps:

1. `MaintenanceResultSelector` — اتصلحت / اتبدلت / مش قابلة للإصلاح
2. `FreeWarrantySwitch` — pre-set from the server's suggestion, **overridable**, with a note
   explaining that some faults are not covered even inside the warranty
3. `CloseCostFields` — cost (hidden and forced to zero when free), supplier, invoice photo
4. `ResponsiblePartySelector` — الشركة / المندوب / التاجر / المصنع
   - "المندوب" → `ResponsiblePersonPicker` filtered to reps who held this machine
   - "التاجر" → picker filtered to merchants who held it
5. `FinancePostingPreview` — **this is important**. Before submitting, show exactly what will happen
   to the books:

   > 💰 اللي هيحصل:
   > • هيتسجل مصروف ٤٥٠ ج.م تحت قسم "صيانة"
   > • من حساب: الشركة

   or

   > 💰 اللي هيحصل:
   > • هيتسجل مخالفة على أحمد سالم بمبلغ ٤٥٠ ج.م
   > • الفلوس هتتحسب لما المخالفة تتحصّل

   Nobody should discover after the fact that closing a maintenance order created a financial
   record. Show it first.

6. Result → اتبدلت routes into `ReplacementFormPage` before closing.

## ReplacementFormPage

For when the factory returns a **different serial**.

Fields: new serial (+ scan), new battery serial (+ scan), new warranty dates, has box, reason.

`ReplacementChainPreview` shows what the chain will look like afterwards:

```
SN-00341  ──►  SN-00712
(القديمة)      (الجديدة)
٣ صيانات       جديدة
١٨٥٠ ج.م
```

Explanatory note: "الماكينة القديمة هتتقفل والجديدة هتبدأ من المخزن الرئيسي — لازم تسلّمها للفرع من
تاني." This surprises people otherwise.

## DecommissionPage

1. `DecommissionCostSnapshotCard` — the full economics, chain-aware:

```
┌───────────────────────────────────────┐
│ سعر الشراء            ٤٢٠٠ ج.م         │
│ إجمالي التصليحات       ٣٤٠٠ ج.م         │
│ عدد مرات التصليح           ٦            │
│ العمر                  ٣١ شهر          │
│                                       │
│ ████████████████░░░░  ٨١٪              │
│ التصليحات وصلت ٨١٪ من سعر الماكينة     │
└───────────────────────────────────────┘
```

2. `DecommissionReasonSelector` + mandatory notes
3. Optional signature
4. `DecommissionConfirmDialog` — explicit and final: "الماكينة هتتنقل لمخزن التالف ومش هينفع
   تتحرك تاني. متأكد؟"

Preconditions are checked before the screen opens; if the machine is not in the company warehouse,
show why and what to do instead.

## DecommissionCandidatesPage

The proactive list. `CandidateMachineCard` with `CostRatioIndicator` (a bar that turns amber then
red), sortable by cost ratio, repair count or age. Adjustable thresholds at the top.

Framed as a **suggestion**, never an instruction: header reads "ماكينات محتاجة مراجعة" not
"ماكينات لازم تتشال". Every card links to the full machine detail so the decision is informed.

## Rules

1. Opening a maintenance order requires the machine to be in the company warehouse — enforced in the
   picker, not just by the server.
2. Cost is required unless free-under-warranty.
3. Internal workshop technicians are not app users in v1 — the supervisor records the outcome, with
   an optional "اسم الفني" free-text field.
4. This whole feature is **online-only**. It happens at the warehouse, and it moves money.
5. Decommission cannot be undone from the app. If asked, direct the user to the Director.
