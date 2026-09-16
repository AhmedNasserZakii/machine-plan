const LATN = 'latn';

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { numberingSystem: LATN }).format(value);
}

export function formatMoney(
  amount: number,
  locale: string,
  currency = 'EGP',
): string {
  const formatted = new Intl.NumberFormat(locale, {
    numberingSystem: LATN,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  const sign = amount < 0 ? '−' : '';
  if (locale.startsWith('ar')) {
    return `${sign}${formatted} ج.م`;
  }
  return `${sign}${currency} ${formatted}`;
}

export function formatDate(value: string | Date, locale: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  void locale;
  return `${d}/${m}/${y}`;
}

export function formatDateTime(value: string | Date, locale: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(date, locale)} ${hours}:${minutes}`;
}

export function formatRelative(value: string | Date, locale: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 60) return rtf.format(Math.round(diffSec), 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
  return rtf.format(Math.round(diffSec / (86400 * 30)), 'month');
}

export function formatPhone(value: string): string {
  return value.replace(/\s+/g, '');
}
