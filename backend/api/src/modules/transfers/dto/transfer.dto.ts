import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { toBoolean } from 'src/common/dto/query.dto';
import {
  ItemCondition,
  ITEM_CONDITIONS,
  SignatureMethod,
  SIGNATURE_METHODS,
  TransferStatus,
  TRANSFER_STATUSES,
  TransferType,
  TRANSFER_TYPES,
} from 'src/common/enums/transfer.enum';

export class SignatureDto {
  @ApiProperty({ enum: SIGNATURE_METHODS })
  @IsEnum(SignatureMethod)
  method: SignatureMethod;

  @ApiPropertyOptional({ description: 'Required when method is DRAWN_SIGNATURE' })
  @IsOptional()
  @IsUUID()
  signatureMediaId?: string;

  @ApiPropertyOptional({ description: 'Required when method is BIOMETRIC' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceModel?: string;
}

export class TransferItemDto {
  @ApiProperty()
  @IsUUID()
  machineId: string;

  @ApiPropertyOptional({ description: 'Omit entirely when nobody scanned the battery' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  batterySerialScanned?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  simSerialScanned?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  boxSerialScanned?: string;

  @ApiProperty()
  @IsBoolean()
  hasCharger: boolean;

  @ApiProperty()
  @IsBoolean()
  hasBox: boolean;

  @ApiProperty({ enum: ITEM_CONDITIONS })
  @IsEnum(ItemCondition)
  condition: ItemCondition;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ type: [String], description: 'Confirmed TRANSFER_PHOTO media ids, max 4' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsUUID('4', { each: true })
  photoMediaIds?: string[];
}

export class CreateTransferDto {
  @ApiProperty({ description: 'Device-generated; replaying it returns the original transfer' })
  @IsUUID()
  clientUuid: string;

  @ApiProperty({ enum: TRANSFER_TYPES })
  @IsEnum(TransferType)
  type: TransferType;

  @ApiPropertyOptional({ description: 'User, merchant or warehouse id depending on the type' })
  @IsOptional()
  @IsUUID()
  toPartyId?: string;

  @ApiProperty({ description: 'When the hand-off physically happened, from the device clock' })
  @IsDateString()
  occurredAt: string;

  @ApiProperty({ type: [TransferItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items: TransferItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ type: SignatureDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SignatureDto)
  senderSignature?: SignatureDto;
}

export class ItemAdjustmentDto {
  @ApiProperty()
  @IsUUID()
  transferItemId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasCharger?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasBox?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  batterySerialScanned?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  simSerialScanned?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  boxSerialScanned?: string;

  @ApiPropertyOptional({ enum: ITEM_CONDITIONS })
  @IsOptional()
  @IsEnum(ItemCondition)
  condition?: ItemCondition;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ConfirmTransferDto {
  @ApiProperty({ type: SignatureDto })
  @ValidateNested()
  @Type(() => SignatureDto)
  signature: SignatureDto;

  @ApiProperty({ description: 'SHA-256 of the item list the receiver actually read on screen' })
  @IsString()
  @MaxLength(128)
  payloadHash: string;

  @ApiPropertyOptional({ type: [ItemAdjustmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemAdjustmentDto)
  adjustments?: ItemAdjustmentDto[];
}

export class RejectTransferDto {
  @ApiProperty({ description: 'Mandatory: the sender has to know why the delivery bounced' })
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class CancelTransferDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

/** `?type=A&type=B` arrives as an array, `?type=A` as a bare string; both must validate. */
const toArray = ({ value }: { value: unknown }): unknown =>
  value === undefined ? undefined : Array.isArray(value) ? value : [value];

export class TransferRecipientsQueryDto extends PaginationDto {
  @ApiProperty({ enum: TRANSFER_TYPES, description: 'The hand-off the caller is about to create' })
  @IsEnum(TransferType)
  type: TransferType;

  @ApiPropertyOptional({ description: 'Partial match on the recipient name.' })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  search?: string;
}

export class QueryTransfersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TRANSFER_TYPES, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(TRANSFER_TYPES, { each: true })
  type?: TransferType[];

  @ApiPropertyOptional({ enum: TRANSFER_STATUSES, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(TRANSFER_STATUSES, { each: true })
  status?: TransferStatus[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fromPartyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  toPartyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  machineId?: string;

  @ApiPropertyOptional({ description: 'Filters on occurredAt, not createdAt' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hasViolations?: boolean;
}
