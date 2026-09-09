import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { CacheService } from 'src/common/cache';
import { DEFAULT_LOCALE, isSupportedLocale, Locale } from 'src/common/constants/locales';
import { ErrorCode } from 'src/common/constants/error-codes';
import { ReportFormat, ReportJobStatus, ReportKey } from 'src/common/enums/report.enum';
import { AppException } from 'src/common/errors';
import { reportJobsTotal } from 'src/common/metrics/metrics';
import { captureError } from 'src/common/observability/sentry';
import { ReportsConfig } from 'src/config/reports.config';
import { StorageService } from 'src/modules/media/storage/storage.service';
import { ReportJob } from '../entities/report-job.entity';
import { ReportContext, ReportRunQuery } from '../report.types';
import { ReportExportService } from './report-export.service';
import { ReportQueueService } from './report-queue.service';
import { ReportParams, ReportRunnerService } from './report-runner.service';

/**
 * The filters a job was created with, in the shape the runner needs them back.
 *
 * Written out rather than re-derived: the export may run minutes later on another process, and
 * re-resolving "the last ninety days" or the caller's branch scope then would silently produce a
 * file that does not match the report he was looking at.
 */
export interface StoredReportFilters extends ReportRunQuery {
  scopeBranchId: string | null;
  scopeUnrestricted: boolean;
  branchId: string | null;
  from: string;
  to: string;
  machineId?: string;
}

/** How often expired exports are swept off disk. Retention is measured in hours, not minutes. */
const RETENTION_SWEEP_MS = 60 * 60 * 1000;

/** `4.2`: 10 exports/hour/user. */
const EXPORT_LIMIT = 10;
const EXPORT_WINDOW_SECONDS = 60 * 60;

/**
 * Export jobs: the one thing a report is allowed to write (`17`, rule 1).
 *
 * A job is created `QUEUED` and handed to `ReportQueueService`, which either brokers it or runs
 * it on the spot. Either way the caller polls the same endpoint for the same statuses, and the
 * file lands in the same object store behind the same signed URL.
 */
