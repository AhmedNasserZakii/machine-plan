import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MediaPurpose, MEDIA_PURPOSES } from 'src/common/enums/operations.enum';

export class MediaResponse {
  @ApiProperty() id: string;
  @ApiProperty({ enum: MEDIA_PURPOSES }) purpose: MediaPurpose;
  @ApiProperty() mimeType: string;
  @ApiProperty() sizeBytes: number;
  @ApiProperty() isConfirmed: boolean;
  @ApiProperty() isOptimized: boolean;
  @ApiPropertyOptional({ nullable: true }) width?: number | null;
  @ApiPropertyOptional({ nullable: true }) height?: number | null;
  @ApiProperty() createdAt: string;

  /** Present only on endpoints that mint one; media URLs are always short-lived. */
  @ApiPropertyOptional() url?: string;
  @ApiPropertyOptional() urlExpiresAt?: string;
}

export class PresignResponse {
  @ApiProperty() mediaId: string;
  @ApiProperty() storageKey: string;
  @ApiProperty({ description: 'PUT the raw bytes here, then call /media/confirm' })
  uploadUrl: string;
  @ApiProperty() expiresAt: string;
}
