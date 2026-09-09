# 18 — Feature: Finance (expenses, income, categories, budgets)

## Goal

Record every pound in and out, under a tree of categories that nests as deep as needed, filterable
by any date range, with per-category reporting and optional budgets. Visible only to whoever the
Director allows.

## Screens

| Page | Route | Permission |
|---|---|---|
| `FinanceOverviewPage` | `/finance` | `finance.read` |
| `TransactionsListPage` | `/finance/transactions` | `finance.read` |
| `TransactionDetailPage` | `/finance/transactions/:id` | `finance.read` |
| `TransactionFormPage` | `/finance/transactions/form` | `finance.create` |
| `CategoriesPage` | `/finance/categories` | `finance.read` |
| `CategoryFormPage` | `/finance/categories/form` | `finance.categories.manage` |
| `BudgetsPage` | `/finance/budgets` | `finance.read` |
| `BudgetFormPage` | `/finance/budgets/form` | `finance.budgets.manage` |
| `CategoryBreakdownPage` | `/finance/breakdown` | `finance.read` |

## Structure

```
features/finance/
├── data/
│   ├── models/ (transaction_model.dart, transaction_detail_model.dart,
│   │            finance_category_model.dart, category_tree_node.dart,
│   │            budget_model.dart, budget_status_model.dart,
│   │            finance_summary_model.dart, category_breakdown_model.dart,
│   │            payment_method_model.dart, supplier_model.dart,
│   │            create_transaction_request.dart, finance_filter.dart)
│   ├── datasources/ (finance_remote_datasource.dart, finance_local_datasource.dart)
│   └── repositories/finance_repository.dart
└── presentation/
    ├── cubit/ (finance_overview_cubit.dart, transactions_list_cubit.dart,
    │           transaction_form_cubit.dart, categories_cubit.dart,
    │           category_form_cubit.dart, budgets_cubit.dart,
    │           category_breakdown_cubit.dart) + states
    ├── pages/
    └── widgets/
        ├── finance_summary_header.dart
        ├── income_expense_toggle.dart
        ├── net_balance_card.dart
        ├── period_selector.dart
        ├── date_range_picker_sheet.dart
        ├── transaction_card.dart
        ├── transaction_kind_icon.dart
        ├── transaction_amount_text.dart
        ├── transactions_filter_sheet.dart
        ├── transactions_empty_state.dart
        ├── transaction_form_fields.dart
        ├── amount_input_field.dart
        ├── category_picker_field.dart
        ├── category_picker_sheet.dart
        ├── category_tree_tile.dart
        ├── category_breadcrumb.dart
        ├── payment_method_selector.dart
        ├── supplier_picker_field.dart
        ├── invoice_photo_picker.dart
        ├── invoice_photo_preview.dart
        ├── transaction_source_badge.dart
        ├── void_transaction_dialog.dart
        ├── category_tree_view.dart
        ├── category_node_tile.dart
        ├── category_form_fields.dart
        ├── category_translations_fields.dart
        ├── category_parent_picker.dart
        ├── system_category_badge.dart
        ├── budget_card.dart
        ├── budget_progress_bar.dart
        ├── budget_pace_indicator.dart
        ├── budget_status_chip.dart
        ├── budget_form_fields.dart
        ├── breakdown_tree_view.dart
        ├── breakdown_node_tile.dart
        ├── breakdown_pie_chart.dart
        └── breakdown_bar_chart.dart
```

## FinanceOverviewPage

- `PeriodSelector`: الشهر ده / الشهر اللي فات / آخر ٣ شهور / السنة / مخصص
- `NetBalanceCard`: income, expense, net, with the previous-period comparison
- top expense categories (`BreakdownBarChart`)
- budgets in warning/exceeded (`BudgetCard` list)
- recent transactions
- FABs: تسجيل مصروف / تسجيل إيراد

## TransactionFormPage

| Field | Required |
|---|---|
| النوع (مصروف / إيراد) | ✅ `IncomeExpenseToggle` |
| المبلغ | ✅ `AmountInputField` — numeric keypad, EGP suffix, thousands separator |
| القسم | ✅ `CategoryPickerField` |
| التاريخ | ✅ defaults to today, no future dates |
| طريقة الدفع | ✅ |
| الفرع | ❌ defaults to the user's branch |
| المورد | ❌ |
| صورة الفاتورة | ❌ `InvoicePhotoPicker` |
| ملاحظات | ❌ |

