import { createHash } from 'node:crypto';
import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import sharp from 'sharp';
import { MediaPurpose } from 'src/common/enums/operations.enum';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { Api, fails, ok } from './utils/api-client';
import {
  createBranch,
  loginAsDirector,
  provisionUser,
  ProvisionedUser,
  roleIdByCode,
} from './utils/fixtures';
import { createTestApp } from './utils/test-app';

interface PresignResponse {
  mediaId: string;
  storageKey: string;
  uploadUrl: string;
  expiresAt: string;
}

interface MediaResponse {
  id: string;
  purpose: MediaPurpose;
  mimeType: string;
  sizeBytes: number;
  isConfirmed: boolean;
  isOptimized: boolean;
  width?: number | null;
  height?: number | null;
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

describe('Media (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;
  let representative: ProvisionedUser;

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);

    const branch = await createBranch(director, 'فرع الوسائط');

    representative = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
      branchId: branch.id,
      fullName: 'مندوب الوسائط',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  /** Follows the signed URL back to this same server, which is what the local adapter issues. */
  function putTo(uploadUrl: string, body: Buffer): request.Test {
    const path = uploadUrl.slice(uploadUrl.indexOf('/api/'));
    return request(server).put(path).set('Content-Type', 'image/png').send(body);
  }

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

  describe('presign → upload → confirm', () => {
    it('walks the full handshake and marks the object confirmed', async () => {
      const reserved = await presign();

      expect(reserved.storageKey).toMatch(/^signatures\/\d{4}\/\d{2}\/[\da-f-]+\.png$/);
      expect(new Date(reserved.expiresAt).getTime()).toBeGreaterThan(Date.now());

      await putTo(reserved.uploadUrl, PNG).expect(200);

      const confirmed = await ok<MediaResponse>(
        director.post('/media/confirm', { mediaId: reserved.mediaId }),
      );

      expect(confirmed.isConfirmed).toBe(true);
      expect(confirmed.sizeBytes).toBe(PNG.byteLength);
    });

    /** Confirming what was never uploaded is the normal shape of a failed field upload. */
    it('refuses to confirm an object that never arrived', async () => {
      const reserved = await presign();

      await fails(
        director.post('/media/confirm', { mediaId: reserved.mediaId }),
        422,
        'MEDIA_NOT_CONFIRMED',
      );
    });

    it('refuses to confirm bytes that do not match the declared checksum', async () => {
      const reserved = await presign({ checksum: sha256(Buffer.from('something else')) });

      await putTo(reserved.uploadUrl, PNG).expect(200);

      await fails(
        director.post('/media/confirm', { mediaId: reserved.mediaId }),
        422,
        'CHECKSUM_MISMATCH',
      );
    });

    it('rejects a purpose the mime type is not allowed for', async () => {
      await fails(
        director.post('/media/presign', {
          purpose: MediaPurpose.SIGNATURE,
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
        }),
        415,
        'UNSUPPORTED_MEDIA_TYPE',
      );
    });

    /** A signature is a few strokes. Anything photograph-sized means the wrong thing was sent. */
    it('rejects an oversized declared size before a byte is uploaded', async () => {
      await fails(
        director.post('/media/presign', {
          purpose: MediaPurpose.SIGNATURE,
          mimeType: 'image/png',
          sizeBytes: 5 * 1024 * 1024,
        }),
        413,
        'UPLOAD_TOO_LARGE',
      );
    });
  });

  describe('access control', () => {
    it('will not confirm someone else’s reservation', async () => {
      const reserved = await presign();
      await putTo(reserved.uploadUrl, PNG).expect(200);

      await fails(
        representative.api.post('/media/confirm', { mediaId: reserved.mediaId }),
        404,
        'MEDIA_NOT_FOUND',
      );
    });

    it('hands out a short-lived read URL rather than the storage location', async () => {
      const reserved = await presign();
      await putTo(reserved.uploadUrl, PNG).expect(200);
      await ok(director.post('/media/confirm', { mediaId: reserved.mediaId }));

      const media = await ok<MediaResponse>(director.get(`/media/${reserved.mediaId}`));

      // Signed and time-limited, never a permanent bucket URL.
      expect(media.url).toContain('signature=');
      expect(media.url).toContain('expires=');

      const path = media.url!.slice(media.url!.indexOf('/api/'));
      const download = await request(server)
        .get(path)
        .buffer(true)
        .parse(binaryParser)
        .expect(200)
        .expect('Content-Type', 'image/png');

      expect((download.body as Buffer).equals(PNG)).toBe(true);
    });

    it('refuses a blob request whose signature was not issued by this server', async () => {
      const reserved = await presign();

      await request(server)
        .get(`/api/v1/media/blob?key=${reserved.storageKey}&expires=99999999999&signature=forged`)
        .expect(403);
    });

    it('refuses an anonymous presign', async () => {
      await fails(
        director.as(null).post('/media/presign', {
          purpose: MediaPurpose.SIGNATURE,
          mimeType: 'image/png',
          sizeBytes: 100,
        }),
        401,
        'UNAUTHENTICATED',
      );
    });
  });

