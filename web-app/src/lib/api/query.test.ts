import { describe, expect, it } from 'vitest';

import { buildQuery } from './query';

describe('buildQuery', () => {
  it('repeats array keys and drops empties', () => {
    expect(
      buildQuery({
        status: ['WITH_MERCHANT', 'IN_TRANSIT'],
        page: 2,
        search: 'SN-003',
        empty: '',
        missing: undefined,
        none: null,
      }),
    ).toBe('?status=WITH_MERCHANT&status=IN_TRANSIT&page=2&search=SN-003');
  });

  it('formats dates as yyyy-MM-dd when time is midnight UTC', () => {
    expect(buildQuery({ dateFrom: new Date('2026-09-07T00:00:00.000Z') })).toBe('?dateFrom=2026-09-07');
  });
});
