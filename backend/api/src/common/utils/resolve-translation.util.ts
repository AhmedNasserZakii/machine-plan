import { DEFAULT_LOCALE, Locale, SUPPORTED_LOCALES } from '../constants/locales';

interface HasLocale {
  locale: Locale;
}

/**
 * Picks the row for the requested locale, falling back to the default locale and then
 * to the first available row. Mappers use this so clients always receive a flat string.
 */
export function pickTranslation<T extends HasLocale>(
  translations: T[] | undefined | null,
  locale: Locale,
): T | null {
  if (!translations || translations.length === 0) return null;
  return (
    translations.find((row) => row.locale === locale) ??
    translations.find((row) => row.locale === DEFAULT_LOCALE) ??
    translations[0]
  );
}

/** Resolves a single translated field, returning `fallback` when nothing is available. */
export function resolveTranslatedField<T extends HasLocale, K extends keyof T>(
  translations: T[] | undefined | null,
  locale: Locale,
  field: K,
  fallback = '',
): NonNullable<T[K]> | string {
  const row = pickTranslation(translations, locale);
  const value = row?.[field];
  return value ?? fallback;
}

/**
 * Builds the full `{ ar: {...}, en: {...} }` map for admin screens
 * (`?raw_translations=true`, per `02-database-localization-strategy.md`).
 */
export function toTranslationsMap<T extends HasLocale, R>(
  translations: T[] | undefined | null,
  project: (row: T) => R,
): Partial<Record<Locale, R>> {
  const map: Partial<Record<Locale, R>> = {};
  for (const locale of SUPPORTED_LOCALES) {
    const row = translations?.find((entry) => entry.locale === locale);
    if (row) map[locale] = project(row);
  }
  return map;
}
