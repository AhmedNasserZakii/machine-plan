import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { RedisConfig } from 'src/config';
import { queueJobsFailedTotal } from '../metrics/metrics';
import { captureError } from '../observability/sentry';
import { AuditRecordRow } from './audit.types';

export type AuditWriteHandler = (record: AuditRecordRow) => Promise<void>;

const QUEUE_NAME = 'audit-log';

/** How long a first connection attempt is given before the queue is written off. */
const READY_TIMEOUT_MS = 2000;

/** Exhausted-retry jobs are kept (not `removeOnFail`) so they stay inspectable — the closest
 * thing to a dead-letter queue BullMQ offers without a second queue to manage. */
const JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true,
  removeOnFail: 500,
} as const;

/**
 * The audit write queue (`21`: "fire-and-forget through a BullMQ queue"). Same shape as
 * `ReportQueueService`, for the same reason: BullMQ needs Redis, Redis is optional in this
 * project, and the e2e suite runs with neither. Without a broker, a write runs inline instead of
 * being lost — a slower audit write is acceptable, a silently dropped one is not.
 */
@Injectable()
export class AuditQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(AuditQueueService.name);
  private readonly redis: RedisConfig;

  private queue: Queue<AuditRecordRow> | null = null;
  private worker: Worker<AuditRecordRow> | null = null;
  private handler: AuditWriteHandler | null = null;
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

  async start(handler: AuditWriteHandler): Promise<void> {
    this.handler = handler;

    if (this.started || !this.redis.host) return;
    this.started = true;

    const connection = {
      host: this.redis.host,
      port: this.redis.port,
      ...(this.redis.password ? { password: this.redis.password } : {}),
      maxRetriesPerRequest: null,
    };

    const queue = new Queue<AuditRecordRow>(QUEUE_NAME, { connection });

    try {
      await withTimeout(queue.waitUntilReady(), READY_TIMEOUT_MS);
    } catch (error) {
      this.logger.warn(
        { err: error, host: this.redis.host },
        'Audit queue broker did not answer — audit writes will run inline',
      );
      await queue.close().catch(() => undefined);
      return;
    }

    this.queue = queue;
    this.worker = new Worker<AuditRecordRow>(
      QUEUE_NAME,
      async (job) => {
        await this.handler?.(job.data);
      },
      { connection },
    );

    this.worker.on('failed', (job, error) => {
      // Exhausted all retries: this is the dead-letter signal an operator should alert on. The
      // job itself is kept in Redis (`removeOnFail`) for inspection rather than discarded.
      this.logger.error(
        { err: error, action: job?.data.action, entityId: job?.data.entityId },
        'Audit write permanently failed after all retries',
      );
      queueJobsFailedTotal.inc({ queue: QUEUE_NAME });
      captureError(error, { queue: QUEUE_NAME, action: job?.data.action });
    });

    this.logger.log(`Audit writes are queued on ${this.redis.host}:${this.redis.port}`);
  }

  /**
   * Never throws: a lost audit entry is a bug to fix, but a failed business operation because of
   * audit is worse (`21`). An inline failure is logged and swallowed for the same reason a queued
   * job's failure is only logged — the caller already got its real response.
   */
  async enqueue(record: AuditRecordRow): Promise<void> {
    if (this.queue) {
      await this.queue.add('write', record, JOB_OPTIONS);
      return;
    }

    try {
      await this.handler?.(record);
    } catch (error) {
      this.logger.error(
        { err: error, action: record.action, entityId: record.entityId },
        'Inline audit write failed',
      );
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