@Injectable()
export class ReportJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportJobsService.name);
  private readonly config: ReportsConfig;
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(ReportJob) private readonly jobs: Repository<ReportJob>,
    private readonly runner: ReportRunnerService,
    private readonly exporter: ReportExportService,
    private readonly queue: ReportQueueService,
    private readonly storage: StorageService,
    private readonly cache: CacheService,
    config: ConfigService,
  ) {
    this.config = config.getOrThrow<ReportsConfig>('reports');
  }

  async onModuleInit(): Promise<void> {
    await this.queue.start((jobId) => this.execute(jobId));

    if (this.config.sweepEnabled) {
      this.sweepTimer = setInterval(() => void this.sweepExpired(), RETENTION_SWEEP_MS);
      this.sweepTimer.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = null;
  }

  async create(
    key: ReportKey,
    format: ReportFormat,
    context: ReportContext,
    query: ReportRunQuery,
    params: ReportParams,
  ): Promise<ReportJob> {
    // Refused before a row is written rather than after: a job that can only ever fail is not
    // something to hand somebody a poll URL for. JSON is the live-response shape, not a file —
    // it never reaches this job flow at all under normal use, but a caller asking for it
    // explicitly still gets a real error instead of a silently-wrong file.
    if (format === ReportFormat.JSON) {
      throw new AppException(ErrorCode.EXPORT_FORMAT_UNAVAILABLE, { params: { format } });
    }

    await this.assertExportRateLimit(context.userId);

    const filters: StoredReportFilters = {
      scopeBranchId: context.scope.branchId,
      scopeUnrestricted: context.scope.unrestricted,
      branchId: context.branchId,
      from: context.from,
      to: context.to,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      groupBy: query.groupBy,
      days: query.days,
      granularity: query.granularity,
      machineId: params.machineId,
    };

    const job = await this.jobs.save(
      this.jobs.create({
        reportKey: key,
        format,
        requestedByUserId: context.userId,
        filters: { ...filters },
        locale: context.locale,
        status: ReportJobStatus.QUEUED,
        expiresAt: new Date(Date.now() + this.config.fileRetentionHours * 60 * 60 * 1000),
        createdBy: context.userId,
      }),
    );

    await this.queue.enqueue(job.id);

    // Re-read because the inline path has already finished by now, and handing back the stale
    // in-memory row would tell the caller `QUEUED` about a file that is on disk.
    return (await this.jobs.findOne({ where: { id: job.id } })) ?? job;
  }

  /** A job belongs to whoever asked for it; anyone else gets the same 404 as a bad id. */
  async findOne(id: string, userId: string): Promise<ReportJob> {
    const job = await this.jobs.findOne({ where: { id, requestedByUserId: userId } });
    if (!job) throw AppException.notFound(ErrorCode.NOT_FOUND);

    return job;
  }

  /**
   * A fresh signed URL each time it is polled.
   *
   * The signature's own TTL is shorter than the file's retention, so minting one per poll is what
   * makes a link handed out at 09:00 still work at 16:00 — the job stays valid until it expires,
   * and only the URL is short-lived.
   */
  async downloadUrlFor(job: ReportJob): Promise<string | null> {
    if (job.status !== ReportJobStatus.READY || !job.storageKey) return null;

    return (await this.storage.downloadUrl(job.storageKey)).url;
  }

  /**
   * Runs one job to completion. Never throws: the outcome belongs on the row, which is the only
   * thing the caller can see.
   */
  async execute(jobId: string): Promise<void> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job || job.status !== ReportJobStatus.QUEUED) return;

    await this.jobs.update(job.id, { status: ReportJobStatus.RUNNING, startedAt: new Date() });

    try {
      const filters = job.filters as unknown as StoredReportFilters;
      const locale: Locale = isSupportedLocale(job.locale) ? job.locale : DEFAULT_LOCALE;

      const context: ReportContext = {
        scope: { branchId: filters.scopeBranchId, unrestricted: filters.scopeUnrestricted },
        userId: job.requestedByUserId,
        locale,
        branchId: filters.branchId,
        from: filters.from,
        to: filters.to,
        maxRows: this.config.maxRows,
      };

      const result = await this.runner.run(job.reportKey, context, filters, {
        machineId: filters.machineId,
      });

      const file = await this.exporter.render(result, job.format, locale);
      const storageKey = `reports/${job.id}/${file.filename}`;
      const stored = await this.storage.put(storageKey, file.body);

      await this.jobs.update(job.id, {
        status: ReportJobStatus.READY,
        rowCount: file.rowCount,
        storageKey,
        filename: file.filename,
        mimeType: file.mimeType,
        sizeBytes: stored.sizeBytes,
        completedAt: new Date(),
        errorCode: null,
      });
      reportJobsTotal.inc({ format: job.format, status: ReportJobStatus.READY });
    } catch (error) {
      const code = error instanceof AppException ? error.code : ErrorCode.INTERNAL_ERROR;

      this.logger.error({ err: error, jobId, reportKey: job.reportKey }, 'Report export failed');
      await this.jobs.update(job.id, {
        status: ReportJobStatus.FAILED,
        errorCode: code,
        completedAt: new Date(),
      });
      reportJobsTotal.inc({ format: job.format, status: ReportJobStatus.FAILED });
      // A validation-shaped `AppException` here would mean a stored filter set became invalid
      // between creation and execution — worth knowing about, but not an incident. Only an
      // unexpected error (no stable `code` at all) is actually worth an error-reporting alert.
      if (!(error instanceof AppException)) {
        captureError(error, { jobId, reportKey: job.reportKey });
      }
    }
  }

  /**
   * Drops expired exports and the files behind them.
   *
   * A report file is a snapshot of data somebody is entitled to *today*; leaving them on disk
   * turns a signed URL into a permanent copy of the ledger that outlives the account that asked
   * for it.
   */
  async purgeExpired(now = new Date()): Promise<number> {
    const expired = await this.jobs.find({ where: { expiresAt: LessThanOrEqual(now) } });
    if (expired.length === 0) return 0;

    for (const job of expired) {
      if (job.storageKey) await this.storage.delete(job.storageKey).catch(() => undefined);
    }

    await this.jobs.remove(expired);

    return expired.length;
  }

  private async sweepExpired(): Promise<void> {
    try {
      const removed = await this.purgeExpired();
      if (removed > 0) this.logger.log(`Removed ${removed} expired report export(s)`);
    } catch (error) {
      // Retention is best-effort housekeeping; the next hour is a perfectly good retry.
      this.logger.error({ err: error }, 'Report retention sweep failed');
    }
  }

  /**
   * `4.2`: 10 exports/hour/user, checked here rather than through `@nestjs/throttler`/`AppThrottlerGuard`
   * like the other three ceilings — this is the one choke point shared by all 17 report routes
   * (`reports.controller.ts`'s `deliver()`), where decorating every individual route would be
   * both tedious and one missed addition away from silently unprotected.
   *
   * The same fixed-window counter `CacheThrottlerStorage` uses, hand-rolled rather than shared
   * code: it is three lines, and the two call sites want different things back on the way out
   * (a `ThrottlerStorageRecord` there, a thrown `AppException` with a `Retry-After` header here).
   */
  private async assertExportRateLimit(userId: string): Promise<void> {
    const key = `throttle:report-export:${userId}`;
    const hits = await this.cache.incr(key, EXPORT_WINDOW_SECONDS);

    if (hits > EXPORT_LIMIT) {
      const remaining = await this.cache.ttl(key);
      throw AppException.tooManyRequests(
        ErrorCode.RATE_LIMITED,
        remaining > 0 ? remaining : EXPORT_WINDOW_SECONDS,
      );
    }
  }
}
