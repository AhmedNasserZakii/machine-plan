import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public, SkipVersionCheck } from 'src/common/decorators';
import { StorageHealthIndicator } from './indicators/storage.health';
import { CacheHealthIndicator } from './indicators/cache.health';

/** An uptime monitor polls this every few seconds from a handful of fixed IPs — the last place
 * that should ever see `RATE_LIMITED` or `CLIENT_UPGRADE_REQUIRED`; it never sends `X-Client-Version`. */
@SkipThrottle()
@SkipVersionCheck()
@ApiExcludeController()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly storage: StorageHealthIndicator,
    private readonly cache: CacheHealthIndicator,
  ) {}

  /** Liveness — 200 as long as the process is up. Never touches dependencies. */
  @Public()
  @Get()
  live(): { status: string; uptime: number; timestamp: string } {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness — verifies the dependencies the API cannot serve traffic without. */
  @Public()
  @Get('ready')
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
      () => this.cache.isHealthy('cache'),
      () => this.storage.isHealthy('storage'),
    ]);
  }
}
