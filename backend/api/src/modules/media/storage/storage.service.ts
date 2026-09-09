import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageConfig } from 'src/config/storage.config';
import { LocalDiskStorageAdapter } from './local-disk-storage.adapter';
import { S3StorageAdapter } from './s3-storage.adapter';
import { SignedUrl, StorageAdapter, StoredObject } from './storage.types';

export type { SignedUrl, StoredObject } from './storage.types';

/**
 * Selects and wraps one `StorageAdapter` — S3/MinIO when `S3_BUCKET` and `S3_ACCESS_KEY_ID` are
 * both set, the local filesystem otherwise (`19`). Everything outside this directory — `MediaService`,
 * `MediaController`, `StorageHealthIndicator` — depends on this class, never on an adapter directly,
 * so which backend is active never leaks past here.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly config: StorageConfig;
  private readonly adapter: StorageAdapter;
  /** Only the local adapter can verify its own signed URLs — see `verifySignature`. */
  private readonly local: LocalDiskStorageAdapter | null;

  constructor(config: ConfigService) {
    this.config = config.getOrThrow<StorageConfig>('storage');

    if (this.config.enabled) {
      this.adapter = new S3StorageAdapter(this.config);
      this.local = null;
      this.logger.log(`Object storage backend: s3 (bucket=${this.config.bucket})`);
    } else {
      const local = new LocalDiskStorageAdapter(this.config);
      this.adapter = local;
      this.local = local;
      this.logger.log('Object storage backend: local-disk');
    }
  }

  get backend(): 's3' | 'local-disk' {
    return this.local ? 'local-disk' : 's3';
  }

  async uploadUrl(storageKey: string): Promise<SignedUrl> {
    return this.adapter.uploadUrl(storageKey);
  }

  async downloadUrl(storageKey: string): Promise<SignedUrl> {
    return this.adapter.downloadUrl(storageKey);
  }

  async put(storageKey: string, body: Buffer): Promise<StoredObject> {
    return this.adapter.put(storageKey, body);
  }

  async head(storageKey: string): Promise<StoredObject | null> {
    return this.adapter.head(storageKey);
  }

  async get(storageKey: string): Promise<Buffer | null> {
    return this.adapter.get(storageKey);
  }

  async delete(storageKey: string): Promise<void> {
    return this.adapter.delete(storageKey);
  }

  /**
   * Verifies a signature issued by the local adapter's own `signedUrl`. Only meaningful for
   * `/media/blob`, the local adapter's stand-in for a real object store: with S3 configured, the
   * client never reaches this route at all — its presigned URL points straight at S3, and S3
   * verifies its own signature. Called with an S3 backend active only by a stray or malicious
   * request, which this refuses.
   */
  verifySignature(
    storageKey: string,
    method: 'GET' | 'PUT',
    expires: number,
    signature: string,
  ): boolean {
    if (!this.local) return false;
    return this.local.verifySignature(storageKey, method, expires, signature);
  }
}
