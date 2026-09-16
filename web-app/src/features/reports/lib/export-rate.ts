const STORAGE_KEY = 'reports.exportTimestamps';
const WINDOW_MS = 60 * 60 * 1000;
export const EXPORT_HOURLY_LIMIT = 10;

function readTimestamps(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    const cutoff = Date.now() - WINDOW_MS;
    return raw.filter((n): n is number => typeof n === 'number' && n > cutoff);
  } catch {
    return [];
  }
}

function writeTimestamps(ts: number[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ts));
}

/** Soft remaining count (client-side); server is authoritative via 429. */
export function remainingExports(): number {
  return Math.max(0, EXPORT_HOURLY_LIMIT - readTimestamps().length);
}

export function recordExportStarted() {
  const next = [...readTimestamps(), Date.now()];
  writeTimestamps(next);
}
