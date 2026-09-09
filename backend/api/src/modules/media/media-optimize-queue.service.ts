import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { RedisConfig } from 'src/config';
import { queueJobsFailedTotal } from 'src/common/metrics/metrics';
import { captureError } from 'src/common/observability/sentry';

interface OptimizeJobData {
  mediaId: string;
}

export type OptimizeHandler = (mediaId: string) => Promise<void>;

const QUEUE_NAME = 'media-optimize';
const READY_TIMEOUT_MS = 2000;

/**
 * The `media-optimize` queue (`19`, `3.2`). Same broker-with-inline-fallback shape as
 * `ReportQueueService`/`AuditQueueService`: without Redis (dev, CI, the e2e suite), the job runs
 * on the confirming request instead of being silently dropped — a slower `confirm` response is
 * fine, an unoptimized photo nobody ever re-processes is not.
 */
@Injectable()
export class MediaOptimizeQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(MediaOptimizeQueueService.name);
  private readonly redis: RedisConfig;

  private queue: Queue<OptimizeJobData> | null = null;
  private worker: Worker<OptimizeJobData> | null = null;
  private handler: OptimizeHandler | null = null;
  private started = false;

  constructor(config: ConfigService) {
    this.redis = config.getOrThrow<RedisConfig>('redis');
  }

  get queued(): boolean {
    return this.queue !== null;
  }

  /** `null` when running inline (no broker) — distinct from a real, empty queue (`4.4`). */
  async depth(): Promise<number | null> {
    if (!this.queue) return null;
    const counts = await this.queue.getJobCounts('wait', 'active', 'delayed');
    return counts.wait + counts.active + counts.delayed;
  }

  async start(handler: OptimizeHandler): Promise<void> {
    this.handler = handler;

    if (this.started || !this.redis.host) return;
    this.started = true;

    const connection = {
      host: this.redis.host,
      port: this.redis.port,
      ...(this.redis.password ? { password: this.redis.password } : {}),
      maxRetriesPerRequest: null,
    };

    const queue = new Queue<OptimizeJobData>(QUEUE_NAME, { connection });

    try {
      await withTimeout(queue.waitUntilReady(), READY_TIMEOUT_MS);
    } catch (error) {
      this.logger.warn(
        { err: error, host: this.redis.host },
        'Media optimize queue broker did not answer — optimization will run inline',
      );
      await queue.close().catch(() => undefined);
      return;
    }

    this.queue = queue;
    this.worker = new Worker<OptimizeJobData>(
      QUEUE_NAME,
      async (job) => {
        await this.handler?.(job.data.mediaId);
      },
      { connection },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        { err: error, mediaId: job?.data.mediaId },
        'Media optimization permanently failed after all retries',
      );
      queueJobsFailedTotal.inc({ queue: QUEUE_NAME });
      captureError(error, { queue: QUEUE_NAME, mediaId: job?.data.mediaId });
    });

    this.logger.log(`Media optimization is queued on ${this.redis.host}:${this.redis.port}`);
  }

  /**
   * Never throws: a photo that stays un-optimized is a smaller/slower list view, not a failed
   * hand-off. Retried automatically by BullMQ when a broker is present; a single best-effort
   * attempt when it is not.
   */
  async enqueue(mediaId: string): Promise<void> {
    if (this.queue) {
      await this.queue.add(
        'optimize',
        { mediaId },
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: 500,
        },
      );
      return;
    }

    try {
      await this.handler?.(mediaId);
    } catch (error) {
      this.logger.error({ err: error, mediaId }, 'Inline media optimization failed');
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
