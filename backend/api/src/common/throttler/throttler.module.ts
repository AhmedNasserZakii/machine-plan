import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheService } from '../cache';
import { CacheThrottlerStorage } from './cache-throttler-storage';

const MINUTE_MS = 60_000;

/**
 * `4.2`'s ceilings, minus report-export: that one has no single route to decorate (17 report
 * endpoints all funnel into one export-job flow), so it is enforced directly in
 * `ReportJobsService.create()` against the same `CacheService` this storage wraps, rather than
 * through a throttler name here.
 *
 * `sync-batch` and `media-presign` are registered with a limit high enough to never trip in
 * practice — they are no-ops everywhere except the one route each that overrides them with
 * `@Throttle({...})` to the real, tight limit (`sync.controller.ts`, `media.controller.ts`).
 * Every named throttler otherwise runs on *every* route (`@nestjs/throttler`'s own default), so
 * this is what keeps the two specific ceilings from also being checked, uselessly, everywhere
 * `'default'` already applies.
 */
export const THROTTLE_UNBOUNDED = 1_000_000;

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      // `CacheService` comes from the (`@Global()`) `CacheModule`, so no `imports` entry is
      // needed here to reach it.
      inject: [CacheService],
      useFactory: (cache: CacheService) => ({
        storage: new CacheThrottlerStorage(cache),
        throttlers: [
          { name: 'default', ttl: MINUTE_MS, limit: 300, blockDuration: MINUTE_MS },
          {
            name: 'sync-batch',
            ttl: MINUTE_MS,
            limit: THROTTLE_UNBOUNDED,
            blockDuration: MINUTE_MS,
          },
          {
            name: 'media-presign',
            ttl: MINUTE_MS,
            limit: THROTTLE_UNBOUNDED,
            blockDuration: MINUTE_MS,
          },
        ],
      }),
    }),
  ],
  exports: [ThrottlerModule],
})
export class AppThrottlerModule {}
