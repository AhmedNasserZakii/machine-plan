# 04 — Localization (Arabic / English)

> If the project already uses `easy_localization`, GetX translations or a custom JSON loader, use
> that. This file describes the ARB + `gen-l10n` approach and, more importantly, the **rules** that
> apply whichever mechanism you use.

## Setup

`l10n.yaml` at project root:

```yaml
arb-dir: lib/core/localization/l10n
template-arb-file: app_ar.arb
output-localization-file: app_localizations.dart
output-class: AppLocalizations
nullable-getter: false
```

Arabic is the **template**, because Arabic is the primary language and English is the translation.
This forces every new key to be written in Arabic first, which is how the business actually thinks.

```dart
MaterialApp(
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: const [Locale('ar'), Locale('en')],
  locale: localeCubit.state.locale,
);
```

## Key naming

`camelCase`, feature-prefixed, describing purpose not content:

```
authLoginTitle
authInvalidCredentials
machinesListTitle
machinesEmptyStateTitle
machinesEmptyStateSubtitle
transfersConfirmSignaturePrompt
transfersPendingCount            # with a plural
financeExpensesTitle
violationsSeverityHigh
commonSave / commonCancel / commonRetry / commonSearch
errorNetworkUnavailable
```

Never `text1`, never the English sentence as the key.

## Plurals and parameters

```json
{
  "transfersPendingCount": "{count, plural, =0{لا توجد تسليمات معلقة} =1{تسليم واحد معلق} =2{تسليمان معلقان} few{{count} تسليمات معلقة} many{{count} تسليمًا معلقًا} other{{count} تسليم معلق}}",
  "@transfersPendingCount": { "placeholders": { "count": { "type": "int" } } }
}
```

Arabic has **six** plural categories (`zero`, `one`, `two`, `few`, `many`, `other`). English has two.
Any counted noun in the UI must use ICU plurals — do not concatenate a number and a fixed word.

## Numbers, dates and currency

```dart
// core/utils/formatters.dart
abstract final class Formatters {
  /// EGP with the locale's grouping, always Western digits for clarity on serials/amounts.
  static String currency(num v, String locale) =>
      NumberFormat.currency(locale: locale, symbol: 'ج.م ', decimalDigits: 2).format(v);

  static String date(DateTime d, String locale) =>
      DateFormat('yyyy/MM/dd', locale).format(d);

  static String dateTime(DateTime d, String locale) =>
      DateFormat('yyyy/MM/dd — hh:mm a', locale).format(d);

  /// "منذ ٣ أيام" / "3 days ago"
  static String relative(DateTime d, String locale) => …;
}
```

**Digit shape decision:** use **Western digits (0-9) everywhere**, including in Arabic. Serial
numbers, amounts and dates are read aloud over the phone, cross-checked against printed invoices
and typed into other systems. Arabic-Indic digits (٠١٢٣) look native but cause real operational
friction here. Configure `NumberFormat` accordingly and be consistent.

## Server-provided strings

Category names, machine types, violation types, roles and notification bodies are **localized on the
server** (backend `02`). The app sends `Accept-Language` and receives ready strings.

**Consequence:** when the user switches the app language, cached server data is stale. On locale
change the app must:
1. update `Accept-Language` on the Dio instance,
2. clear the localized-lookup tables in the local database,
3. re-run `/sync/bootstrap`.

Handle this in `LocaleCubit` — it is easy to forget and produces a confusing half-translated app.

## Error messages

Backend errors arrive as stable codes (`MACHINE_ALREADY_IN_TRANSIT`) plus a localized message.
**Prefer the app's own mapping** so the wording is controlled and offline errors read the same:

```dart
// core/errors/error_mapper.dart
String messageFor(String code, AppLocalizations l10n) => switch (code) {
  'MACHINE_ALREADY_IN_TRANSIT' => l10n.errorMachineAlreadyInTransit,
  'NOT_IN_YOUR_CUSTODY'        => l10n.errorNotInYourCustody,
  'INVALID_MACHINE_STATUS'     => l10n.errorInvalidMachineStatus,
  'PAYLOAD_CHANGED'            => l10n.errorPayloadChanged,
  'CATEGORY_KIND_MISMATCH'     => l10n.errorCategoryKindMismatch,
  _ => l10n.errorUnexpected,
};
```

Fall back to the server's `message` when a code is unmapped, so a new backend error is never a blank
dialog.

## Rules

1. **Zero hardcoded user-facing strings** in widgets. Every visible string comes from `l10n`.
2. Add every new key to **both** `app_ar.arb` and `app_en.arb` in the same commit. A missing English
   key throws at runtime with `nullable-getter: false` — which is exactly what we want in CI.
3. Never build sentences by concatenation — use parameterised keys, because word order differs.
4. Debug label strings (log messages, analytics event names) stay in English and are not localized.
5. Run `flutter gen-l10n` after every ARB change; commit the generated files if the project does.
