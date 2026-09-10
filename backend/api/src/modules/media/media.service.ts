import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, LessThan, Repository } from 'typeorm';
import { ErrorCode } from 'src/common/constants/error-codes';
import { MediaPurpose, MEDIA_PURPOSE_RULES } from 'src/common/enums/operations.enum';
import { AppException } from 'src/common/errors';
import { mediaCleanupFailedTotal, mediaCleanupRemovedTotal } from 'src/common/metrics/metrics';
import { captureError } from 'src/common/observability/sentry';
import { StorageConfig } from 'src/config/storage.config';
import { PresignMediaDto } from './dto/media.dto';
import { Media } from './entities/media.entity';
import { MediaOptimizeService } from './media-optimize.service';
import { StorageService } from './storage/storage.service';

export interface PresignResult {
  media: Media;
  uploadUrl: string;
  expiresAt: Date;
}

export type MediaVariant = 'full' | 'thumb';

export interface PurgeOrphansResult {
  removed: number;
  /** Rows whose storage object could not be deleted; left in place so the next sweep retries. */
  failed: number;
}

/** Media with no parent after this long was abandoned mid-upload and is swept away. */
const ORPHAN_TTL_HOURS = 24;
/** How often the sweep checks — hourly comfortably satisfies "nightly" while self-healing a
 * missed run within the hour, the same trade-off `ReportJobsService`'s retention sweep makes. */
