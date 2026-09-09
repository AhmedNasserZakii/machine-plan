import { registerAs } from '@nestjs/config';
import { NodeEnv } from './env.validation';

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  logLevel: string;
  requestTimeoutMs: number;
  minClientVersion: string | null;
  isProduction: boolean;
  isTest: boolean;
  /**
   * Express `trust proxy` value. Without it, behind nginx/ALB every request carries the
   * proxy's IP, which turns the phone+IP login throttle into a per-phone global lock that
   * an attacker can trigger against any victim. `false` (default) for direct exposure;
   * a hop count (e.g. `1`) or an express preset (e.g. `loopback`) when proxied.
   */
  trustProxy: boolean | number | string;
  /**
   * Whether `AppThrottlerGuard` enforces anything at all. Off under test for the same reason
   * every scheduled sweep in this app is: dozens of e2e specs share one seeded Director across
   * hundreds of requests inside a single test run, and a global per-user ceiling tripping mid-way
   * through an unrelated suite is a flake nobody could ever reproduce outside CI.
   * `test/rate-limiting.e2e-spec.ts` forces this back on for its own isolated app instance.
   */
  throttleEnabled: boolean;
  /** Bearer token `MetricsAuthGuard` requires on `GET /metrics` (`4.4`). `null` outside production
   * leaves it open for a local Prometheus/curl; `env.validation.ts` hard-requires it in production. */
  metricsToken: string | null;
}

export const appConfig = registerAs('app', (): AppConfig => {
  const nodeEnv = (process.env.NODE_ENV as NodeEnv) ?? NodeEnv.Development;
  return {
    nodeEnv,
    port: Number(process.env.PORT ?? 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    corsOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 30000),
    minClientVersion: process.env.MIN_CLIENT_VERSION ?? null,
    isProduction: nodeEnv === NodeEnv.Production,
    isTest: nodeEnv === NodeEnv.Test,
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    throttleEnabled:
      process.env.THROTTLE_ENABLED === 'true' ||
      (nodeEnv !== NodeEnv.Test && process.env.THROTTLE_ENABLED !== 'false'),
    metricsToken: process.env.METRICS_TOKEN || null,
  };
});

function parseTrustProxy(raw: string | undefined): boolean | number | string {
  if (!raw || raw === 'false' || raw === '0') return false;
  if (raw === 'true') return 1; // trust exactly one hop, never a client-supplied chain
  const hops = Number(raw);
  return Number.isInteger(hops) && hops > 0 ? hops : raw;
}
