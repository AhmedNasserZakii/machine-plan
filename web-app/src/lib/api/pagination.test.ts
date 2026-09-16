import { describe, expect, it } from 'vitest';

import { isCursorMeta, isPageMeta } from './pagination';

describe('pagination meta', () => {
  it('discriminates page vs cursor', () => {
    expect(isPageMeta({ page: 1, limit: 20, total: 10, totalPages: 1, hasNext: false })).toBe(true);
    expect(isCursorMeta({ limit: 20, nextCursor: 'abc', hasNext: true })).toBe(true);
    expect(isCursorMeta({ page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false })).toBe(false);
  });
});
