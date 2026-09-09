import { registerAs } from '@nestjs/config';

export interface StorageConfig {
  /** When false, media endpoints report unavailable instead of failing obscurely. */
  enabled: boolean;
  endpoint: string | null;
  region: string;
  bucket: string | null;
  accessKeyId: string | null;
  secretAccessKey: string | null;
  forcePathStyle: boolean;
  uploadMaxBytes: number;
  uploadMaxMb: number;
  /** Where the local adapter keeps objects when S3 is not configured (dev, CI, e2e). */
  localDir: string;
  /** Prefix put in front of every issued upload/download URL. */
  publicBaseUrl: string;
  /** Signed URL lifetime. Fifteen minutes is long enough for a field upload on 3G. */
  urlTtlSeconds: number;
  /**
   * HMAC key for signed media URLs. A dedicated key: env validation requires it in
   * production and rejects reuse of the JWT secret, so a leak of one never widens into
   * the other subsystem. The dev-only fallback keeps local boots frictionless.
   */
  urlSigningSecret: string;
  /**
   * Whether the hourly orphaned-media sweep is registered. Off under test for the same reason
   * the report and notification sweeps are: a clock deleting rows underneath a suite's
   * assertions is a flake nobody can reproduce.
   */
  cleanupEnabled: boolean;
}

export const storageConfig = registerAs('storage', (): StorageConfig => {
  const bucket = process.env.S3_BUCKET ?? null;
  const uploadMaxMb = Number(process.env.UPLOAD_MAX_MB ?? 10);
  return {
    enabled: Boolean(bucket && process.env.S3_ACCESS_KEY_ID),
    endpoint: process.env.S3_ENDPOINT ?? null,
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket,
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? null,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? null,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    uploadMaxBytes: uploadMaxMb * 1024 * 1024,
    uploadMaxMb,
    localDir: process.env.STORAGE_LOCAL_DIR ?? 'storage',
    publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
    urlTtlSeconds: Number(process.env.STORAGE_URL_TTL_SECONDS ?? 900),
    urlSigningSecret: process.env.STORAGE_URL_SIGNING_SECRET ?? 'dev-only-storage-signing-key',
    cleanupEnabled:
      process.env.MEDIA_CLEANUP_ENABLED === 'true' ||
      (process.env.NODE_ENV !== 'test' && process.env.MEDIA_CLEANUP_ENABLED !== 'false'),
  };
});
