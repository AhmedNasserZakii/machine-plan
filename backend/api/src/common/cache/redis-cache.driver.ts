import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisConfig } from 'src/config';
import { CacheDriver } from './cache.driver';

const SCAN_BATCH_SIZE = 500;

export class RedisCacheDriver implements CacheDriver {
  readonly name = 'redis' as const;
  private readonly logger = new Logger(RedisCacheDriver.name);
  private readonly client: Redis;

  constructor(config: RedisConfig) {
    this.client = new Redis({
      host: config.host as string,
      port: config.port,
      password: config.password ?? undefined,
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    this.client.on('error', (error: Error) => {
      this.logger.error({ err: error }, 'Redis connection error');
    });
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.del(...keys);
  }

  /** Uses SCAN rather than KEYS so a large keyspace does not block the server. */
  async delByPattern(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        SCAN_BATCH_SIZE,
      );
      cursor = nextCursor;
      if (keys.length > 0) await this.client.del(...keys);
    } while (cursor !== '0');
  }

  /**
   * Increment and expiry are applied together.
   *
   * Setting the TTL only when the counter happens to be 1 leaves a window: if the process
   * dies (or Redis errors) between INCR and EXPIRE, the key never expires — and for the
   * login-lockout keys that means a phone/IP pair locked out permanently. `EXPIRE ... NX`
   * sets it whenever it is missing, which is idempotent and self-healing.
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (!ttlSeconds || ttlSeconds <= 0) return this.client.incr(key);

    const [[, value]] = (await this.client
      .multi()
      .incr(key)
      .expire(key, ttlSeconds, 'NX')
      .exec()) as [[Error | null, number], [Error | null, number]];

    return value;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