  describe('multipart fallback', () => {
    it('accepts a direct upload and confirms it in one round trip', async () => {
      const response = await request(server)
        .post('/api/v1/media/upload')
        .set('Authorization', `Bearer ${tokenOf(director)}`)
        .field('purpose', MediaPurpose.SIGNATURE)
        .attach('file', PNG, { filename: 'sig.png', contentType: 'image/png' })
        .expect(201);

      const media = response.body.data as MediaResponse;
      expect(media.isConfirmed).toBe(true);
      expect(media.sizeBytes).toBe(PNG.byteLength);
    });
  });

  describe('image optimization', () => {
    it('re-encodes a confirmed photo to WebP and builds a thumbnail', async () => {
      const jpeg = await sharp({
        create: { width: 640, height: 480, channels: 3, background: { r: 10, g: 200, b: 50 } },
      })
        .jpeg()
        .toBuffer();

      const reserved = await presign({
        purpose: MediaPurpose.TRANSFER_PHOTO,
        mimeType: 'image/jpeg',
        sizeBytes: jpeg.byteLength,
        checksum: sha256(jpeg),
      });
      expect(reserved.storageKey).toMatch(/\.jpg$/);

      await putTo(reserved.uploadUrl, jpeg).expect(200);
      // No queue in this suite (Redis is disabled), so optimization runs synchronously as part
      // of confirm — the row it returns already reflects the finished job.
      const confirmed = await ok<MediaResponse>(
        director.post('/media/confirm', { mediaId: reserved.mediaId }),
      );

      expect(confirmed.isOptimized).toBe(true);
      expect(confirmed.width).toBe(640);
      expect(confirmed.height).toBe(480);

      const full = await ok<MediaResponse>(director.get(`/media/${reserved.mediaId}`));
      expect(full.url).toMatch(/\.webp/);

      const thumb = await ok<MediaResponse>(
        director.get(`/media/${reserved.mediaId}?variant=thumb`),
      );
      expect(thumb.url).toContain('_thumb.webp');

      const thumbPath = thumb.url!.slice(thumb.url!.indexOf('/api/'));
      const downloaded = await request(server)
        .get(thumbPath)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      const thumbMeta = await sharp(downloaded.body as Buffer).metadata();
      expect(thumbMeta.format).toBe('webp');
      expect(Math.max(thumbMeta.width, thumbMeta.height)).toBeLessThanOrEqual(320);
    });

    it('never re-encodes a signature — it stays the exact original PNG bytes', async () => {
      const reserved = await presign();
      await putTo(reserved.uploadUrl, PNG).expect(200);

      const confirmed = await ok<MediaResponse>(
        director.post('/media/confirm', { mediaId: reserved.mediaId }),
      );

      expect(confirmed.isOptimized).toBe(false);

      const full = await ok<MediaResponse>(director.get(`/media/${reserved.mediaId}`));
      const path = full.url!.slice(full.url!.indexOf('/api/'));
      const downloaded = await request(server)
        .get(path)
        .buffer(true)
        .parse(binaryParser)
        .expect(200)
        .expect('Content-Type', 'image/png');

      expect((downloaded.body as Buffer).equals(PNG)).toBe(true);

      // `?variant=thumb` falls back to the full (only) object rather than 404ing on a variant
      // that was never built for this purpose.
      const thumb = await ok<MediaResponse>(
        director.get(`/media/${reserved.mediaId}?variant=thumb`),
      );
      expect(thumb.url).not.toContain('_thumb');
    });
  });
});

/** The Api wrapper keeps its token private; multipart needs supertest directly. */
function tokenOf(api: Api): string {
  return (api as unknown as { token: string }).token;
}

/** Supertest's default parser assumes text; image bytes have to be collected by hand. */
function binaryParser(
  res: request.Response,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
  res.on('error', (error: Error) => callback(error, Buffer.alloc(0)));
}
