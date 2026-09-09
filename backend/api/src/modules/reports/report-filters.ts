import { ReportGranularity } from 'src/common/enums/report.enum';
import { BranchScope } from 'src/common/types/request.types';
import { sha256Object } from 'src/common/utils';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How much of the digest goes into a cache key. 16 hex characters is 64 bits of filter identity. */
const HASH_LENGTH = 16;

export interface ReportPeriod {
  from: string;
  to: string;
}

/**
 * The window a report covers when the caller named neither end.
 *
 * Ninety days rather than "everything": an unbounded default turns every report into a full-table
 * scan on the first tap, and nobody opens a report meaning "since the company was founded".
 */
export const DEFAULT_PERIOD_DAYS = 90;

export function resolvePeriod(
  from: string | undefined,
  to: string | undefined,
  now: Date,
): ReportPeriod {
  const today = toDateOnly(now);

  return {
    from: from ?? toDateOnly(new Date(now.getTime() - DEFAULT_PERIOD_DAYS * DAY_MS)),
    to: to ?? today,
  };
}

/**
 * The branch a report actually runs against.
 *
 * A caller may narrow but never widen: without the `*.read.all` permission the scope guard has
 * already pinned him to his own branch, and `?branchId=` from him is not a request the report
 * gets to honour (`17`, rule 4).
 */
export function resolveBranchFilter(
  requested: string | undefined,
  scope: BranchScope,
): string | null {
  return scope.unrestricted ? (requested ?? null) : scope.branchId;
}

/**
 * The cache identity of one run (`17`, rule 7).
 *
 * Page and limit are deliberately excluded by the caller: the runner caches the whole result and
 * slices it afterwards, so paging through a report is not seventeen cache misses.
 */
export function hashFilters(filters: Record<string, unknown>): string {
  return sha256Object(filters).slice(0, HASH_LENGTH);
}

/** `2026-08` for a month, `2026-W36` for a week, `2026-08-14` for a day, `2026` for a year. */
export function periodBucketExpression(granularity: ReportGranularity, column: string): string {
  switch (granularity) {
    case ReportGranularity.DAY:
      return `to_char(${column}, 'YYYY-MM-DD')`;
    case ReportGranularity.WEEK:
      return `to_char(${column}, 'IYYY-"W"IW')`;
    case ReportGranularity.YEAR:
      return `to_char(${column}, 'YYYY')`;
    case ReportGranularity.MONTH:
    default:
      return `to_char(${column}, 'YYYY-MM')`;
  }
}

export function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * `YYYY-MM-DD` out of whatever the driver handed back.
 *
 * Raw SQL bypasses TypeORM's column hydration, and `pg` decides for itself whether a temporal
 * column arrives as a `Date` or as text depending on its type. A report that assumed one of the
 * two would print `[object Object]` in a spreadsheet for the other.
 */
export function dateOnly(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;

  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

/** Milliseconds for an "how long ago" column, from either representation. Null stays null. */
export function epochMs(value: Date | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);

  return Number.isNaN(ms) ? null : ms;
}

/** Numeric columns come back from `pg` as strings; a report has to add them up, not concatenate. */
export function num(value: string | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

/** Two decimals, the way money is written everywhere else in this system. */
export function money(value: string | number | null | undefined): number {
  return Math.round(num(value) * 100) / 100;
}
