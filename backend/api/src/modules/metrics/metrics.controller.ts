import { Controller, Get, Header, UseGuards, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AuditQueueService } from 'src/common/audit/audit-queue.service';
import { Public, SkipVersionCheck } from 'src/common/decorators';
import { queueDepth } from 'src/common/metrics/metrics';
import { registry } from 'src/common/metrics/registry';
import { MediaOptimizeQueueService } from 'src/modules/media/media-optimize-queue.service';
import { ReportQueueService } from 'src/modules/reports/services/report-queue.service';
import { MetricsAuthGuard } from './metrics-auth.guard';

/**
 * `GET /metrics` (`4.4`, plan `22`). Authenticated by its own `MetricsAuthGuard` (a bearer
 * token, not a user JWT — a Prometheus scraper has neither a session nor permissions), so this
 * route opts out of the normal `JwtAuthGuard`/`PermissionsGuard` pipeline with `@Public()`
 * exactly like `/health` does, and out of the throttle and forced-upgrade checks for the same
 * reason `/health` is: an operational endpoint, not an app request.
 *
 * Queue depth is sampled here, at scrape time, rather than kept as a live gauge updated on every
 * enqueue/dequeue — Prometheus is pull-based, a `getJobCounts()` call is cheap, and it avoids a
 * gauge silently drifting from the real queue state if an update site is ever missed.
 */
@SkipThrottle()
@SkipVersionCheck()
@ApiExcludeController()
@UseGuards(MetricsAuthGuard)
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(
    private readonly auditQueue: AuditQueueService,
    private readonly mediaOptimizeQueue: MediaOptimizeQueueService,
    private readonly reportQueue: ReportQueueService,
  ) {}

  @Public()
  @Get()
  @Header('Content-Type', registry.contentType)
  async scrape(): Promise<string> {
    await this.sampleQueueDepths();
    return registry.metrics();
  }

  private async sampleQueueDepths(): Promise<void> {
    const queues: [string, () => Promise<number | null>][] = [
      ['audit-log', () => this.auditQueue.depth()],
      ['media-optimize', () => this.mediaOptimizeQueue.depth()],
      ['report-exports', () => this.reportQueue.depth()],
    ];

    for (const [name, depth] of queues) {
      const value = await depth();
      if (value !== null) queueDepth.set({ queue: name }, value);
    }
  }
}
