import { Injectable } from '@nestjs/common';
import { HealthIndicatorService, HealthIndicatorResult } from '@nestjs/terminus';
import { CacheService } from 'src/common/cache/cache.service';

@Injectable()
export class CacheHealthIndicator {
  constructor(
    private readonly cache: CacheService,
    private readonly indicator: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const check = this.indicator.check(key);
    const healthy = await this.cache.ping();

    return healthy
      ? check.up({ driver: this.cache.driver })
      : check.down({ driver: this.cache.driver });
  }
}
