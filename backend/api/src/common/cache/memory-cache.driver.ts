import { CacheDriver } from './cache.driver';

interface MemoryEntry {
  value: string;
  expiresAt: number | null;
}

/**
 * Entry ceiling. Expired keys are only evicted when read, and keys like
 * `login:attempts:{phone}:{ip}` are unbounded in cardinality — so without a cap a
 * long-running dev or CI process grows until it runs out of memory.
 */
const MAX_ENTRIES = 10_000;

/**
 * In-process cache used when Redis is not configured (local dev and tests).
 * Not suitable for multi-instance deployments — `env.validation` requires Redis in production.
 */
export class MemoryCacheDriver implements CacheDriver {
  readonly name = 'memory' as const;
  private readonly store = new Map<string, MemoryEntry>();

  private read(key: string): MemoryEntry | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.read(key)?.value ?? null);
  }

  set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.store.has(key)) this.evictIfFull();

    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
    return Promise.resolve();
  }

  /**
   * Sweeps expired entries first; if that frees nothing, drops the oldest insertions
   * (Map preserves insertion order) so the cache stays bounded.
   */
  private evictIfFull(): void {
    if (this.store.size < MAX_ENTRIES) return;

    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) this.store.delete(key);
    }

    while (this.store.size >= MAX_ENTRIES) {
      const oldest = this.store.keys().next();
      if (oldest.done) break;
      this.store.delete(oldest.value);
    }
  }

  del(...keys: string[]): Promise<void> {
    for (const key of keys) this.store.delete(key);
    return Promise.resolve();
  }

  delByPattern(pattern: string): Promise<void> {
    const matcher = globToRegExp(pattern);
    for (const key of this.store.keys()) {
      if (matcher.test(key)) this.store.delete(key);
    }
    return Promise.resolve();
  }

  incr(key: string, ttlSeconds?: number): Promise<number> {
    const existing = this.read(key);
    if (!existing) this.evictIfFull();

    const next = Number(existing?.value ?? 0) + 1;
    this.store.set(key, {
      value: String(next),
      expiresAt: existing?.expiresAt ?? (ttlSeconds ? Date.now() + ttlSeconds * 1000 : null),
    });
    return Promise.resolve(next);
  }

  ttl(key: string): Promise<number> {
    const entry = this.read(key);
    if (!entry) return Promise.resolve(-2);
    if (entry.expiresAt === null) return Promise.resolve(-1);
    return Promise.resolve(Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  ping(): Promise<boolean> {
    return Promise.resolve(true);
  }

  close(): Promise<void> {
    this.store.clear();
    return Promise.resolve();
  }
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}
