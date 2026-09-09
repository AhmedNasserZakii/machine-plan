import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

/**
 * The e2e suite recreates its database on every run, so it must never point at the
 * development one — that database is what the mobile app talks to locally.
 */
export const TEST_DB_NAME = process.env.TEST_DB_NAME ?? 'machinery_e2e';

/**
 * The seeded Director is created with `must_change_password`, which the global
 * PasswordChangeGuard enforces on every route. The suite rotates it once to this value;
 * `loginAsDirector` accepts either password so specs can run in any order.
 */
export const DIRECTOR_PASSWORD = 'E2eDirector#2026';

export function seedDirectorPhone(): string {
  return process.env.SEED_DIRECTOR_PHONE ?? '01000000000';
}

export function seedDirectorPassword(): string {
  const password = process.env.SEED_DIRECTOR_PASSWORD;
  if (!password) {
    throw new Error('SEED_DIRECTOR_PASSWORD must be set in .env to run the e2e suite');
  }
  return password;
}

/**
 * Applied as a side effect on import so it lands before `data-source.ts` or the config
 * factories read `process.env`. Registered as a Jest `setupFiles` entry and imported
 * directly by `reset-db.ts`.
 */
function applyTestEnv(): void {
  loadEnv({ path: resolve(__dirname, '../../.env') });

  process.env.NODE_ENV = 'test';
  process.env.DB_NAME = TEST_DB_NAME;
  process.env.DB_LOGGING = 'false';
  // Each spec file boots its own app. At the production pool size, six of them plus a
  // locally running dev API can exhaust Postgres `max_connections` and the run stalls.
  process.env.DB_POOL_SIZE = '5';
  // Keep the pino output out of the test report; set E2E_LOG_LEVEL=debug to get it back.
  process.env.LOG_LEVEL = process.env.E2E_LOG_LEVEL ?? 'silent';
  // Force the in-process cache driver so permission caching cannot leak across runs
  // or share a Redis keyspace with the dev instance.
  process.env.REDIS_HOST = '';
}

applyTestEnv();
