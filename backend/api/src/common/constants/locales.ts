export const SUPPORTED_LOCALES = ['ar', 'en'] as const;

export const DEFAULT_LOCALE = 'ar';

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
