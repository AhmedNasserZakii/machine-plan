import { registerAs } from '@nestjs/config';
import { NodeEnv } from './env.validation';

export interface SentryConfig {
  enabled: boolean;
  dsn: string | null;
  environment: string;
  /** 0–1. Defaults to 0 (errors only) — this integration is error reporting, not APM. */
  tracesSampleRate: number;
}

export const sentryConfig = registerAs('sentry', (): SentryConfig => {
  const dsn = process.env.SENTRY_DSN || null;
  const nodeEnv = (process.env.NODE_ENV as NodeEnv) ?? NodeEnv.Development;

  return {
    enabled: dsn !== null,
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || nodeEnv,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  };
});
