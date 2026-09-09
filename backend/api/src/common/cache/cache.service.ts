import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisConfig } from 'src/config';
import { CacheDriver } from './cache.driver';
import { MemoryCacheDriver } from './memory-cache.driver';
import { RedisCacheDriver } from './redis-cache.driver';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly cacheDriver: CacheDriver;

  constructor(config: ConfigService) {
    const redis = config.getOrThrow<RedisConfig>('redis');
    if (redis.enabled) {
      this.cacheDriver = new RedisCacheDriver(redis);
      this.logger.log(`Cache driver: redis (${redis.host}:${redis.port})`);
    } else {
      this.cacheDriver = new MemoryCacheDriver();
      this.logger.warn('Cache driver: in-process memory — not safe for multi-instance deployments');
    }
  }

  get driver(): CacheDriver['name'] {
    return this.cacheDriver.name;
  }

  /**
   * A cache read never fails a request. The permission cache sits on the authenticated
   * path, so letting a Redis blip propagate would turn a degraded cache into a total
   * outage — a miss just costs one query.
   */
  async getJson<T>(key: string): Promise<T | null> {
    let raw: string | null;

    try {
      raw = await this.cacheDriver.get(key);
    } catch (error) {
      this.logger.warn({ err: error, key }, 'Cache read failed — treating as a miss');
      return null;
    }

    if (raw === null) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      // A poisoned entry should never break a request — drop it and treat as a miss.
      await this.del(key).catch(() => undefined);
      return null;
    }
  }

  /** Same reasoning as `getJson`: failing to *store* a value is not a request failure. */
  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      await this.cacheDriver.set(key, JSON.stringify(value), ttlSeconds);
    } catch (error) {
      this.logger.warn({ err: error, key }, 'Cache write failed — value not cached');
    }
  }

  /** Returns the cached value, computing and storing it on a miss. */
  async remember<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.getJson<T>(key);
    if (cached !== null) return cached;
    const fresh = await factory();
    await this.setJson(key, fresh, ttlSeconds);
    return fresh;
  }

  del(...keys: string[]): Promise<void> {
    return this.cacheDriver.del(...keys);
  }

  delByPattern(pattern: string): Promise<void> {
    return this.cacheDriver.delByPattern(pattern);
  }

  incr(key: string, ttlSeconds?: number): Promise<number> {
    return this.cacheDriver.incr(key, ttlSeconds);
  }

  ttl(key: string): Promise<number> {
    return this.cacheDriver.ttl(key);
  }

  ping(): Promise<boolean> {
    return this.cacheDriver.ping();
  }

  async onModuleDestroy(): Promise<void> {
    await this.cacheDriver.close();
  }
}
