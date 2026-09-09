import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService, HealthIndicatorResult } from '@nestjs/terminus';
import { randomUUID } from 'node:crypto';
import { AppConfig, StorageConfig } from 'src/config';
import { StorageService } from 'src/modules/media/storage/storage.service';

/** A stalled disk must fail readiness rather than hang the probe. */
const PROBE_TIMEOUT_MS = 2000;

@Injectable()
export class StorageHealthIndicator {
  constructor(
    private readonly config: ConfigService,
    private readonly indicator: HealthIndicatorService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Writes, reads back and removes a canary object. Reporting config values without
   * touching storage would let readiness pass while every upload fails.
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const check = this.indicator.check(key);
    const storage = this.config.getOrThrow<StorageConfig>('storage');
    const app = this.config.getOrThrow<AppConfig>('app');

    // Boot-time env validation already refuses to start in production without S3 configured
    // (`env.validation.ts`), so `backend` here reflects what is genuinely active rather than a
    // known gap — this check exists to catch it going *unhealthy* at runtime (bad credentials,
    // an unreachable endpoint, a deleted bucket), not to catch it being unconfigured.
    const details = {
      backend: this.storage.backend,
      configured: storage.enabled,
      ...(storage.bucket ? { bucket: storage.bucket } : {}),
      ...(app.isProduction && this.storage.backend === 'local-disk'
        ? { warning: 'object storage is not configured for production' }
        : {}),
    };

    const probeKey = `health/.probe-${randomUUID()}`;

    try {
      await withTimeout(this.probe(probeKey), PROBE_TIMEOUT_MS);
    } catch (error) {
      return check.down({ ...details, error: (error as Error).message });
    }

    return app.isProduction && this.storage.backend === 'local-disk'
      ? check.down(details)
      : check.up(details);
  }

  private async probe(probeKey: string): Promise<void> {
    const payload = Buffer.from('ok');

    try {
      await this.storage.put(probeKey, payload);
      const head = await this.storage.head(probeKey);

      if (!head || head.sizeBytes !== payload.byteLength) {
        throw new Error('storage write could not be read back');
      }
    } finally {
      await this.storage.delete(probeKey).catch(() => undefined);
    }
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_resolve, reject) =>
      setTimeout(() => reject(new Error(`storage probe timed out after ${ms}ms`)), ms).unref(),
    ),
  ]);
}
