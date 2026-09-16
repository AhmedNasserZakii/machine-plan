export type QueryPrimitive = string | number | boolean | Date;
export type QueryValue = QueryPrimitive | QueryPrimitive[] | null | undefined;
export type QueryParams = Record<string, QueryValue>;

function formatValue(value: QueryPrimitive): string {
  if (value instanceof Date) {
    const hasTime = value.getUTCHours() !== 0 || value.getUTCMinutes() !== 0 || value.getUTCSeconds() !== 0;
    return hasTime ? value.toISOString() : value.toISOString().slice(0, 10);
  }
  return String(value);
}

/** Repeated keys for arrays. Drops undefined, null and ''. */
export function buildQuery(params?: QueryParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined || raw === null || raw === '') continue;
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (value === undefined || value === null || value === '') continue;
      search.append(key, formatValue(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}
