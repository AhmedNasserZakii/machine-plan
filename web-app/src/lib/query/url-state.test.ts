import { describe, expect, it } from 'vitest';

import { omitDefaults, resetPageOnFilterChange } from './url-state';

describe('url filters', () => {
  const defaults = { page: 1, limit: 20, search: '', status: [] as string[] };

  it('resets page to 1 when a filter changes', () => {
    const current = { ...defaults, page: 7, search: 'abc' };
    const next = resetPageOnFilterChange(current, { search: 'xyz' }, defaults);
    expect(next.page).toBe(1);
    expect(next.search).toBe('xyz');
  });

  it('does not reset page when only page changes', () => {
    const current = { ...defaults, page: 2 };
    const next = resetPageOnFilterChange(current, { page: 3 }, defaults);
    expect(next.page).toBe(3);
  });

  it('omits defaults from the query string object', () => {
    expect(omitDefaults({ ...defaults, search: 'x' }, defaults)).toEqual({ search: 'x' });
  });
});
