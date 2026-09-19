import { Api, fails, okPage, type PageMeta } from './api-client';

export interface OffsetPageRow {
  id: string;
}

/**
 * Walks every offset page until `hasNext` is false and asserts the contract the
 * mobile client depends on: disjoint pages, stable total, correct hasNext, and
 * a 400 for an oversized limit.
 */
export async function assertOffsetPaging<T extends OffsetPageRow>(
  api: Api,
  path: string,
  options: {
    /** Expected total for this filter; omit when other specs may have written rows. */
    expectedTotal?: number;
    /** Page size used while walking (must be < total for multi-page coverage). */
    limit?: number;
    /** Minimum rows that must exist before paging is meaningful. */
    minTotal?: number;
  } = {},
): Promise<{ pages: T[][]; meta: PageMeta }> {
  const limit = options.limit ?? 5;
  const separator = path.includes('?') ? '&' : '?';

  const first = await okPage<T>(api.get(`${path}${separator}page=1&limit=${limit}`));
  const total = first.meta.total;

  if (options.expectedTotal !== undefined) {
    expect(total).toBe(options.expectedTotal);
  }
  if (options.minTotal !== undefined) {
    expect(total).toBeGreaterThanOrEqual(options.minTotal);
  }

  expect(first.meta.limit).toBe(limit);
  expect(first.meta.page).toBe(1);
  expect(first.items.length).toBeLessThanOrEqual(limit);
  expect(first.meta.totalPages).toBe(Math.ceil(total / limit) || 0);

  const pages: T[][] = [first.items];
  const seen = new Set(first.items.map((row) => row.id));
  let meta = first.meta;
  let page = 1;

  while (meta.hasNext) {
    page += 1;
    expect(page).toBeLessThanOrEqual(Math.max(meta.totalPages, 1) + 1);

    const next = await okPage<T>(api.get(`${path}${separator}page=${page}&limit=${limit}`));
    expect(next.meta.page).toBe(page);
    expect(next.meta.total).toBe(total);
    expect(next.meta.limit).toBe(limit);
    expect(next.items.length).toBeGreaterThan(0);

    for (const row of next.items) {
      expect(seen.has(row.id)).toBe(false);
      seen.add(row.id);
    }

    pages.push(next.items);
    meta = next.meta;
  }

  expect(seen.size).toBe(Math.min(total, pages.flat().length));
  if (total > limit) {
    expect(pages.length).toBeGreaterThan(1);
  }

  await fails(api.get(`${path}${separator}limit=1000`), 400, 'VALIDATION_FAILED');

  return { pages, meta };
}

/** Keyset walk: first page, then `cursor` until `hasNext` is false. */
export async function assertCursorPaging<T extends { id?: string }>(
  api: Api,
  path: string,
  options: { limit?: number; expectMultiplePages?: boolean } = {},
): Promise<number> {
  const limit = options.limit ?? 2;
  const separator = path.includes('?') ? '&' : '?';

  const first = await okPage<T>(api.get(`${path}${separator}limit=${limit}`));
  expect(first.meta.limit).toBe(limit);
  expect(first.items.length).toBeLessThanOrEqual(limit);

  const seen = new Set(
    first.items.map((row, index) =>
      'id' in row && row.id ? String(row.id) : JSON.stringify(row) + `#${index}`,
    ),
  );
  let cursor = first.meta.nextCursor ?? undefined;
  let hasNext = first.meta.hasNext;
  let pages = 1;
  let safety = 0;

  while (hasNext) {
    expect(cursor).toBeTruthy();
    safety += 1;
    expect(safety).toBeLessThan(25);

    const next = await okPage<T>(
      api.get(`${path}${separator}limit=${limit}&cursor=${encodeURIComponent(cursor!)}`),
    );
    expect(next.items.length).toBeGreaterThan(0);
    pages += 1;

    next.items.forEach((row, index) => {
      const key =
        'id' in row && row.id ? String(row.id) : `${JSON.stringify(row)}#${pages}-${index}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    });

    cursor = next.meta.nextCursor ?? undefined;
    hasNext = next.meta.hasNext;
  }

  if (options.expectMultiplePages) {
    expect(pages).toBeGreaterThan(1);
  }

  return seen.size;
}
