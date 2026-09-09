import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MaxLength,
} from 'class-validator';
import { MediaPurpose, MEDIA_PURPOSES } from 'src/common/enums/operations.enum';

export class PresignMediaDto {
  @ApiProperty({ enum: MEDIA_PURPOSES })
  @IsEnum(MediaPurpose)
  purpose: MediaPurpose;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @MaxLength(100)
  mimeType: string;

  @ApiProperty({ example: 184320, description: 'Declared byte size, re-checked at confirm' })
  @IsInt()
  @Min(1)
  sizeBytes: number;

  @ApiPropertyOptional({ description: 'SHA-256 hex of the bytes about to be uploaded' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i, { message: 'must be a 64-character hex SHA-256' })
  checksum?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Device-generated id, assigned when the photo was captured offline.',
  })
  @IsOptional()
  @IsUUID()
  clientUuid?: string;
}

export class ConfirmMediaDto {
  @ApiProperty()
  @IsUUID()
  mediaId: string;
}

export class UploadMediaDto {
  @ApiProperty({ enum: MEDIA_PURPOSES })
  @IsEnum(MediaPurpose)
  purpose: MediaPurpose;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Device-generated id, assigned when the photo was captured offline.',
  })
  @IsOptional()
  @IsUUID()
  clientUuid?: string;
}

export class MediaVariantQueryDto {
  @ApiPropertyOptional({
    enum: ['full', 'thumb'],
    default: 'full',
    description: 'Falls back to `full` when no thumbnail exists yet for this object.',
  })
  @IsOptional()
  @IsIn(['full', 'thumb'])
  variant?: 'full' | 'thumb';
}

export class BlobQueryDto {
  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty()
  @IsString()
  expires: string;

  @ApiProperty()
  @IsString()
  signature: string;
}
