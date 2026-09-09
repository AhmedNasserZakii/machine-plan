import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { StorageConfig } from 'src/config/storage.config';
import { SignedUrl, StorageAdapter, StoredObject } from './storage.types';

/**
 * Local filesystem backend for dev, CI and the e2e suite — nothing here should ever run in
 * production (`StorageService` and boot-time env validation both refuse that).
 *
 * There is no real S3 in front of this, so signed URLs are HMACs this same process verifies
 * itself: the client `PUT`s/`GET`s `/media/blob?key=&expires=&signature=` on this API server,
 * which is what keeps the presign → upload → confirm handshake identical to the S3 adapter's from
 * the client's point of view.
 */
export class LocalDiskStorageAdapter implements StorageAdapter {
  private readonly root: string;

  constructor(private readonly config: StorageConfig) {
    this.root = resolve(process.cwd(), this.config.localDir);
  }

  async uploadUrl(storageKey: string): Promise<SignedUrl> {
    return Promise.resolve(this.signedUrl(storageKey, 'PUT'));
  }

  async downloadUrl(storageKey: string): Promise<SignedUrl> {
    return Promise.resolve(this.signedUrl(storageKey, 'GET'));
  }

  async put(storageKey: string, body: Buffer): Promise<StoredObject> {
    const path = this.pathFor(storageKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);

    return { sizeBytes: body.byteLength, checksum: sha256(body) };
  }

  async head(storageKey: string): Promise<StoredObject | null> {
    const path = this.pathFor(storageKey);

    try {
      const info = await stat(path);
      // The local adapter has to read the file to checksum it. S3 returns ETag from HEAD, which
      // is why the interface hands back a checksum rather than making callers ask twice.
      return { sizeBytes: info.size, checksum: sha256(await readFile(path)) };
    } catch {
      return null;
    }
  }

  async get(storageKey: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathFor(storageKey));
    } catch {
      return null;
    }
  }

  async delete(storageKey: string): Promise<void> {
    await rm(this.pathFor(storageKey), { force: true });
  }

  /**
   * Verifies a signature issued by `signedUrl` and returns whether it still covers this
   * key/method. Returning `false` for both a bad signature and an expired one keeps the two
   * indistinguishable to a caller guessing at keys.
   */
  verifySignature(
    storageKey: string,
    method: 'GET' | 'PUT',
    expires: number,
    signature: string,
  ): boolean {
    if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return false;

    const expected = this.sign(storageKey, method, expires);
    const given = Buffer.from(signature, 'utf8');
    const want = Buffer.from(expected, 'utf8');

    return given.length === want.length && timingSafeEqual(given, want);
  }

  private signedUrl(storageKey: string, method: 'GET' | 'PUT'): SignedUrl {
    const expiresAt = new Date(Date.now() + this.config.urlTtlSeconds * 1000);
    const expires = Math.floor(expiresAt.getTime() / 1000);
    const signature = this.sign(storageKey, method, expires);

    const query = new URLSearchParams({ key: storageKey, expires: String(expires), signature });
    const url = `${this.config.publicBaseUrl}/api/v1/media/blob?${query.toString()}`;

    return { url, expiresAt };
  }

  private sign(storageKey: string, method: 'GET' | 'PUT', expires: number): string {
    return createHmac('sha256', this.config.urlSigningSecret)
      .update(`${method}\n${storageKey}\n${expires}`)
      .digest('hex');
  }

  /** Keys are server-generated, but a traversal here would write anywhere on the disk. */
  private pathFor(storageKey: string): string {
    const path = resolve(join(this.root, normalize(storageKey)));

    if (path !== this.root && !path.startsWith(this.root + sep)) {
      throw new Error(`Refusing to access storage key outside the root: ${storageKey}`);
    }

    return path;
  }
}

function sha256(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}
