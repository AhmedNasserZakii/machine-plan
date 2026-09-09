import { Media } from '../entities/media.entity';
import { MediaResponse } from '../dto/responses/media.response';

export function toMediaResponse(
  media: Media,
  signed?: { url: string; expiresAt: Date },
): MediaResponse {
  return {
    id: media.id,
    purpose: media.purpose,
    mimeType: media.mimeType,
    // `bigint` comes back from the driver as a string; clients want a number.
    sizeBytes: Number(media.sizeBytes),
    isConfirmed: media.isConfirmed,
    isOptimized: media.isOptimized,
    width: media.width,
    height: media.height,
    createdAt: media.createdAt.toISOString(),
    url: signed?.url,
    urlExpiresAt: signed?.expiresAt.toISOString(),
  };
}
