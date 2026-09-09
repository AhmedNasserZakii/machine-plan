import { createHash } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageConfig } from 'src/config/storage.config';
import { SignedUrl, StorageAdapter, StoredObject } from './storage.types';

/**
 * S3-compatible backend — real AWS S3 in production, MinIO in dev/CI (`19`: "Local dev uses MinIO
 * with the identical S3 API so nothing changes between environments").
 *
 * `head()` fetches the object rather than issuing a plain `HeadObjectCommand`: S3's `ETag` is an
 * MD5 digest for a normal (non-multipart) upload, not the SHA-256 the client declares at presign
 * and the local adapter also produces, so it cannot be compared against `media.checksum` as-is.
 * Every media purpose caps out at 5 MB (`operations.enum.ts`), so downloading once at confirm time
 * to compute a portable checksum is cheap — the same trade-off the local adapter already makes by
 * reading the whole file to hash it.
 */
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: StorageConfig) {
    if (!config.bucket) {
      throw new Error('S3StorageAdapter requires a configured bucket');
    }

    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId!,
        secretAccessKey: config.secretAccessKey!,
      },
    });
  }

  async uploadUrl(storageKey: string): Promise<SignedUrl> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: storageKey });
    return this.presign(command);
  }

  async downloadUrl(storageKey: string): Promise<SignedUrl> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: storageKey });
    return this.presign(command);
  }

  async put(storageKey: string, body: Buffer): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: storageKey, Body: body }),
    );

    return { sizeBytes: body.byteLength, checksum: sha256(body) };
  }

  async head(storageKey: string): Promise<StoredObject | null> {
    const body = await this.get(storageKey);
    if (!body) return null;

    return { sizeBytes: body.byteLength, checksum: sha256(body) };
  }

  async get(storageKey: string): Promise<Buffer | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
      const bytes = await result.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    } catch (error) {
      // Deleting an object that is already gone is not a failure — `MediaService` calls this
      // from cleanup paths that must be safe to retry.
      if (!isNotFound(error)) throw error;
    }
  }

  private async presign(command: PutObjectCommand | GetObjectCommand): Promise<SignedUrl> {
    const expiresIn = this.config.urlTtlSeconds;
    const url = await getSignedUrl(this.client, command, { expiresIn });

    return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
  }
}

function isNotFound(error: unknown): boolean {
  if (error instanceof S3ServiceException) {
    return (
      error.name === 'NoSuchKey' ||
      error.name === 'NotFound' ||
      error.$metadata.httpStatusCode === 404
    );
  }
  return false;
}

function sha256(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}
