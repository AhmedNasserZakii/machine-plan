import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { RedisConfig } from 'src/config';
import { ReportsConfig } from 'src/config/reports.config';
import { queueJobsFailedTotal } from 'src/common/metrics/metrics';
import { captureError } from 'src/common/observability/sentry';

/** What a queued export carries. The job row holds everything else. */
interface ExportJobData {
  jobId: string;
}

export type ExportJobHandler = (jobId: string) => Promise<void>;

const QUEUE_NAME = 'report-exports';

/** How long a first connection attempt is given before the queue is written off. */
const READY_TIMEOUT_MS = 2000;

/**
 * The export queue, and its fallback (`17`).
 *
 * BullMQ needs Redis, and Redis is optional in this project — the cache degrades to memory
 * without it, and the e2e suite runs with neither. So this service is written around one rule:
 * **the poll contract is identical either way.** With a broker, an export is queued and the
 * caller polls until it is `READY`. Without one, the same work runs inline and the job is already
 * `READY` when the caller is told about it. Nothing downstream has to know which happened.
 *
 * The connection is proved at startup rather than assumed: `REDIS_HOST` pointing at something
 * that is not answering would otherwise leave every export sitting in `QUEUED` forever, which is
 * worse than doing the work on the request thread.
 */
@Injectable()
export class ReportQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(ReportQueueService.name);
  private readonly reports: ReportsConfig;
  private readonly redis: RedisConfig;

  private queue: Queue<ExportJobData> | null = null;
  private worker: Worker<ExportJobData> | null = null;
  private handler: ExportJobHandler | null = null;
  private started = false;

  constructor(config: ConfigService) {
    this.reports = config.getOrThrow<ReportsConfig>('reports');
    this.redis = config.getOrThrow<RedisConfig>('redis');
  }

  /** True once a broker has answered. Reported on the job so an operator can tell which path ran. */
  get queued(): boolean {
    return this.queue !== null;
  }

  /** `null` when running inline (no broker) — distinct from a real, empty queue (`4.4`). */
  async depth(): Promise<number | null> {
    if (!this.queue) return null;
    const counts = await this.queue.getJobCounts('wait', 'active', 'delayed');
    return counts.wait + counts.active + counts.delayed;
  }

  /**
   * Wires the executor and, if a broker is configured, brings up the queue and its worker.
   *
   * Called by `ReportJobsService` rather than from `onModuleInit` here: the worker needs the
   * executor, the executor needs repositories, and registering the dependency this way keeps the
   * arrow pointing one way instead of through a `forwardRef`.
   */
  async start(handler: ExportJobHandler): Promise<void> {
    this.handler = handler;

    if (this.started || !this.reports.queueEnabled || !this.redis.host) return;
    this.started = true;

    const connection = {
      host: this.redis.host,
      port: this.redis.port,
      ...(this.redis.password ? { password: this.redis.password } : {}),
      // Without this a broker that never answers keeps retrying behind every `add`, and the
      // caller waits on a promise that has no reason to settle.
      maxRetriesPerRequest: null,
    };

    const queue = new Queue<ExportJobData>(QUEUE_NAME, { connection });

    try {
      await withTimeout(queue.waitUntilReady(), READY_TIMEOUT_MS);
    } catch (error) {
      this.logger.warn(
        { err: error, host: this.redis.host },
        'Report queue broker did not answer — exports will run inline',
      );
      await queue.close().catch(() => undefined);

      return;
    }

    this.queue = queue;
    this.worker = new Worker<ExportJobData>(
      QUEUE_NAME,
      async (job) => {
        await this.handler?.(job.data.jobId);
      },
      { connection },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error({ err: error, jobId: job?.data.jobId }, 'Report export job failed');
      queueJobsFailedTotal.inc({ queue: QUEUE_NAME });
      captureError(error, { queue: QUEUE_NAME, jobId: job?.data.jobId });
    });

    this.logger.log(`Report exports are queued on ${this.redis.host}:${this.redis.port}`);
  }

  /**
   * Hands the job to the broker, or runs it here.
   *
   * An inline failure is swallowed on purpose: the job row records its own `FAILED` status and
   * error code, and the caller is polling for exactly that. Throwing would turn a failed export
   * into a failed request to *create* an export, which is a different and less useful answer.
   */
  async enqueue(jobId: string): Promise<void> {
    if (this.queue) {
      await this.queue.add('export', { jobId }, { removeOnComplete: true, removeOnFail: 100 });

      return;
    }

    try {
      await this.handler?.(jobId);
    } catch (error) {
      this.logger.error({ err: error, jobId }, 'Inline report export failed');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms).unref(),
    ),
  ]);
}
