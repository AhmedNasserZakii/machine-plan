import * as Sentry from '@sentry/node';
import { SentryConfig } from 'src/config/sentry.config';

let initialized = false;

/**
 * `5.3`: called once, right after `NestFactory.create()` in `main.ts`. A no-op when
 * `SENTRY_DSN` is unset (`config.enabled` is false), the same "off unless configured" shape
 * every other optional integration in this app uses (Redis, S3, the report/media queues). No
 * auto-instrumentation is enabled (`tracesSampleRate` defaults to `0`) — this is error
 * reporting, not APM, so initializing this late (rather than before any module is imported, as
 * Sentry's own docs prefer for framework auto-instrumentation) loses nothing here.
 *
 * Also installs process-level handlers for the two failure classes that never reach
 * `AllExceptionsFilter`: an uncaught exception is reported, then the process exits — the same
 * thing Node already does by default, just with a report filed first — and an unhandled
 * rejection is reported and logged without forcing an exit, since several places in this
 * codebase (queue workers, scheduled sweeps) already treat a swallowed rejection as a recoverable,
 * logged event rather than a fatal one.
 */
export function initSentry(config: SentryConfig): void {
  if (!config.enabled || !config.dsn) return;

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    tracesSampleRate: config.tracesSampleRate,
  });

  initialized = true;

  process.on('uncaughtException', (error) => {
    captureError(error, { source: 'uncaughtException' });
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    captureError(reason, { source: 'unhandledRejection' });
    process.stderr.write(`${reason instanceof Error ? reason.stack : String(reason)}\n`);
  });
}

/**
 * Reports an error that will not otherwise reach `AllExceptionsFilter` — a queue worker's
 * exhausted-retries handler, a scheduled sweep's catch block, a background dispatch that already
 * swallows its own failure to protect the caller. Safe to call unconditionally: it is a true
 * no-op when `initSentry` was never called (nothing configured) or never ran (Sentry's own client
 * is `undefined` until `init()`), so call sites do not need their own `if (sentryEnabled)` guard.
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;

  Sentry.captureException(error, context ? { extra: context } : undefined);
}
