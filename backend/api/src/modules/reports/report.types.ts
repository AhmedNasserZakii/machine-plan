import { Locale } from 'src/common/constants/locales';
import { SortDirection } from 'src/common/dto';
import { ExportCell, ExportColumn } from 'src/common/export';
import { CustodyGroupBy, ReportGranularity, ReportKey } from 'src/common/enums/report.enum';
import { BranchScope } from 'src/common/types/request.types';

export type ReportRow = Record<string, ExportCell>;

/**
 * How a `date` or `timestamptz` arrives from a raw query.
 *
 * `pg` hands temporal columns back as `Date` for some types and as text for others, and raw SQL
 * skips the hydration that would have normalised them. Row shapes say so out loud so that every
 * read of one goes through `dateOnly`.
 */
export type SqlTemporal = Date | string;

/**
 * What every report returns, whatever it is about (`17`, shared contract).
 *
 * `columns` + `rows` is the part the generic mobile screen and both exporters read: one flat,
 * self-describing table. `extra` is where a report that has more to say than a grid puts it —
 * the custody groups, the profit-and-loss series — and no exporter ever looks at it, which is
 * why the two can differ in shape without the export drifting from the report.
 */
export interface ReportResult {
  key: ReportKey;
  /** `17`, rule 6: every response says when it ran and with exactly which filters. */
  generatedAt: string;
  filters: Record<string, unknown>;
  columns: ExportColumn[];
  rows: ReportRow[];
  totals: Record<string, number | string>;
  extra?: Record<string, unknown>;
  /** Column the xlsx export splits worksheets on (`17`, export formatting). */
  sheetKey?: string;
  /** True when the row cap truncated the answer, so a reader knows not to trust the totals. */
  truncated?: boolean;
}

/**
 * The per-report knobs, separated from the DTO that carries them.
 *
 * An export job re-runs a report hours after the request that asked for it, from filters read
 * back out of a table rather than from a validated query object — so the runner is typed on what
 * a report actually reads, and both callers can satisfy it.
 */
export interface ReportRunQuery {
  sortBy?: string;
  sortDir?: SortDirection;
  groupBy?: CustodyGroupBy;
  days?: number;
  granularity?: ReportGranularity;
}

/** Everything a report query needs that is not one of its own filters. */
export interface ReportContext {
  scope: BranchScope;
  /** Part of the cache key (`17`, rule 7), so one principal's scope never serves another's. */
  userId: string;
  locale: Locale;
  /** Resolved once by the runner: null means every branch. */
  branchId: string | null;
  /** Inclusive date-only bounds, defaulted by the runner when the caller sent none. */
  from: string;
  to: string;
  /** `17`, rule 3 — the cap a report list is truncated at. */
  maxRows: number;
}
