# 15 — Feature: Merchants

## Screens

| Page | Route | Permission |
|---|---|---|
| `MerchantsListPage` | `/merchants` | `merchants.read` |
| `MerchantDetailPage` | `/merchants/:id` | `merchants.read` |
| `MerchantFormPage` | `/merchants/form` | `merchants.create` / `merchants.update` |
| `SubscriptionFormPage` | `/merchants/:id/subscriptions/form` | `merchants.update` |

## Structure

```
features/merchants/
├── data/
│   ├── models/ (merchant_model.dart, merchant_detail_model.dart,
│   │            subscription_model.dart, create_merchant_request.dart,
│   │            collect_subscription_request.dart)
│   ├── datasources/ (merchants_remote_datasource.dart, merchants_local_datasource.dart)
│   └── repositories/merchants_repository.dart
└── presentation/
    ├── cubit/ (merchants_list_cubit.dart, merchant_detail_cubit.dart,
    │           merchant_form_cubit.dart, subscription_cubit.dart) + states
    ├── pages/
    └── widgets/
        ├── merchant_card.dart
        ├── merchant_avatar.dart
        ├── merchants_search_bar.dart
        ├── merchants_filter_sheet.dart
        ├── merchants_empty_state.dart
        ├── merchant_header_section.dart
        ├── merchant_contact_section.dart
        ├── merchant_contact_action_row.dart      # call / whatsapp / map
        ├── merchant_machines_section.dart
        ├── merchant_machine_tile.dart
        ├── merchant_subscription_card.dart
        ├── subscription_status_chip.dart
        ├── subscription_plan_selector.dart
        ├── collect_payment_sheet.dart
        ├── merchant_form_fields.dart
        ├── national_id_field.dart
        ├── duplicate_merchant_warning.dart
        └── deactivate_merchant_dialog.dart
```

## MerchantFormPage

Fields, in this order:

| Field | Required | Notes |
|---|---|---|
| اسم التاجر | ✅ | |
| رقم التليفون | ✅ | Egyptian mobile validation |
| اسم المحل | ✅ | |
| العنوان | ✅ | multiline |
| الرقم القومي | ❌ | `NationalIdField`, 14 digits, validated only if entered |

Branch and the registering user are taken from the session — no picker.

### Duplicate detection

On phone blur, check locally and (when online) via the API. If a match exists,
`DuplicateMerchantWarning` appears **inline, non-blocking**:

> ℹ في تاجر بنفس الرقم: محل النور — أحمد محمود
> [افتح التاجر ده] [كمّل تسجيل جديد]

Per the business rule (backend `08`), this is a warning, never a block. Field reality wins.

## MerchantDetailPage

1. `MerchantHeaderSection` — name, shop, active status
2. `MerchantContactActionRow` — call, WhatsApp, open in maps. One tap each; reps use this constantly.
3. `MerchantMachinesSection` — every machine at this merchant, `MerchantMachineTile` each showing
   serial, model, since when, and a "استلام" action for `MERCHANT_TO_REPRESENTATIVE`
4. `MerchantSubscriptionCard` — plan, amount, next due, `SubscriptionStatusChip`
   (سارية / مستحقة / متأخرة), payment history, and a **تحصيل** button
5. registered-by and registration date
6. actions: edit, add/edit subscription, deactivate

## Subscriptions

`SubscriptionPlanSelector` offers: بدون اشتراك / رسوم مرة واحدة / أسبوعي / شهري.
Amount is disabled and forced to zero when "بدون اشتراك" is selected.

`CollectPaymentSheet`: amount (pre-filled from the plan, editable), date, payment method, optional
invoice photo, notes. Submitting creates an **income** transaction on the server under the system
category (backend `08`) — the app does not create the finance row itself.

Requires `finance.create`. A rep without it sees the due amount but no collect button, and a note
saying who can collect.

## MerchantsListPage

Search across name, shop name and phone. Filters: branch, registering rep, has machines, active,
subscription status. Cards show shop name prominently — reps think in shops, not people.

## Offline

- Full read from the local cache.
- **Creating a merchant works offline** — this is essential, because a rep registers a merchant at
  the moment of placing a machine, in the shop. Queued via `clientUuid` (`07`).
- Editing and subscription collection are online-only in v1 (they touch money).

## Rules

1. Never display a full national ID in a list — mask it (`•••••••••1234`) and show it fully only on
   the detail page. It is sensitive and there is no reason for it to be on a scrollable list.
2. Deactivation blocked while machines are held — `DeactivateMerchantDialog` shows the count and
   links to the machines.
3. A representative sees only merchants he registered unless he has `merchants.read.all`.
