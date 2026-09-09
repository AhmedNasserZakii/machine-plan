import { Repository } from 'typeorm';
import sharp from 'sharp';
import { MediaPurpose } from 'src/common/enums/operations.enum';
import { Media } from '../entities/media.entity';
import { MediaOptimizeQueueService } from '../media-optimize-queue.service';
import { MediaOptimizeService } from '../media-optimize.service';
import { StorageService } from '../storage/storage.service';

async function jpegFixture(width = 800, height = 600): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .jpeg()
    .toBuffer();
}

function baseMedia(overrides: Partial<Media> = {}): Media {
  return {
    id: 'media-1',
    storageKey: 'transfer-photos/2026/09/media-1.jpg',
    purpose: MediaPurpose.TRANSFER_PHOTO,
    mimeType: 'image/jpeg',
    sizeBytes: '1000',
    width: null,
    height: null,
    checksum: 'old-checksum',
    isConfirmed: true,
    confirmedAt: new Date(),
    uploadedByUserId: 'user-1',
    clientUuid: null,
    thumbnailKey: null,
    isOptimized: false,
    optimizedAt: null,
    ...overrides,
  } as Media;
}

describe('MediaOptimizeService', () => {
  // No explicit return type: it exists solely to keep `storagePut`'s inferred mock signature
  // (specifically `Buffer`, not `any`) flowing to the `sharp()` calls in the assertions below.
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  function service(media: Media | null) {
    const findOne = jest.fn().mockResolvedValue(media);
    const update = jest.fn().mockResolvedValue(undefined);
    const repo = { findOne, update } as unknown as Repository<Media>;

    const stored = new Map<string, Buffer>();
    const storagePut = jest.fn(
      (key: string, body: Buffer): Promise<{ sizeBytes: number; checksum: string }> => {
        stored.set(key, body);
        return Promise.resolve({ sizeBytes: body.byteLength, checksum: 'x' });
      },
    );
    const storageDelete = jest.fn((key: string): Promise<void> => {
      stored.delete(key);
      return Promise.resolve();
    });
    const storageGet = jest.fn((key: string): Promise<Buffer | null> =>
      Promise.resolve(stored.get(key) ?? null),
    );
    const storage = {
      get: storageGet,
      put: storagePut,
      delete: storageDelete,
    } as unknown as StorageService;

    const queue = { start: jest.fn(), enqueue: jest.fn() } as unknown as MediaOptimizeQueueService;

    return {
      subject: new MediaOptimizeService(repo, storage, queue),
      storagePut,
      storageDelete,
      update,
    };
  }

  describe('isEligible', () => {
    it('excludes signatures', () => {
      expect(
        MediaOptimizeService.isEligible({ purpose: MediaPurpose.SIGNATURE, mimeType: 'image/png' }),
      ).toBe(false);
    });

    it('excludes PDFs', () => {
      expect(
        MediaOptimizeService.isEligible({
          purpose: MediaPurpose.INVOICE,
          mimeType: 'application/pdf',
        }),
      ).toBe(false);
    });

    it('includes transfer photos, image invoices, and avatars', () => {
      expect(
        MediaOptimizeService.isEligible({
          purpose: MediaPurpose.TRANSFER_PHOTO,
          mimeType: 'image/jpeg',
        }),
      ).toBe(true);
      expect(
        MediaOptimizeService.isEligible({ purpose: MediaPurpose.INVOICE, mimeType: 'image/webp' }),
      ).toBe(true);
      expect(
        MediaOptimizeService.isEligible({ purpose: MediaPurpose.AVATAR, mimeType: 'image/jpeg' }),
      ).toBe(true);
    });
  });

  describe('optimize', () => {
    it('re-encodes to WebP, builds a thumbnail, and updates the row', async () => {
      const media = baseMedia();
      const { subject, storagePut, storageDelete, update } = service(media);
      const original = await jpegFixture(800, 600);

      // Seed the fake store with the original bytes at the media's current key.
      await storagePut(media.storageKey, original);
      storagePut.mockClear();

      await subject.optimize(media.id);

      expect(storagePut).toHaveBeenCalledTimes(2);
      const [fullCall, thumbCall] = storagePut.mock.calls;
      expect(fullCall[0]).toBe('transfer-photos/2026/09/media-1.webp');
      expect(thumbCall[0]).toBe('transfer-photos/2026/09/media-1_thumb.webp');

      // The original `.jpg` key is superseded once the `.webp` key exists.
      expect(storageDelete).toHaveBeenCalledWith(media.storageKey);

      const fullMeta = await sharp(fullCall[1]).metadata();
      expect(fullMeta.format).toBe('webp');
      expect(fullMeta.width).toBe(800);
      expect(fullMeta.height).toBe(600);

      const thumbMeta = await sharp(thumbCall[1]).metadata();
      expect(thumbMeta.format).toBe('webp');
      expect(Math.max(thumbMeta.width, thumbMeta.height)).toBeLessThanOrEqual(320);
      // Aspect ratio preserved (4:3 source).
      expect(thumbMeta.width / thumbMeta.height).toBeCloseTo(800 / 600, 1);

      expect(update).toHaveBeenCalledWith(
        media.id,
        expect.objectContaining({
          storageKey: 'transfer-photos/2026/09/media-1.webp',
          thumbnailKey: 'transfer-photos/2026/09/media-1_thumb.webp',
          width: 800,
          height: 600,
          isOptimized: true,
        }),
      );
    });

    it('does not enlarge a thumbnail past the source image', async () => {
      const media = baseMedia();
      const { subject, storagePut } = service(media);
      const original = await jpegFixture(200, 100);
      await storagePut(media.storageKey, original);
      storagePut.mockClear();

      await subject.optimize(media.id);

      const [, thumbCall] = storagePut.mock.calls;
      const thumbMeta = await sharp(thumbCall[1]).metadata();
      expect(thumbMeta.width).toBe(200);
      expect(thumbMeta.height).toBe(100);
    });

    it('never touches a signature', async () => {
      const media = baseMedia({ purpose: MediaPurpose.SIGNATURE, mimeType: 'image/png' });
      const { subject, storagePut, update } = service(media);

      await subject.optimize(media.id);

      expect(storagePut).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it('never re-processes an already-optimized row', async () => {
      const media = baseMedia({ isOptimized: true });
      const { subject, storagePut } = service(media);

      await subject.optimize(media.id);

      expect(storagePut).not.toHaveBeenCalled();
    });

    it('does nothing for an unconfirmed row', async () => {
      const media = baseMedia({ isConfirmed: false });
      const { subject, storagePut } = service(media);

      await subject.optimize(media.id);

      expect(storagePut).not.toHaveBeenCalled();
    });

    it('does nothing when the media row no longer exists', async () => {
      const { subject, storagePut } = service(null);

      await expect(subject.optimize('missing')).resolves.toBeUndefined();
      expect(storagePut).not.toHaveBeenCalled();
    });

    it('does nothing when the object was never actually uploaded', async () => {
      const media = baseMedia();
      const { subject, storagePut } = service(media);
      // No bytes seeded at `media.storageKey`.

      await subject.optimize(media.id);

      expect(storagePut).not.toHaveBeenCalled();
    });
  });
});
