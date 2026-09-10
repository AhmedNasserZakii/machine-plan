import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { SYNC_OPERATION_TYPES, SyncOperationType } from 'src/common/enums/sync.enum';

export class SyncDeltaQueryDto {
  @ApiProperty({
    example: '2026-09-07T12:00:00.000Z',
    description: 'The `nextSince` from the previous sync. Never the device clock.',
  })
  @IsDateString()
  since: string;
}

export class SyncOperationDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The id the device generated for this operation, before it had a connection.',
  })
  @IsUUID()
  clientUuid: string;

  @ApiProperty({ enum: SYNC_OPERATION_TYPES })
  @IsIn(SYNC_OPERATION_TYPES)
  type: SyncOperationType;

  @ApiPropertyOptional({
    description:
      'When it happened on the device. Copied onto the created record for the types that ' +
      'carry an occurrence time, and checked for clock skew either way.',
  })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiProperty({
    description:
      'The body the equivalent REST endpoint takes. `CONFIRM_TRANSFER` and `REJECT_TRANSFER` ' +
      'also carry the `transferId` they act on; `CREATE_SUBSCRIPTION` carries `merchantId`. ' +
      'Media and merchant references may name a `clientUuid` that has not resolved to a real ' +
      'id yet — the server resolves what it can and reports the rest as a retryable failure.',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  payload: Record<string, unknown>;
}

/**
 * The queue a device drained while it had no connection.
 *
 * Capped rather than unbounded: each operation runs in its own transaction and a batch of a
 * thousand would hold a connection for minutes and time out as a whole, losing the report of
 * the ones that had already succeeded. A client with more than this pushes in several calls,
 * which is safe precisely because every item is individually idempotent.
 */
export class SyncBatchDto {
  @ApiProperty({ type: [SyncOperationDto], maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SyncOperationDto)
  operations: SyncOperationDto[];
}
