import { registerAs } from '@nestjs/config';

export interface ReportsConfig {
  /** `17`, rule 7: five minutes of staleness on a report is acceptable and needs no invalidation. */
  cacheTtlSeconds: number;
  /** Lifetime of the signed download URL a finished job hands back. */
  downloadTtlSeconds: number;
  /**
   * The cap a report list is truncated at. Reports are read-only and run on a request thread or a
   * worker, and neither should be able to stream a million rows into a spreadsheet.
   */
  maxRows: number;
  /** How long a finished export file is kept before the next sweep may remove it. */
  fileRetentionHours: number;
  /**
   * False when Redis is absent. Export jobs then run inline and are `READY` by the time the
   * caller is told about them, which keeps the poll contract identical in every environment.
   */
  queueEnabled: boolean;
  /**
   * Whether the hourly retention sweep is registered. Off under test for the same reason the
   * notification sweeps are: a clock deleting rows underneath a suite's assertions is a flake
   * nobody can reproduce.
   */
  sweepEnabled: boolean;
}

const HOUR_SECONDS = 3600;

export const reportsConfig = registerAs('reports', (): ReportsConfig => {
  const downloadTtlHours = Number(process.env.REPORT_DOWNLOAD_TTL_HOURS ?? 24);

  return {
    cacheTtlSeconds: Number(process.env.REPORT_CACHE_TTL_SECONDS ?? 300),
    downloadTtlSeconds: downloadTtlHours * HOUR_SECONDS,
    maxRows: Number(process.env.REPORT_MAX_ROWS ?? 20000),
    fileRetentionHours: downloadTtlHours,
    queueEnabled: Boolean(process.env.REDIS_HOST) && process.env.REPORT_QUEUE_ENABLED !== 'false',
    sweepEnabled:
      process.env.REPORT_SWEEP_ENABLED === 'true' ||
      (process.env.NODE_ENV !== 'test' && process.env.REPORT_SWEEP_ENABLED !== 'false'),
  };
});