Required fields are visually marked and the submit button stays disabled with a clear reason until
they are filled. Exactly the four required fields the business specified — no more.

### CategoryPickerSheet

The nested tree is the hard UI problem here. Solution:
- searchable field at the top (search flattens the tree and shows full paths)
- expandable `CategoryTreeTile`s with indentation and connector lines
- `CategoryBreadcrumb` on the selected value: "مصاريف تشغيل / صيانة / قطع غيار"
- the tree is **filtered by kind** — picking a category for an expense never shows income categories
- recently used categories pinned at the top; with deep trees this saves most of the taps
- inline "قسم جديد" for users with `finance.categories.manage`

## CategoriesPage

`CategoryTreeView` with unlimited depth. Each `CategoryNodeTile` shows name, child count,
transaction count and period total. `SystemCategoryBadge` marks protected categories
(صيانة، مخالفات، اشتراكات) which cannot be deleted or re-parented.

Actions: add child, edit, move, deactivate, delete (only when empty and childless).
Deletion attempts on a non-empty category explain the alternative rather than just failing:
"القسم ده فيه ٣١ معاملة — تقدر توقفه بدل ما تمسحه".

Indentation caps at ~5 levels visually; deeper levels stay at the same indent with the breadcrumb
carrying the meaning. Otherwise deep trees run off the screen edge in RTL.

## CategoryBreakdownPage

The core report the business asked for: "كل قسم اتصرف فيه إيه".

- period selector + branch filter
- `BreakdownPieChart` for top-level split
- `BreakdownTreeView` — expandable, each `BreakdownNodeTile` showing **both** the direct total and
  the rolled-up total, plus percentage of parent
- tapping a node drills into its transactions
- export button (`19`)

Showing both numbers is deliberate: a parent with 0 direct and 61,200 rolled up tells a completely
different story from one with 61,200 direct.

## BudgetsPage

`BudgetCard` per budget:

```
┌──────────────────────────────────────────┐
│ صيانة — سبتمبر ٢٠٢٦          [تحذير] 🟡   │
│ ████████████████████░░  ٩١٪               │
│ ٢٧٤٠٠ من ٣٠٠٠٠ ج.م                        │
│ فاضل ٢٦٠٠ ج.م · ٢٣ يوم                    │
│ ⚠ الصرف أسرع من المتوقع بـ ٢٠٤١٠ ج.م      │
└──────────────────────────────────────────┘
```

`BudgetPaceIndicator` is what makes this actionable — 91% used on day 7 of 30 is an alarm; 91% on
day 27 is fine.

Budgets are **optional** everywhere. The empty state says so plainly: "مفيش ميزانيات متسجلة —
النظام شغال عادي من غيرها. الميزانية بتنفع لو عايز تنبيه لما قسم يعدي حد معين."

## Auto-generated transactions

`TransactionSourceBadge` marks rows created by the system (صيانة تلقائية، مخالفة، اشتراك). These:
- cannot be edited or voided from the app (the button is absent, with a note pointing at the origin)
- link to their source record — tapping opens the maintenance order or the violation

## Permission behaviour

Finance is the module the Director gates individually. Consequences:
- the tab and every route are hidden without `finance.read`
- `finance.create` gates the FABs and the form
- `finance.void` gates voiding
- `finance.categories.manage` gates category editing
- `finance.budgets.manage` gates budgets
- without `finance.read.all`, only the user's branch plus company-level rows are visible

Never show a finance screen with an "access denied" message — the entry point simply does not exist.

## Offline

- Read from cache with a "آخر تحديث" line.
- **Creating a transaction works offline** (queued) — an expense often happens in the field.
- Categories, budgets, voiding: online-only.

## Rules

1. Currency is EGP everywhere. `Formatters.currency` only — never manual string building.
2. Amounts always render LTR inside Arabic text.
3. Expense amounts in red with a `−`, income in green with a `+`, plus an icon. Never colour alone.
4. Future dates blocked in the picker itself, not only on submit.
