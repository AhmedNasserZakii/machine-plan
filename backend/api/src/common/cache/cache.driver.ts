export interface CacheDriver {
  readonly name: 'redis' | 'memory';
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
  /** Deletes every key matching a glob pattern, e.g. `perm:*`. */
  delByPattern(pattern: string): Promise<void>;
  incr(key: string, ttlSeconds?: number): Promise<number>;
  ttl(key: string): Promise<number>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}
