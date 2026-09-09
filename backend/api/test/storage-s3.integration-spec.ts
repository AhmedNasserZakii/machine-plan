import { createHash } from 'node:crypto';
import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { MediaPurpose } from 'src/common/enums/operations.enum';
import { Api, fails, ok } from './utils/api-client';
import { loginAsDirector } from './utils/fixtures';
import { createTestApp } from './utils/test-app';

/**
 * Exercises the real S3/MinIO adapter end to end (`3.1`), as opposed to `media.e2e-spec.ts`,
 * which runs against the local-disk fallback. Requires `S3_BUCKET`/`S3_ACCESS_KEY_ID`/
 * `S3_SECRET_ACCESS_KEY` to already be set when this process starts — `StorageService` picks
 * the adapter once, at construction, so setting them from inside a test would be too late.
 * `scripts/run-integration.sh` sets sensible localhost-MinIO defaults; run it with a MinIO
 * server up (`docker compose up -d minio minio-init`, or `brew services start minio` + create
 * the bucket with `mc mb local/machinery-media`).
 */
interface PresignResponse {
  mediaId: string;
  storageKey: string;
  uploadUrl: string;
  expiresAt: string;
}

interface MediaResponse {
  id: string;
  isConfirmed: boolean;
  sizeBytes: number;
  url?: string;
}

/** A one-pixel transparent PNG — small, real, and what a signature canvas actually produces. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function sha256(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}

describe('S3 storage adapter (integration)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;

  beforeAll(async () => {
    if (!process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY_ID) {
      throw new Error(
        'S3_BUCKET / S3_ACCESS_KEY_ID must be set to run this suite — use ' +
          '`npm run test:integration`, which sets local-MinIO defaults.',
      );
    }

    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);
  });

  afterAll(async () => {
    await app.close();
  });

  async function presign(overrides: Record<string, unknown> = {}): Promise<PresignResponse> {
    return ok<PresignResponse>(
      director.post('/media/presign', {
        purpose: MediaPurpose.SIGNATURE,
        mimeType: 'image/png',
        sizeBytes: PNG.byteLength,
        checksum: sha256(PNG),
        ...overrides,
      }),
      201,
    );
  }

  it('issues a presigned URL that points at the real bucket, not this API server', async () => {
    const reserved = await presign();

    expect(reserved.uploadUrl).toContain(process.env.S3_ENDPOINT ?? 'http://localhost:9000');
    expect(reserved.uploadUrl).toContain(reserved.storageKey);
    expect(reserved.uploadUrl).not.toContain('/api/v1/media/blob');
  });

  it('walks the full handshake against MinIO: presign, PUT to S3, confirm, and read back', async () => {
    const reserved = await presign();

    const putResponse = await fetch(reserved.uploadUrl, { method: 'PUT', body: PNG });
    expect(putResponse.ok).toBe(true);

    const confirmed = await ok<MediaResponse>(
      director.post('/media/confirm', { mediaId: reserved.mediaId }),
    );
    expect(confirmed.isConfirmed).toBe(true);
    expect(confirmed.sizeBytes).toBe(PNG.byteLength);

    const withUrl = await ok<MediaResponse>(director.get(`/media/${reserved.mediaId}`));
    expect(withUrl.url).toBeDefined();
    expect(withUrl.url).not.toContain('/api/v1/media/blob');

    const downloaded = await fetch(withUrl.url!);
    expect(downloaded.ok).toBe(true);
    expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(PNG);
  });

  it('rejects confirm when the uploaded bytes do not match the declared checksum', async () => {
    const reserved = await presign({ checksum: sha256(Buffer.from('not the real bytes')) });

    const putResponse = await fetch(reserved.uploadUrl, { method: 'PUT', body: PNG });
    expect(putResponse.ok).toBe(true);

    await fails(
      director.post('/media/confirm', { mediaId: reserved.mediaId }),
      422,
      'CHECKSUM_MISMATCH',
    );
  });

  it('removes the object from the bucket on delete', async () => {
    const reserved = await presign();
    await fetch(reserved.uploadUrl, { method: 'PUT', body: PNG });
    await ok(director.post('/media/confirm', { mediaId: reserved.mediaId }));

    await director.delete(`/media/${reserved.mediaId}`).expect(204);

    // Read the bucket directly rather than through the API: a 404 from `GET /media/:id` only
    // proves the row is gone, not that `StorageService.delete()` actually reached MinIO.
    const client = new S3Client({
      region: process.env.S3_REGION ?? 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });

    await expect(
      client.send(
        new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: reserved.storageKey }),
      ),
    ).rejects.toThrow();
  });
});
