import { z } from 'zod';

export type FilterPatch<T> = Partial<T> | ((current: T) => T);

export function resetPageOnFilterChange<T extends { page?: number }>(
  current: T,
  patch: Partial<T>,
  defaults: T,
): T {
  const next = { ...current, ...patch };
  const filterChanged = Object.entries(patch).some(([key, value]) => {
    if (key === 'page' || key === 'limit' || key === 'sortBy' || key === 'sortDir') return false;
    return JSON.stringify(value) !== JSON.stringify(current[key as keyof T]);
  });
  if (filterChanged) {
    next.page = defaults.page ?? 1;
  }
  return next;
}

export function omitDefaults<T extends Record<string, unknown>>(values: T, defaults: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(values)) {
    if (JSON.stringify(value) === JSON.stringify(defaults[key as keyof T])) continue;
    if (value === undefined || value === null || value === '') continue;
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

export function parseSearchParams<S extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: S,
): z.infer<S> {
  const raw: Record<string, unknown> = {};
  for (const key of new Set(searchParams.keys())) {
    const all = searchParams.getAll(key);
    raw[key] = all.length > 1 ? all : all[0];
  }
  return schema.parse(raw);
}
