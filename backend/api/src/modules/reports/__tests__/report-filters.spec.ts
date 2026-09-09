import { ReportGranularity } from 'src/common/enums/report.enum';
import { BranchScope } from 'src/common/types/request.types';
import {
  DEFAULT_PERIOD_DAYS,
  dateOnly,
  epochMs,
  hashFilters,
  money,
  num,
  periodBucketExpression,
  resolveBranchFilter,
  resolvePeriod,
  toDateOnly,
} from '../report-filters';

const NOW = new Date('2026-09-08T12:00:00.000Z');

const unrestricted: BranchScope = { branchId: null, unrestricted: true };
const pinned: BranchScope = { branchId: 'branch-a', unrestricted: false };

describe('resolvePeriod', () => {
  it('keeps both ends the caller named', () => {
    expect(resolvePeriod('2026-01-01', '2026-03-31', NOW)).toEqual({
      from: '2026-01-01',
      to: '2026-03-31',
    });
  });

  it('defaults the window to the last ninety days rather than to everything', () => {
    const period = resolvePeriod(undefined, undefined, NOW);

    expect(period.to).toBe('2026-09-08');
    expect(period.from).toBe(
      toDateOnly(new Date(NOW.getTime() - DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000)),
    );
  });

  it('fills only the end the caller left out', () => {
    expect(resolvePeriod('2026-08-01', undefined, NOW)).toEqual({
      from: '2026-08-01',
      to: '2026-09-08',
    });
  });
});

describe('resolveBranchFilter', () => {
  it('lets an unrestricted caller pick a branch', () => {
    expect(resolveBranchFilter('branch-b', unrestricted)).toBe('branch-b');
  });

  it('means every branch when an unrestricted caller names none', () => {
    expect(resolveBranchFilter(undefined, unrestricted)).toBeNull();
  });

  it('pins a scoped caller to his own branch', () => {
    expect(resolveBranchFilter(undefined, pinned)).toBe('branch-a');
  });

  it('refuses to widen: a scoped caller asking for another branch still gets his own', () => {
    expect(resolveBranchFilter('branch-b', pinned)).toBe('branch-a');
  });
});

describe('hashFilters', () => {
  it('is stable for the same filters', () => {
    expect(hashFilters({ from: '2026-01-01', branchId: null })).toBe(
      hashFilters({ from: '2026-01-01', branchId: null }),
    );
  });

  it('ignores key order, so two spellings of one question share a cache entry', () => {
    expect(hashFilters({ a: 1, b: 2 })).toBe(hashFilters({ b: 2, a: 1 }));
  });

  it('separates two different questions', () => {
    expect(hashFilters({ branchId: 'a' })).not.toBe(hashFilters({ branchId: 'b' }));
  });

  it('is short enough to sit in a cache key', () => {
    expect(hashFilters({ a: 1 })).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('periodBucketExpression', () => {
  it('buckets by month by default', () => {
    expect(periodBucketExpression(ReportGranularity.MONTH, 'ft.transaction_date')).toContain(
      'YYYY-MM',
    );
  });

  it('uses ISO weeks so a year boundary does not collide', () => {
    expect(periodBucketExpression(ReportGranularity.WEEK, 'ft.transaction_date')).toContain('IYYY');
  });

  it('buckets by day and by year on request', () => {
    expect(periodBucketExpression(ReportGranularity.DAY, 'x')).toContain('YYYY-MM-DD');
    expect(periodBucketExpression(ReportGranularity.YEAR, 'x')).toBe(`to_char(x, 'YYYY')`);
  });
});

describe('dateOnly', () => {
  it('handles the driver returning a Date', () => {
    expect(dateOnly(new Date('2026-09-08T22:00:00.000Z'))).toBe('2026-09-08');
  });

  it('handles the driver returning text', () => {
    expect(dateOnly('2026-09-08')).toBe('2026-09-08');
    expect(dateOnly('2026-09-08T22:00:00.000Z')).toBe('2026-09-08');
  });

  it('keeps a missing date missing rather than inventing today', () => {
    expect(dateOnly(null)).toBeNull();
    expect(dateOnly(undefined)).toBeNull();
  });
});

describe('epochMs', () => {
  it('reads either representation', () => {
    expect(epochMs(new Date('2026-09-08T12:00:00.000Z'))).toBe(
      Date.parse('2026-09-08T12:00:00.000Z'),
    );
    expect(epochMs('2026-09-08T12:00:00.000Z')).toBe(Date.parse('2026-09-08T12:00:00.000Z'));
  });

  it('is null for a missing or unparseable value', () => {
    expect(epochMs(null)).toBeNull();
    expect(epochMs('not a date')).toBeNull();
  });
});

describe('num and money', () => {
  it('turns the strings pg returns for numerics into numbers', () => {
    expect(num('1234.50')).toBe(1234.5);
    expect(num(7)).toBe(7);
  });

  it('reads a missing numeric as zero, so a report can add it up', () => {
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
  });

  it('rounds money to two places', () => {
    expect(money('10.005')).toBe(10.01);
    expect(money('10.004')).toBe(10);
    expect(money(null)).toBe(0);
  });
});