const CLEANUP_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class MediaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaService.name);
  private readonly config: StorageConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Media) private readonly media: Repository<Media>,
    private readonly storage: StorageService,
    private readonly optimizer: MediaOptimizeService,
    config: ConfigService,
  ) {
    this.config = config.getOrThrow<StorageConfig>('storage');
  }

  onModuleInit(): void {
    if (!this.config.cleanupEnabled) {
      this.logger.log('Media cleanup sweep is disabled; no timer is started');
      return;
    }

    // Unref'd so a pending tick cannot hold the process open during a shutdown.
    this.cleanupTimer = setInterval(() => void this.runCleanupSweep(), CLEANUP_SWEEP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
  }

  /**
   * Reserves a key and hands back a direct-upload URL. The row exists before the bytes do so that
   * `confirm` has something to verify against — and so an upload that dies halfway leaves a
   * traceable orphan rather than a mystery object in the bucket.
   */
  async presign(dto: PresignMediaDto, actorId: string): Promise<PresignResult> {
    this.assertPurposeAllows(dto.purpose, dto.mimeType, dto.sizeBytes);

    // A device that lost the response still holds the photo and the id it gave it. Handing back
    // the same row with a fresh URL is what lets it finish the upload instead of orphaning a key.
    const reserved = await this.findByClientUuid(dto.clientUuid, actorId);
    if (reserved) {
      const existing = await this.storage.uploadUrl(reserved.storageKey);
      return { media: reserved, uploadUrl: existing.url, expiresAt: existing.expiresAt };
    }

    const media = await this.media.save(
      this.media.create({
        storageKey: this.buildKey(dto.purpose, dto.mimeType),
        purpose: dto.purpose,
        mimeType: dto.mimeType,
        sizeBytes: String(dto.sizeBytes),
        checksum: dto.checksum?.toLowerCase() ?? null,
        isConfirmed: false,
        uploadedByUserId: actorId,
        clientUuid: dto.clientUuid ?? null,
        createdBy: actorId,
      }),
    );

    const { url, expiresAt } = await this.storage.uploadUrl(media.storageKey);
    return { media, uploadUrl: url, expiresAt };
  }

  /**
   * Registers the uploaded object. The declared size and checksum are re-checked against what
   * storage actually holds: a signature is evidence, and evidence whose bytes were never verified
   * is worth about as much as no signature at all.
   */
  async confirm(mediaId: string, actorId: string): Promise<Media> {
    const media = await this.findOwned(mediaId, actorId);

    if (media.isConfirmed) return media;

    const object = await this.storage.head(media.storageKey);
    if (!object) {
      throw AppException.unprocessable(ErrorCode.MEDIA_NOT_CONFIRMED);
    }

    const rule = MEDIA_PURPOSE_RULES[media.purpose];
    if (object.sizeBytes > rule.maxBytes) {
      await this.storage.delete(media.storageKey);
      throw AppException.unprocessable(ErrorCode.UPLOAD_TOO_LARGE, {
        maxMb: round(rule.maxBytes / (1024 * 1024)),
      });
    }

    if (media.checksum && media.checksum !== object.checksum) {
      throw AppException.unprocessable(ErrorCode.CHECKSUM_MISMATCH);
    }

    await this.media.update(media.id, {
      sizeBytes: String(object.sizeBytes),
      checksum: object.checksum,
      isConfirmed: true,
      confirmedAt: new Date(),
      updatedBy: actorId,
    });

    // Fire-and-forget: `enqueue()` never throws, and a slower-to-appear thumbnail must not turn
    // into a failed confirm response.
    await this.optimizer.enqueue(media.id);

    return this.media.findOneByOrFail({ id: media.id });
  }

  /**
   * Multipart fallback for networks that block presigned URLs. One round trip, so the row is
   * created already confirmed.
   */
  async upload(
    purpose: MediaPurpose,
    file: { buffer: Buffer; mimetype: string; size: number },
    actorId: string,
    clientUuid?: string,
  ): Promise<Media> {
    this.assertPurposeAllows(purpose, file.mimetype, file.size);
    assertContentMatchesMime(file.buffer, file.mimetype);

    const replayed = await this.findByClientUuid(clientUuid, actorId);
    if (replayed) return replayed;

    const storageKey = this.buildKey(purpose, file.mimetype);
    const object = await this.storage.put(storageKey, file.buffer);

    const saved = await this.media.save(
      this.media.create({
        storageKey,
        purpose,
        mimeType: file.mimetype,
        sizeBytes: String(object.sizeBytes),
        checksum: object.checksum,
        isConfirmed: true,
        confirmedAt: new Date(),
        uploadedByUserId: actorId,
        clientUuid: clientUuid ?? null,
        createdBy: actorId,
      }),
    );

    await this.optimizer.enqueue(saved.id);

    return saved;
  }

  /**
   * Resolves device-generated media ids to the rows they became, for the operations that
   * reference their photos by `clientUuid` (`20`, media in offline mode). Scoped to the
   * uploader: media ids travel in payloads their counterparties can read.
   */
  async resolveClientUuids(clientUuids: string[], actorId: string): Promise<Map<string, string>> {
    if (clientUuids.length === 0) return new Map();

    const rows = await this.media.find({
      where: { clientUuid: In(clientUuids), uploadedByUserId: actorId },
      select: { id: true, clientUuid: true },
    });

    return new Map(rows.map((row) => [row.clientUuid!, row.id]));
  }

  private async findByClientUuid(
    clientUuid: string | undefined,
    actorId: string,
  ): Promise<Media | null> {
    if (!clientUuid) return null;

    return this.media.findOne({ where: { clientUuid, uploadedByUserId: actorId } });
  }

  /**
   * A time-limited read URL. Callers never see the permanent storage location.
   *
   * Ownership is enforced: media ids travel in transfer payloads visible to counterparties,
   * so without this check any authenticated user could read anyone's signature or invoice.
   */
  async signedUrl(
    mediaId: string,
    actorId: string,
    canManage = false,
    variant: MediaVariant = 'full',
  ): Promise<{ media: Media; url: string; expiresAt: Date }> {
    const media = canManage
      ? await this.media.findOne({ where: { id: mediaId } })
      : await this.findOwned(mediaId, actorId);

    if (!media) throw AppException.notFound(ErrorCode.MEDIA_NOT_FOUND);

    // Falls back to the full-size key when no thumbnail exists yet (optimization still queued,
    // or this purpose is never optimized — a signature) rather than 404ing on a variant that is
    // simply not ready.
    const key = variant === 'thumb' && media.thumbnailKey ? media.thumbnailKey : media.storageKey;

    const { url, expiresAt } = await this.storage.downloadUrl(key);
    return { media, url, expiresAt };
  }

  /**
   * The same signed-URL mint as `signedUrl`, but for a caller who has already been authorized
   * through a *different* door — a transfer signature's viewer, checked against that transfer's
   * own read scope (`TransfersService.signatureMedia`), not media ownership.
   *
   * Never expose this to a route that takes a bare media id from the request: the whole point
   * of `signedUrl`'s ownership check is that a media id travelling in a payload is not itself
   * proof of the right to read it. This exists only for callers that did that proof themselves.
   */
  async signedUrlForAuthorizedMedia(
    mediaId: string,
  ): Promise<{ media: Media; url: string; expiresAt: Date } | null> {
    const media = await this.media.findOne({ where: { id: mediaId } });
    if (!media) return null;

    const { url, expiresAt } = await this.storage.downloadUrl(media.storageKey);
    return { media, url, expiresAt };
  }

  async remove(mediaId: string, actorId: string, canManage: boolean): Promise<void> {
    const media = canManage
      ? await this.media.findOne({ where: { id: mediaId } })
      : await this.findOwned(mediaId, actorId);

    if (!media) throw AppException.notFound(ErrorCode.MEDIA_NOT_FOUND);

    // The FKs from transfer photos/signatures are ON DELETE RESTRICT, but a soft delete is
    // an UPDATE and slips past them — and the physical delete below is irreversible. Signed
    // hand-off evidence must not be erasable by the person who uploaded it.
    await this.assertNotReferenced(media.id);

    await this.storage.delete(media.storageKey);
    await this.media.softDelete(media.id);
  }

  /** Refuses to destroy media that is already attached to a transfer, signature or invoice. */
  private async assertNotReferenced(mediaId: string): Promise<void> {
    const [{ referenced }] = await this.media.query<{ referenced: string }[]>(
      `SELECT (
         EXISTS (SELECT 1 FROM transfer_item_photos WHERE media_id = $1)
         OR EXISTS (SELECT 1 FROM transfer_signatures WHERE signature_media_id = $1)
         OR EXISTS (SELECT 1 FROM finance_transactions WHERE invoice_media_id = $1)
       )::text AS referenced`,
      [mediaId],
    );

    if (referenced === 'true') {
      throw AppException.conflict(ErrorCode.MEDIA_ALREADY_USED);
    }
  }

  /**
   * Loads media that is about to be attached to something. Anything unconfirmed or already spoken
   * for is refused here rather than at the foreign key, so the caller gets the reason.
   */
  async claim(
    ids: string[],
    purpose: MediaPurpose,
    manager: EntityManager,
    actorId: string,
  ): Promise<Media[]> {
    if (ids.length === 0) return [];

    const unique = [...new Set(ids)];
    const rows = await manager.getRepository(Media).find({ where: { id: In(unique) } });
    const byId = new Map(rows.map((row) => [row.id, row]));

    for (const id of unique) {
      const media = byId.get(id);

      // Not-yours reads as not-found, exactly like `findOwned`: without this a user could
      // attach someone else's confirmed photo or signature to their own transfer.
      if (!media || media.uploadedByUserId !== actorId) {
        throw AppException.notFound(ErrorCode.MEDIA_NOT_FOUND, { id });
      }

      if (!media.isConfirmed) {
        throw AppException.unprocessable(ErrorCode.MEDIA_NOT_CONFIRMED, { id });
      }

      if (media.purpose !== purpose) {
        throw new AppException(ErrorCode.VALIDATION_FAILED, {
          details: [{ field: 'mediaId', value: id, constraint: `must have purpose ${purpose}` }],
        });
      }
    }

    return unique.map((id) => byId.get(id)!);
  }

  /**
   * The upload size ceiling for a storage key, resolved from its purpose prefix.
   * Used by the raw `PUT /media/blob` path, which has to police the stream itself.
   */
  maxBytesForKey(storageKey: string): number {
    const prefix = storageKey.split('/')[0];
    const rule = Object.values(MEDIA_PURPOSE_RULES).find((entry) => entry.prefix === prefix);
    return Math.min(rule?.maxBytes ?? this.config.uploadMaxBytes, this.config.uploadMaxBytes);
  }

  /**
   * True when the key belongs to media that is already confirmed. A presigned PUT stays
   * valid for its whole TTL, so without this an uploader could swap the bytes underneath a
   * signature that has already been verified and attached.
   */
  async isConfirmedKey(storageKey: string): Promise<boolean> {
    return (await this.media.countBy({ storageKey, isConfirmed: true })) > 0;
  }

  /**
   * Sweep of uploads that were reserved and never completed (`19`, `3.3`).
   *
   * Scoped to `isConfirmed: false`, which is what keeps this safe by construction rather than by
   * a second check: `claim()` refuses to attach anything unconfirmed to a transfer, signature or
   * invoice, so a row this query can see was — by definition — never referenced by one. A
   * confirmed row, however old, is never a candidate here.
   *
   * A storage failure on one row does not abandon the rest: everything that *did* delete from
   * storage is still soft-deleted, and the ones that failed stay untouched (not orphaned in the
   * DB with no object, not lost) so the next hourly sweep retries exactly those.
   */
  async purgeOrphans(now = new Date()): Promise<PurgeOrphansResult> {
    const cutoff = new Date(now.getTime() - ORPHAN_TTL_HOURS * 60 * 60 * 1000);

    const orphans = await this.media.find({
      where: { isConfirmed: false, createdAt: LessThan(cutoff) },
    });

    const removedIds: string[] = [];
    let failed = 0;

    for (const candidate of orphans) {
      try {
        await this.storage.delete(candidate.storageKey);
        removedIds.push(candidate.id);
      } catch (error) {
        failed += 1;
        this.logger.error(
          { err: error, mediaId: candidate.id, storageKey: candidate.storageKey },
          'Failed to delete an orphaned media object from storage',
        );
      }
    }

    if (removedIds.length > 0) {
      await this.media.softDelete(removedIds);
    }

    return { removed: removedIds.length, failed };
  }

  private async runCleanupSweep(): Promise<void> {
    const startedAt = Date.now();

    try {
      const { removed, failed } = await this.purgeOrphans();
      const durationMs = Date.now() - startedAt;
      mediaCleanupRemovedTotal.inc(removed);
      mediaCleanupFailedTotal.inc(failed);

      if (removed > 0 || failed > 0) {
        this.logger.log({ removed, failed, durationMs }, 'Media cleanup sweep completed');
      }

      // A dedicated error-level line even though the per-row failures are already logged: this
      // is the one line an ops alert on "media cleanup" log-error-rate should key off.
      if (failed > 0) {
        this.logger.error(
          { failed },
          'Media cleanup sweep left orphaned objects undeleted in storage — will retry next sweep',
        );
      }
    } catch (error) {
      // Retention is best-effort housekeeping; the next hourly tick is a perfectly good retry.
      this.logger.error({ err: error }, 'Media cleanup sweep failed');
      captureError(error, { sweep: 'media-cleanup' });
    }
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async findOwned(mediaId: string, actorId: string): Promise<Media> {
    const media = await this.media.findOne({ where: { id: mediaId } });

    // Not-yours and not-there are the same 404: media ids should not be probeable.
    if (!media || media.uploadedByUserId !== actorId) {
      throw AppException.notFound(ErrorCode.MEDIA_NOT_FOUND);
    }

    return media;
  }

  private assertPurposeAllows(purpose: MediaPurpose, mimeType: string, sizeBytes: number): void {
    const rule = MEDIA_PURPOSE_RULES[purpose];

    if (!rule.mimeTypes.includes(mimeType)) {
      throw new AppException(ErrorCode.UNSUPPORTED_MEDIA_TYPE, {
        status: 415,
        params: { mimeType },
      });
    }

    const max = Math.min(rule.maxBytes, this.config.uploadMaxBytes);
    if (sizeBytes > max) {
      throw new AppException(ErrorCode.UPLOAD_TOO_LARGE, {
        status: 413,
        params: { maxMb: round(max / (1024 * 1024)) },
      });
    }
  }

  /** `{prefix}/{yyyy}/{mm}/{uuid}.{ext}` — the layout retention policy is written against. */
  private buildKey(purpose: MediaPurpose, mimeType: string): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');

    return `${MEDIA_PURPOSE_RULES[purpose].prefix}/${year}/${month}/${randomUUID()}.${extensionFor(mimeType)}`;
  }
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function extensionFor(mimeType: string): string {
  return EXTENSIONS[mimeType] ?? 'bin';
}

/**
 * Leading bytes each allowed format must start with. The declared MIME type is just a
 * string the client chose, and `readBlob` serves objects with the Content-Type their
 * extension implies — so an unchecked upload is a way to host arbitrary content under a
 * trusted origin.
 */
const MAGIC_BYTES: Record<string, readonly number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // "RIFF"; bytes 8-11 checked separately
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // "%PDF"
};

export function assertContentMatchesMime(body: Buffer, mimeType: string): void {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) return;

  const matches =
    signatures.some((signature) => signature.every((byte, index) => body[index] === byte)) &&
    // WEBP is a RIFF container: bytes 8..11 must spell "WEBP", otherwise any RIFF
    // (e.g. an AVI) would pass the four-byte check.
    (mimeType !== 'image/webp' || body.subarray(8, 12).toString('ascii') === 'WEBP');

  if (!matches) {
    throw new AppException(ErrorCode.UNSUPPORTED_MEDIA_TYPE, {
      status: 415,
      params: { mimeType },
    });
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
