const PINNED_KEY = 'reports.pinned';
const LAST_RUN_KEY = 'reports.lastRun';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? '') as T;
  } catch {
    return fallback;
  }
}

export function getPinnedSlugs(): string[] {
  const raw = readJson<string[]>(PINNED_KEY, []);
  return Array.isArray(raw) ? raw.filter((s) => typeof s === 'string') : [];
}

export function setPinnedSlugs(slugs: string[]) {
  window.localStorage.setItem(PINNED_KEY, JSON.stringify(slugs));
}

export function togglePinnedSlug(slug: string): string[] {
  const current = getPinnedSlugs();
  const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
  setPinnedSlugs(next);
  return next;
}

export function getLastRunMap(): Record<string, string> {
  const raw = readJson<Record<string, string>>(LAST_RUN_KEY, {});
  return raw && typeof raw === 'object' ? raw : {};
}

export function markLastRun(slug: string, iso = new Date().toISOString()) {
  const map = getLastRunMap();
  map[slug] = iso;
  window.localStorage.setItem(LAST_RUN_KEY, JSON.stringify(map));
}
