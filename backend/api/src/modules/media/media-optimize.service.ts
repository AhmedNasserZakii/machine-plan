import { createHash } from 'node:crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import sharp from 'sharp';
import { MediaPurpose } from 'src/common/enums/operations.enum';
import { Media } from './entities/media.entity';
import { MediaOptimizeQueueService } from './media-optimize-queue.service';
import { StorageService } from './storage/storage.service';

/** Longest edge of the list-screen thumbnail (`19`). */
const THUMBNAIL_SIZE = 320;
/** Server-side safety net quality — the client already compresses before upload (`19`). */
const WEBP_QUALITY = 80;

/**
 * The server-side half of `19`'s compression story: re-encodes a confirmed upload to WebP,
 * builds its 320px thumbnail, and strips whatever metadata survived the client's own compression.
 *
 * Runs as a `media-optimize` job (`MediaOptimizeQueueService`), triggered once by
 * `MediaService.confirm()`. Never runs twice for the same row (`isOptimized` guards it) and never
 * touches `SIGNATURE` media or non-image uploads (a PDF invoice) — those are kept byte-for-byte.
 */
@Injectable()
export class MediaOptimizeService implements OnModuleInit {
  private readonly logger = new Logger(MediaOptimizeService.name);

  constructor(
    @InjectRepository(Media) private readonly media: Repository<Media>,
    private readonly storage: StorageService,
    private readonly queue: MediaOptimizeQueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.start((mediaId) => this.optimize(mediaId));
  }

  async enqueue(mediaId: string): Promise<void> {
    await this.queue.enqueue(mediaId);
  }

  /** `SIGNATURE` media is evidence and is never re-encoded; sharp cannot process a PDF. */
  static isEligible(media: Pick<Media, 'purpose' | 'mimeType'>): boolean {
    return media.purpose !== MediaPurpose.SIGNATURE && media.mimeType !== 'application/pdf';
  }

  async optimize(mediaId: string): Promise<void> {
    const media = await this.media.findOne({ where: { id: mediaId } });

    // Not found (deleted before the job ran), not confirmed yet, already done, or a kind this
    // pipeline does not touch — every one of these is a silent no-op, not a failure.
    if (!media || !media.isConfirmed || media.isOptimized) return;
    if (!MediaOptimizeService.isEligible(media)) return;

    const original = await this.storage.get(media.storageKey);
    if (!original) {
      this.logger.warn({ mediaId, storageKey: media.storageKey }, 'Optimize job found no object');
      return;
    }

    // `.rotate()` with no argument reads the EXIF orientation tag and bakes it into the pixels
    // once, here — the WebP re-encode below carries no metadata at all (sharp strips it by
    // default when no `.withMetadata()` call is made), so the image still displays upright with
    // nothing left to strip.
    const oriented = sharp(original).rotate();

    const { data: fullBuffer, info: fullInfo } = await oriented
      .clone()
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    const { data: thumbBuffer } = await oriented
      .clone()
      .resize({
        width: THUMBNAIL_SIZE,
        height: THUMBNAIL_SIZE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    const optimizedKey = withExtension(media.storageKey, 'webp');
    const thumbnailKey = thumbnailKeyFor(optimizedKey);

    await this.storage.put(optimizedKey, fullBuffer);
    await this.storage.put(thumbnailKey, thumbBuffer);

    // The pre-optimization object (e.g. `.jpg`) is superseded, not kept as a second copy — the
    // plan's storage layout for an optimized photo has exactly two objects: the full WebP and its
    // thumbnail. Already-`.webp` uploads land on the same key and this is a harmless overwrite.
    if (optimizedKey !== media.storageKey) {
      await this.storage.delete(media.storageKey);
    }

    await this.media.update(media.id, {
      storageKey: optimizedKey,
      thumbnailKey,
      sizeBytes: String(fullBuffer.byteLength),
      checksum: sha256(fullBuffer),
      width: fullInfo.width,
      height: fullInfo.height,
      isOptimized: true,
      optimizedAt: new Date(),
    });
  }
}

/** `foo/bar.jpg` → `foo/bar.webp`. Keys have no query string or fragment to worry about. */
function withExtension(storageKey: string, extension: string): string {
  return storageKey.replace(/\.[^./]+$/, `.${extension}`);
}

function thumbnailKeyFor(optimizedKey: string): string {
  return optimizedKey.replace(/\.webp$/, '_thumb.webp');
}

function sha256(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}
