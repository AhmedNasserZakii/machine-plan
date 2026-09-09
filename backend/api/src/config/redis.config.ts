import { registerAs } from '@nestjs/config';

export interface RedisConfig {
  /** When false the app falls back to an in-process cache — local dev only. */
  enabled: boolean;
  host: string | null;
  port: number;
  password: string | null;
  permissionCacheTtlSeconds: number;
}

export const redisConfig = registerAs('redis', (): RedisConfig => {
  const host = process.env.REDIS_HOST ?? null;
  return {
    enabled: Boolean(host),
    host,
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD ?? null,
    permissionCacheTtlSeconds: Number(process.env.PERMISSION_CACHE_TTL_SECONDS ?? 900),
  };
});
