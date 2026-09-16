# 04 — Localization (ar / en) & RTL

## The rule that saves the most work

**The mobile app already has 976 translated keys** in
`mobile-app/assets/translations/{ar,en}.json`. The web app **reuses those key names** for every
string that means the same thing. A wording change then lands in one place and both clients pick
it up.

`scripts/sync-translations.ts` copies them into `src/i18n/messages/{ar,en}.json` under a
`shared` namespace, and the web-only strings live in namespaces beside it:

```jsonc
// src/i18n/messages/ar.json
{
  "shared":   { /* generated from mobile ar.json — DO NOT EDIT BY HAND */ },
  "web":      { "sidebar": { … }, "table": { … }, "filters": { … } },
  "machines": { "columns": { … } },
  "finance":  { … }
}
```

Run `npm run i18n:sync` after any mobile translation change. `npm run i18n:check` fails CI if a
key exists in `ar` but not `en`, or vice versa, or if any `shared.*` key was hand-edited.

## Setup

`next-intl` with locale-prefixed routing:

```ts
// src/i18n/routing.ts
export const routing = defineRouting({
  locales: ['ar', 'en'],
  defaultLocale: 'ar',        // Arabic-first, like the mobile app
  localePrefix: 'always',     // /ar/machines and /en/machines — both explicit
});
```

Locale resolution order: URL segment → `NEXT_LOCALE` cookie → `Accept-Language` → `ar`.
The locale switcher writes the cookie and replaces the segment, **preserving the full query
string** — switching language must not drop the user's filters.

`Accept-Language` is forwarded to the API on every request (`05`), so server error messages come
back in the user's language and can be shown verbatim.

## Naming keys

- `shared.*` — mirrored from mobile. Never edited in the web repo.
- `web.<area>.<thing>` — web-only chrome: sidebar labels, table controls, filter bar, pagination,
  column names, print headers, keyboard-shortcut help.
- `errors.<CODE>` — one entry per canonical server error code (`05`), for the cases where the web
  app wants its own phrasing plus a recovery action rather than the raw server message.
- `enums.<enum>.<VALUE>` — every API enum value: machine status, transfer type, maintenance
  status, violation status/severity, audit action, notification type, budget period. These are
  the highest-traffic strings in the product. Reuse the mobile keys where they exist.

Never build a key by string concatenation beyond one interpolated enum value
(`t(\`enums.machineStatus.${status}\`)` is fine and is the intended pattern).

## Pluralization and interpolation

ICU message format, which `next-intl` supports natively. Arabic has six plural categories and
`zero`/`two` are not optional:

```json
"machines.count": "{count, plural, zero{لا توجد ماكينات} one{ماكينة واحدة} two{ماكينتان} few{# ماكينات} many{# ماكينة} other{# ماكينة}}"
```

Never assemble a sentence from fragments. `"لديك" + count + "ماكينة"` is broken Arabic and
unfixable by a translator.

## Formatting

Configured once in the provider:

| Kind | `ar` | `en` |
|---|---|---|
| Digits | `0-9` (`numberingSystem: 'latn'`) | `0-9` |
| Currency | `١٢٬٥٠٠٫٠٠ ج.م` → rendered as `12,500.00 ج.م` | `EGP 12,500.00` |
| Date | `dd/MM/yyyy` | `dd/MM/yyyy` |
| Date + time | `dd/MM/yyyy HH:mm` (24h) | `dd/MM/yyyy HH:mm` |
| Relative | "منذ ٣ أيام" via `Intl.RelativeTimeFormat` | "3 days ago" |

**Latin digits in Arabic is deliberate.** The finance and inventory staff read serials and amounts
in Western numerals; Eastern Arabic numerals would make a machine serial unsearchable against a
sticker. This matches the mobile app.

All of this goes through `src/lib/format/` — `formatMoney`, `formatDate`, `formatDateTime`,
`formatRelative`, `formatNumber`, `formatPhone`. Feature code never touches `Intl` directly.

## Directionality specifics

Beyond the rules in `03`:

- `<Money>`, `<SerialText>`, `<PhoneText>`, `<DateText>` wrap their content in
  `<bdi dir="ltr">`. Used everywhere, no exceptions.
- Mixed-direction inputs (a search box that takes either Arabic text or `SN-00341`) get
  `dir="auto"`, which lets the browser decide per value.
- A form's field order does not change between locales; only the visual direction does.
- Toast/notification stack anchors to the inline-end corner, so it flips with direction.
- `text-align: start` on table cells; numeric columns get `text-end` in both directions
  (right-aligned numbers stay right-aligned — `dir` does not change how a decimal column reads).

## Empty, error and loading copy

Every one of these is a translated string with a real sentence, not "No data".

- Empty: what would be here, and the action that creates it — "لا توجد ماكينات في هذا الفرع"
  plus an "إضافة ماكينة" button if the user holds `machines.create`.
- Error: the server's localized `error.message` when present, else `errors.<CODE>`, else a
  generic; plus "إعادة المحاولة".
- Filtered-empty is a **different** message from truly-empty, and offers "مسح عوامل التصفية".

## QA checklist per screen

- [ ] Every visible string comes from `t()`.
- [ ] Screen renders correctly at `/ar/...` and `/en/...`.
- [ ] No text clipping in Arabic (Arabic runs ~20–30% longer than English in UI labels — size
      buttons and table headers for the Arabic string, not the English one).
- [ ] Serials, phones, amounts and dates render LTR inside Arabic paragraphs.
- [ ] Chevrons and arrows point the right way; trash and check icons do not flip.
- [ ] Locale switch preserves the route **and the query string**.
