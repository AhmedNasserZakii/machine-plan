# 02 — Database Localization Strategy

> **⚠ Confirm this against the `عيادتي` project before implementing.** This file is intentionally
> isolated so the whole strategy can be swapped by editing one document. If عيادتي used a JSONB
> column instead of translation tables, change only this file and the `*_translations` entries in
> `03-database-schema.md`.

## Supported locales

`ar` (default, RTL) and `en`. The set lives in one place:

```ts
// src/common/constants/locales.ts
export const SUPPORTED_LOCALES = ['ar', 'en'] as const;
export const DEFAULT_LOCALE = 'ar';
export type Locale = (typeof SUPPORTED_LOCALES)[number];
```

## The rule

**Any column whose value is shown to a human as a name/label/description is localized.**
Operational data (serials, amounts, dates, phone numbers, merchant names, user names) is **not** —
it is entered once, as-is.

### Localized entities

| Entity | Localized fields |
|---|---|
| `machine_types` | `name` |
| `machine_models` | `name`, `description` |
| `finance_categories` | `name`, `description` |
| `payment_methods` | `name` |
| `violation_types` | `name`, `description` |
| `maintenance_locations` | `name` |
| `decommission_reasons` | `name` |
| `roles` | `display_name`, `description` |
| `permissions` | `display_name`, `description` |
| `notification_templates` | `title`, `body` |

### Not localized

Machine serial, battery serial, merchant data, user names, transaction amounts/notes,
invoice images, free-text notes typed by staff.

## Pattern: sibling translation table

For every localized entity `X`, create `x_translations`:

```sql
CREATE TABLE machine_type_translations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_type_id UUID NOT NULL REFERENCES machine_types(id) ON DELETE CASCADE,
  locale          VARCHAR(5) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_machine_type_locale UNIQUE (machine_type_id, locale)
);
CREATE INDEX idx_mtt_locale ON machine_type_translations (locale);
```

The parent table holds only non-translatable data (`code`, `is_active`, `sort_order`, FKs).

## Resolving the locale on a request

1. `Accept-Language` header (`ar` / `en`) — primary.
2. `?locale=` query param — overrides the header (useful for reports/exports).
3. Fall back to `DEFAULT_LOCALE`.

Implement as a middleware that puts `req.locale` on the request, plus a `@ReqLocale()` param decorator.

## Reading translations

Use a reusable helper that left-joins the requested locale and falls back to the default:

```ts
// src/common/utils/localized-query.util.ts
export function joinTranslation<T>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  translationRelation: string,   // e.g. 'translations'
  locale: Locale,
) {
  return qb
    .leftJoinAndSelect(
      `${alias}.${translationRelation}`,
      `${alias}_tr`,
      `${alias}_tr.locale IN (:...locales)`,
      { locales: [locale, DEFAULT_LOCALE] },
    );
}
```

Then the **mapper** picks the requested locale, falling back to the default, then to the first
available row. The service never returns an array of translations to the client — the client
receives a flat resolved string:

```json
{ "id": "…", "code": "POS_TERMINAL", "name": "ماكينة نقاط بيع" }
```

## Writing translations

Create/update endpoints accept a translations object:

```json
{
  "code": "POS_TERMINAL",
  "translations": { "ar": { "name": "ماكينة نقاط بيع" }, "en": { "name": "POS Terminal" } }
}
```

Validation rule: **the default locale (`ar`) is required**; other locales optional.
Use a shared `TranslationsDto` with a custom validator `@HasDefaultLocale()`.

## Admin/management view

Admin screens need *all* locales at once, not a resolved string. Provide a separate response shape
behind `?raw_translations=true` (permission-gated) that returns the full translations map.

## Seeding

`database/seeds/` must seed both locales for: roles, permissions, payment methods, violation types,
machine types, decommission reasons, maintenance locations, notification templates, and the
**system finance categories** (see `14`).
