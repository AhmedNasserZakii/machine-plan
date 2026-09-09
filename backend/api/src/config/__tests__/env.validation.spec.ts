import { NodeEnv, validateEnv } from '../env.validation';

const validEnv = {
  NODE_ENV: 'development',
  DB_HOST: 'localhost',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_NAME: 'machinery',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
};

/** The extra keys production requires beyond the dev baseline. */
const productionExtras = {
  NODE_ENV: NodeEnv.Production,
  REDIS_HOST: 'redis',
  STORAGE_URL_SIGNING_SECRET: 's'.repeat(32),
  S3_BUCKET: 'machinery-media',
  S3_ACCESS_KEY_ID: 'AKIAEXAMPLE',
  S3_SECRET_ACCESS_KEY: 'secret-access-key-value',
  METRICS_TOKEN: 'm'.repeat(32),
};

describe('validateEnv', () => {
  it('accepts a valid environment and applies defaults', () => {
    const result = validateEnv({ ...validEnv });

    expect(result.PORT).toBe(3000);
    expect(result.API_PREFIX).toBe('api');
    expect(result.JWT_ACCESS_TTL).toBe('30m');
    expect(result.FINANCE_BACKDATE_LIMIT_DAYS).toBe(90);
  });

  it('coerces numeric strings', () => {
    const result = validateEnv({ ...validEnv, PORT: '8080', DB_POOL_SIZE: '50' });

    expect(result.PORT).toBe(8080);
    expect(result.DB_POOL_SIZE).toBe(50);
  });

  it('coerces boolean strings', () => {
    expect(validateEnv({ ...validEnv, DB_SSL: 'true' }).DB_SSL).toBe(true);
    expect(validateEnv({ ...validEnv, DB_SSL: 'false' }).DB_SSL).toBe(false);
  });

  it('refuses to boot when a required variable is missing', () => {
    const { DB_HOST: _omitted, ...withoutHost } = validEnv;

    expect(() => validateEnv(withoutHost)).toThrow(/DB_HOST/);
  });

  it('refuses to boot on a short JWT secret', () => {
    expect(() => validateEnv({ ...validEnv, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
      /at least 32 characters/,
    );
  });

  it('refuses to boot on an unknown NODE_ENV', () => {
    expect(() => validateEnv({ ...validEnv, NODE_ENV: 'staging-2' })).toThrow(/NODE_ENV/);
  });

  it('requires Redis in production', () => {
    const { REDIS_HOST: _omitted, ...withoutRedis } = { ...validEnv, ...productionExtras };
    expect(() => validateEnv(withoutRedis)).toThrow(/REDIS_HOST: required in production/);

    expect(validateEnv({ ...validEnv, ...productionExtras }).REDIS_HOST).toBe('redis');
  });

  it('rejects placeholder JWT secrets in production', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        ...productionExtras,
        JWT_ACCESS_SECRET: 'replace_me_with_a_32_char_minimum_secret_value',
      }),
    ).toThrow(/JWT_ACCESS_SECRET: still a placeholder/);
  });

  it('requires a dedicated storage signing secret in production', () => {
    const { STORAGE_URL_SIGNING_SECRET: _omitted, ...withoutStorageSecret } = {
      ...validEnv,
      ...productionExtras,
    };
    expect(() => validateEnv(withoutStorageSecret)).toThrow(/STORAGE_URL_SIGNING_SECRET/);

    expect(() =>
      validateEnv({
        ...validEnv,
        ...productionExtras,
        STORAGE_URL_SIGNING_SECRET: validEnv.JWT_ACCESS_SECRET,
      }),
    ).toThrow(/must not reuse JWT_ACCESS_SECRET/);
  });

  it('requires S3 object storage in production', () => {
    const { S3_BUCKET: _omitted, ...withoutBucket } = { ...validEnv, ...productionExtras };
    expect(() => validateEnv(withoutBucket)).toThrow(
      /S3_BUCKET \/ S3_ACCESS_KEY_ID \/ S3_SECRET_ACCESS_KEY: all required in production/,
    );

    expect(validateEnv({ ...validEnv, ...productionExtras }).S3_BUCKET).toBe('machinery-media');
  });

  it('requires a metrics token in production', () => {
    const { METRICS_TOKEN: _omitted, ...withoutToken } = { ...validEnv, ...productionExtras };
    expect(() => validateEnv(withoutToken)).toThrow(
      /METRICS_TOKEN: required in production to protect GET \/metrics/,
    );

    expect(validateEnv({ ...validEnv, ...productionExtras }).METRICS_TOKEN).toBe('m'.repeat(32));
  });

  it('rejects a malformed MIN_CLIENT_VERSION but accepts an unset one', () => {
    expect(() => validateEnv({ ...validEnv, MIN_CLIENT_VERSION: 'v2' })).toThrow(
      /MIN_CLIENT_VERSION must be a dotted version/,
    );
    expect(validateEnv({ ...validEnv, MIN_CLIENT_VERSION: '' }).MIN_CLIENT_VERSION).toBeUndefined();
    expect(validateEnv({ ...validEnv, MIN_CLIENT_VERSION: '2.1.0' }).MIN_CLIENT_VERSION).toBe(
      '2.1.0',
    );
  });

  it('rejects an empty DB password', () => {
    expect(() => validateEnv({ ...validEnv, DB_PASSWORD: '' })).toThrow(/DB_PASSWORD/);
  });

  it('rejects an out-of-range port', () => {
    expect(() => validateEnv({ ...validEnv, PORT: '70000' })).toThrow(/PORT/);
  });
});
