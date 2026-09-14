import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { toBoolean } from 'src/common/dto/query.dto';
import {
  MAINTENANCE_RESULTS,
  MAINTENANCE_STATUSES,
  MaintenanceResult,
  MaintenanceStatus,
  RESPONSIBLE_PARTIES,
  ResponsibleParty,
} from 'src/common/enums/operations.enum';
import { SignatureDto } from 'src/modules/transfers/dto/transfer.dto';
import { ReplacementMachineDto } from 'src/modules/replacements/dto/replacement.dto';

export class CreateMaintenanceOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  machineId: string;

  @ApiProperty({
    format: 'uuid',
    description: 'A maintenance location: INTERNAL_WORKSHOP, FACTORY or SERVICE_CENTER.',
  })
  @IsUUID()
  locationId: string;

  @ApiProperty({ example: 'الشاشة لا تعمل', minLength: 5, maxLength: 1000 })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reportedFault: string;

  @ApiProperty({ example: '2026-02-14T08:30:00.000Z' })
  @IsDateString()
  sentAt: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Device-generated id. Re-sending it returns the order already opened.',
  })
  @IsOptional()
  @IsUUID()
  clientUuid?: string;
}

export class UpdateMaintenanceOrderDto {
  @ApiPropertyOptional({ minLength: 5, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reportedFault?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only while the order is still open.' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  /**
   * Editable on a closed order too, as a correction — but only when the close produced no money
   * artefact. See `MaintenanceService.update`.
   */
  @ApiPropertyOptional({ example: 350 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({ example: 'محمد الفني', maxLength: 150 })
  @IsOptional()
  @IsString()
  @Length(2, 150)
  performedByName?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

/** Sending the machine away. The transfer type comes from the location, never from the client. */
export class SendMaintenanceOrderDto {
  @ApiPropertyOptional({ description: 'When it physically left. Defaults to now.' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The maintenance store, for INTERNAL_WORKSHOP orders. Resolved automatically when exactly ' +
      'one active store of that type exists.',
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiProperty({ type: SignatureDto })
  @ValidateNested()
  @Type(() => SignatureDto)
  signature: SignatureDto;
}

/** Booking the machine back into the company warehouse with the same serial it left with. */
export class ReceiveMaintenanceOrderDto {
  @ApiPropertyOptional({ description: 'When it physically came back. Defaults to now.' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The company warehouse receiving it. Resolved automatically when omitted.',
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiProperty({ type: SignatureDto })
  @ValidateNested()
  @Type(() => SignatureDto)
  signature: SignatureDto;
}

export class CloseMaintenanceOrderDto {
  @ApiProperty({ enum: MAINTENANCE_RESULTS })
  @IsEnum(MaintenanceResult)
  result: MaintenanceResult;

  @ApiProperty({ description: 'Overrides the pre-computed suggestion.' })
  @IsBoolean()
  isFreeUnderWarranty: boolean;

  /**
   * Optional here so a missing cost comes back as `COST_REQUIRED`, the code the clients switch
   * on, rather than as a generic validation failure (`22`).
   */
  @ApiPropertyOptional({
    example: 350,
    description: 'Required unless the repair was free under warranty.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost?: number;

  @ApiProperty({ enum: RESPONSIBLE_PARTIES })
  @IsEnum(ResponsibleParty)
  responsibleParty: ResponsibleParty;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required for REPRESENTATIVE.' })
  @ValidateIf(
    (dto: CloseMaintenanceOrderDto) => dto.responsibleParty === ResponsibleParty.REPRESENTATIVE,
  )
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required for MERCHANT.' })
  @ValidateIf((dto: CloseMaintenanceOrderDto) => dto.responsibleParty === ResponsibleParty.MERCHANT)
  @IsUUID()
  responsibleMerchantId?: string;

  /** Only a company-borne cost is paid out of a till, so only that branch needs a method. */
  @ApiPropertyOptional({ format: 'uuid', description: 'Required for a chargeable COMPANY close.' })
  @ValidateIf(
    (dto: CloseMaintenanceOrderDto) =>
      !dto.isFreeUnderWarranty && dto.responsibleParty === ResponsibleParty.COMPANY,
  )
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'A confirmed INVOICE media id.' })
  @IsOptional()
  @IsUUID()
  invoiceMediaId?: string;

  /** Same reasoning as `cost`: absent for a `REPLACED` close is `REPLACEMENT_PAYLOAD_REQUIRED`. */
  @ApiPropertyOptional({ type: ReplacementMachineDto, description: 'Required for REPLACED.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReplacementMachineDto)
  replacement?: ReplacementMachineDto;

  @ApiPropertyOptional({ example: 'محمد الفني', maxLength: 150 })
  @IsOptional()
  @IsString()
  @Length(2, 150)
  performedByName?: string;

  @ApiProperty({ example: '2026-03-02T14:00:00.000Z' })
  @IsDateString()
  returnedAt: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CancelMaintenanceOrderDto {
  @ApiProperty({ description: 'Mandatory: a cancelled order has to say why.', maxLength: 1000 })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason: string;
}

export const MAINTENANCE_SORT_FIELDS = ['sentAt', 'createdAt', 'cost'] as const;

export type MaintenanceSortField = (typeof MAINTENANCE_SORT_FIELDS)[number];

const toArray = ({ value }: { value: unknown }): unknown =>
  value === undefined ? undefined : Array.isArray(value) ? value : [value];

export class QueryMaintenanceOrdersDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  machineId?: string;

  @ApiPropertyOptional({ enum: MAINTENANCE_STATUSES, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(MAINTENANCE_STATUSES, { each: true })
  status?: MaintenanceStatus[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ enum: RESPONSIBLE_PARTIES })
  @IsOptional()
  @IsIn(RESPONSIBLE_PARTIES)
  responsibleParty?: ResponsibleParty;

  @ApiPropertyOptional({ description: 'Filters on sentAt.' })
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
  isFreeUnderWarranty?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: MAINTENANCE_SORT_FIELDS, default: 'sentAt' })
  @IsOptional()
  @IsIn(MAINTENANCE_SORT_FIELDS)
  sortBy: MaintenanceSortField = 'sentAt';
}

export class QueryMachineMaintenanceHistoryDto extends PaginationDto {}
