import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { CacheService } from '../cache';

/**
 * Backs `@nestjs/throttler` with `CacheService` — the same Redis-or-memory driver already used
 * for the permission cache — instead of the package's own in-memory default, which would make
 * every limit per-process rather than per-deployment the moment there is more than one API
 * instance behind a load balancer.
 *
 * A deliberately simpler "fixed window" counter rather than the sliding window the default
 * in-memory storage implements: one atomic `INCR` with a TTL set on first hit
 * (`CacheService.incr`, already race-free — see `redis-cache.driver.ts`) is enough to answer
 * "how many hits in the current window", and a fixed window is the standard, well-understood
 * trade-off for exactly this kind of per-minute/per-hour API ceiling.
 */
@Injectable()
export class CacheThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly cache: CacheService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    _blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const ttlSeconds = Math.max(1, Math.ceil(ttl / 1000));
    const storageKey = `throttle:${throttlerName}:${key}`;

    const totalHits = await this.cache.incr(storageKey, ttlSeconds);
    const remaining = await this.cache.ttl(storageKey);
    // A missing or already-expired TTL (driver returns -1/-2, or the in-memory driver's own
    // "not found" sentinel) reads as "a fresh window just started" rather than "never expires".
    const timeToExpire = remaining > 0 ? remaining : ttlSeconds;

    const isBlocked = totalHits > limit;

    return {
      totalHits,
      timeToExpire,
      isBlocked,
      // Fixed window: the block clears exactly when the window does, not after a separate
      // `blockDuration` — the parameter exists for the interface's sake but every throttler this
      // app registers sets it equal to `ttl` (see `throttler.module.ts`), so this is never a
      // second, longer wait bolted on top of the window.
      timeToBlockExpire: isBlocked ? timeToExpire : 0,
    };
  }
}
