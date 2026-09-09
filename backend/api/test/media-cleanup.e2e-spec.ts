import type { App } from 'supertest/types';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MediaPurpose } from 'src/common/enums/operations.enum';
import { MediaService } from 'src/modules/media/media.service';
import { Api, fails, ok } from './utils/api-client';
import { loginAsDirector } from './utils/fixtures';
import { createTestApp } from './utils/test-app';

/**
 * `MediaService.purgeOrphans()` itself, called directly rather than waiting for the hourly timer
 * (disabled under test — `storage.config.ts`'s `cleanupEnabled`). Same pattern
 * `test/notifications.e2e-spec.ts` uses for its sweeps: exercise the real DB and real storage
 * adapter, with `created_at` pushed back by hand instead of a real clock to wait on.
 */
interface PresignResponse {
  mediaId: string;
  storageKey: string;
  uploadUrl: string;
}

describe('Media cleanup (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;
  let dataSource: DataSource;
  let media: MediaService;

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);
    dataSource = app.get(DataSource);
    media = app.get(MediaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function presign(): Promise<PresignResponse> {
    return ok<PresignResponse>(
      director.post('/media/presign', {
        purpose: MediaPurpose.SIGNATURE,
        mimeType: 'image/png',
        sizeBytes: 100,
      }),
      201,
    );
  }

  async function confirm(reserved: PresignResponse): Promise<void> {
    const path = reserved.uploadUrl.slice(reserved.uploadUrl.indexOf('/api/'));
    await request(server)
      .put(path)
      .set('Content-Type', 'image/png')
      .send(Buffer.from('fake-png-bytes'))
      .expect(200);
    await ok(director.post('/media/confirm', { mediaId: reserved.mediaId }));
  }

  /** Reaches past `@CreateDateColumn`, which nothing in the app itself can do. */
  async function ageByHours(mediaId: string, hours: number): Promise<void> {
    await dataSource.query(
      `UPDATE media SET created_at = now() - ($2 || ' hours')::interval WHERE id = $1`,
      [mediaId, String(hours)],
    );
  }

  it('removes an unconfirmed upload well past the 24 hour cutoff', async () => {
    const reserved = await presign();
    await ageByHours(reserved.mediaId, 25);

    const result = await media.purgeOrphans();

    expect(result.removed).toBeGreaterThanOrEqual(1);
    await fails(director.get(`/media/${reserved.mediaId}`), 404, 'MEDIA_NOT_FOUND');
  });

  it('keeps an unconfirmed upload well inside the 24 hour window', async () => {
    const reserved = await presign();
    await ageByHours(reserved.mediaId, 23);

    await media.purgeOrphans();

    await ok(director.get(`/media/${reserved.mediaId}`));
  });

  it('keeps an upload one minute short of the cutoff', async () => {
    const reserved = await presign();
    await ageByHours(reserved.mediaId, 23 + 59 / 60);

    await media.purgeOrphans();

    await ok(director.get(`/media/${reserved.mediaId}`));
  });

  it('removes an upload one minute past the cutoff', async () => {
    const reserved = await presign();
    await ageByHours(reserved.mediaId, 24 + 1 / 60);

    await media.purgeOrphans();

    await fails(director.get(`/media/${reserved.mediaId}`), 404, 'MEDIA_NOT_FOUND');
  });

  it('never removes a confirmed upload, no matter how old', async () => {
    const reserved = await presign();
    await confirm(reserved);
    await ageByHours(reserved.mediaId, 24 * 30);

    await media.purgeOrphans();

    await ok(director.get(`/media/${reserved.mediaId}`));
  });
});
