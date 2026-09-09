import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Staging = 'staging',
  Production = 'production',
}

const toNumber = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    value === undefined || value === '' ? undefined : Number(value),
  );

const toBoolean = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === '') return undefined;
    return value === true || value === 'true' || value === '1';
  });

/** `@IsOptional()` only skips `null`/`undefined` — an unset `.env` entry (`KEY=`) is `''`. */
const emptyToUndefined = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value));

/**
 * The full contract of the process environment. The app refuses to boot if anything
 * here is missing or malformed — see `01-architecture-and-conventions.md`.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @toNumber()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  API_PREFIX: string = 'api';

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  // ---- database ----
  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @toNumber()
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number = 5432;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  @toBoolean()
  @IsBoolean()
  DB_SSL: boolean = false;

  /** Only disable for managed setups whose CA cannot be pinned — TLS without it is MITM-able. */
  @toBoolean()
  @IsBoolean()
  DB_SSL_REJECT_UNAUTHORIZED: boolean = true;

  @toBoolean()
  @IsBoolean()
  DB_LOGGING: boolean = false;

  @toNumber()
  @IsInt()
  @Min(1)
  DB_POOL_SIZE: number = 20;

  // ---- auth ----
  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters' })
  JWT_ACCESS_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_TTL: string = '30m';

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_TTL: string = '30d';

  @toNumber()
  @IsInt()
  @Min(1)
  LOGIN_MAX_ATTEMPTS: number = 5;

  @toNumber()
  @IsInt()
  @Min(1)
  LOGIN_LOCK_MINUTES: number = 15;

  // ---- redis (optional in local dev; required in production) ----
  @IsOptional()
  @IsString()
  REDIS_HOST?: string;

  @toNumber()
  @IsOptional()
  @IsInt()
  REDIS_PORT?: number;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @toNumber()
  @IsInt()
  @Min(1)
  PERMISSION_CACHE_TTL_SECONDS: number = 900;

  // ---- storage ----
  @IsOptional()
  @IsString()
  S3_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  S3_REGION?: string;

  @IsOptional()
  @IsString()
  S3_BUCKET?: string;

  @IsOptional()
  @IsString()
  S3_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  S3_SECRET_ACCESS_KEY?: string;

  @toBoolean()
  @IsBoolean()
  S3_FORCE_PATH_STYLE: boolean = true;

  @toNumber()
  @IsInt()
  @Min(1)
  UPLOAD_MAX_MB: number = 10;

  @IsOptional()
  @IsString()
  MEDIA_CLEANUP_ENABLED?: string;

  // ---- misc ----
  @IsString()
  @IsNotEmpty()
  LOG_LEVEL: string = 'info';

  @toNumber()
  @IsInt()
  @Min(1000)
  REQUEST_TIMEOUT_MS: number = 30000;

  /** Plain `major.minor[.patch]` — checked against `X-Client-Version` by `ClientVersionGuard`. */
  @emptyToUndefined()
  @IsOptional()
  @Matches(/^\d+(\.\d+)*$/, {
    message: 'MIN_CLIENT_VERSION must be a dotted version, e.g. 2.1.0',
  })
  MIN_CLIENT_VERSION?: string;

  /** Express `trust proxy` value: unset/false, true (one hop), a hop count, or a preset. */
  @IsOptional()
  @IsString()
  TRUST_PROXY?: string;

  /** Bearer token `GET /metrics` requires (`4.4`) — required in production, see below. */
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  METRICS_TOKEN?: string;

  /** `5.3`: error reporting. Empty/unset disables Sentry entirely — nothing else here matters. */
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  SENTRY_DSN?: string;

  @emptyToUndefined()
  @IsOptional()
  @IsString()
  SENTRY_ENVIRONMENT?: string;

  @emptyToUndefined()
  @toNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  SENTRY_TRACES_SAMPLE_RATE?: number;

  /** Dedicated HMAC key for signed media URLs — must not be the JWT signing key. */
  @IsOptional()
  @IsString()
  @MinLength(32, { message: 'STORAGE_URL_SIGNING_SECRET must be at least 32 characters' })
  STORAGE_URL_SIGNING_SECRET?: string;

  @toNumber()
  @IsInt()
  @Min(0)
  FINANCE_BACKDATE_LIMIT_DAYS: number = 90;

  @toNumber()
  @IsInt()
  @Min(0)
  FINANCE_EDIT_WINDOW_DAYS: number = 30;

  @toNumber()
  @IsInt()
  @Min(0)
  TRANSFER_CANCEL_WINDOW_MINUTES: number = 60;

  /** How long a machine may sit untouched before the weekly sweep flags it (`18`). */
  @toNumber()
  @IsInt()
  @Min(1)
  IDLE_ALERT_DAYS: number = 30;

  // ---- notifications (FCM is optional; the push transport disables itself without it) ----
  @IsOptional()
  @IsString()
  FCM_PROJECT_ID?: string;

  @IsOptional()
  @IsString()
  FCM_CLIENT_EMAIL?: string;

  @IsOptional()
  @IsString()
  FCM_PRIVATE_KEY?: string;

  @toNumber()
  @IsInt()
  @Min(0)
  @Max(23)
  NOTIFICATION_QUIET_HOURS_START: number = 21;

  @toNumber()
  @IsInt()
  @Min(0)
  @Max(23)
  NOTIFICATION_QUIET_HOURS_END: number = 8;

  /** Minutes east of UTC of the operating locale — Egypt is +120. */
  @toNumber()
  @IsInt()
  @Min(-720)
  @Max(840)
  NOTIFICATION_LOCAL_UTC_OFFSET_MINUTES: number = 120;

  @toNumber()
  @IsInt()
  @Min(1)
  NOTIFICATION_DIGEST_THRESHOLD: number = 5;

  @IsOptional()
  @IsString()
  NOTIFICATION_SCHEDULER_ENABLED?: string;

  @toNumber()
  @IsInt()
  @Min(1)
  SUBSCRIPTION_OVERDUE_DAYS: number = 7;

  // ---- reports ----
  @toNumber()
  @IsInt()
  @Min(0)
  REPORT_CACHE_TTL_SECONDS: number = 300;

  @toNumber()
  @IsInt()
  @Min(1)
  REPORT_DOWNLOAD_TTL_HOURS: number = 24;

  @toNumber()
  @IsInt()
  @Min(1)
  REPORT_MAX_ROWS: number = 20000;

  @IsOptional()
  @IsString()
  REPORT_QUEUE_ENABLED?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: false,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const summary = errors
      .map((error) => {
        const constraints = Object.values(error.constraints ?? {}).join(', ');
        return `  - ${error.property}: ${constraints}`;
      })
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${summary}`);
  }

  const productionProblems: string[] = [];
  if (validated.NODE_ENV === NodeEnv.Production) {
    if (!validated.REDIS_HOST) {
      productionProblems.push('  - REDIS_HOST: required in production');
    }
    if (
      /replace[_-]?me|change[_-]?me|example|secret[_-]?value/i.test(validated.JWT_ACCESS_SECRET)
    ) {
      productionProblems.push(
        '  - JWT_ACCESS_SECRET: still a placeholder value — generate a real secret',
      );
    }
    if (!validated.STORAGE_URL_SIGNING_SECRET) {
      productionProblems.push(
        '  - STORAGE_URL_SIGNING_SECRET: required in production (must differ from JWT_ACCESS_SECRET)',
      );
    } else if (validated.STORAGE_URL_SIGNING_SECRET === validated.JWT_ACCESS_SECRET) {
      productionProblems.push(
        '  - STORAGE_URL_SIGNING_SECRET: must not reuse JWT_ACCESS_SECRET — a leak of one would compromise both subsystems',
      );
    }
    // The local-disk adapter writes to the container's own filesystem, which is ephemeral and
    // not shared between replicas — fine for dev/CI/e2e, silently data-losing in production.
    if (!validated.S3_BUCKET || !validated.S3_ACCESS_KEY_ID || !validated.S3_SECRET_ACCESS_KEY) {
      productionProblems.push(
        '  - S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY: all required in production — ' +
          'object storage would otherwise fall back to local disk',
      );
    }
    // Without a token, `/metrics` would be either wide open (fleet layout, custody counts, queue
    // health — real operational intelligence) or the operator would have to trust network
    // placement alone, which this app has no way to verify at boot.
    if (!validated.METRICS_TOKEN) {
      productionProblems.push('  - METRICS_TOKEN: required in production to protect GET /metrics');
    }
  }

  if (productionProblems.length > 0) {
    throw new Error(`Invalid environment configuration:\n${productionProblems.join('\n')}`);
  }

  return validated;
}
