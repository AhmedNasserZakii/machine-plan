import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { toBoolean } from 'src/common/dto/query.dto';
import { MACHINE_STATUSES, MachineStatus } from 'src/common/enums/machine-status.enum';
import { PARTY_TYPES, PartyType } from 'src/common/enums/transfer.enum';

export class CreateBatteryDto {
  @ApiProperty({ example: 'BT-91223', maxLength: 100 })
  @IsString()
  @Length(3, 100)
  serial: string;
}

export class CreateMachineDto {
  @ApiProperty({ example: 'SN-00341', maxLength: 100 })
  @IsString()
  @Length(3, 100)
  serial: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  machineModelId: string;

  @ApiPropertyOptional({ description: 'Only when the sticker encodes something else.' })
  @IsOptional()
  @IsString()
  qrPayload?: string;

  @ApiProperty({ type: CreateBatteryDto })
  @ValidateNested()
  @Type(() => CreateBatteryDto)
  battery: CreateBatteryDto;

  /** Required when the model's type has `requiresSim`; rejected when it does not. */
  @ApiPropertyOptional({ example: '8920011234567890123', maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(3, 100)
  simSerial?: string;

  @ApiPropertyOptional({ example: 'BX-00341', maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(3, 100)
  boxSerial?: string;

  @ApiPropertyOptional({ example: 4200 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  purchasePrice?: number;

  @ApiPropertyOptional({ example: '2025-02-10' })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  factoryInvoiceNo?: string;

  @ApiPropertyOptional({ example: '2025-02-10' })
  @IsOptional()
  @IsDateString()
  warrantyStart?: string;

  @ApiPropertyOptional({ example: '2026-02-10' })
  @IsOptional()
  @IsDateString()
  warrantyEnd?: string;

  @ApiProperty({ description: 'Whether the carton arrived with the unit.' })
  @IsBoolean()
  hasBox: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMachineDto {
  /**
   * The three serials are declared only so they survive `forbidNonWhitelisted` and can be
   * rejected by name with `422 SERIAL_IMMUTABLE`. Dropping them silently, or failing with a
   * generic validation error, would leave a client believing it renamed a machine.
   */
  @ApiPropertyOptional({ description: 'Rejected with 422 SERIAL_IMMUTABLE.' })
  @IsOptional()
  @IsString()
  serial?: string;

  @ApiPropertyOptional({ description: 'Rejected with 422 SERIAL_IMMUTABLE.' })
  @IsOptional()
  @IsString()
  simSerial?: string;

  @ApiPropertyOptional({ description: 'Rejected with 422 SERIAL_IMMUTABLE.' })
  @IsOptional()
  @IsString()
  boxSerial?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  machineModelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qrPayload?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  purchasePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  factoryInvoiceNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  warrantyStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  warrantyEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

/** Factory intake. Validated as a whole and committed as a whole. */
export class BulkCreateMachinesDto {
  @ApiProperty({ type: [CreateMachineDto], maxItems: 500 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateMachineDto)
  machines: CreateMachineDto[];
}

export const MACHINE_SORT_FIELDS = [
  'createdAt',
  'serial',
  'status',
  'warrantyEnd',
  'totalRepairCost',
] as const;

export type MachineSortField = (typeof MACHINE_SORT_FIELDS)[number];

export class QueryMachinesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Matches any of the four serials: machine, battery, SIM or box.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional({ enum: MACHINE_STATUSES, isArray: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? undefined : Array.isArray(value) ? value : [value],
  )
  @IsArray()
  @IsIn(MACHINE_STATUSES, { each: true })
  status?: MachineStatus[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  machineTypeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  machineModelId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: PARTY_TYPES })
  @IsOptional()
  @IsIn(PARTY_TYPES)
  holderType?: PartyType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  holderId?: string;

  @ApiPropertyOptional({ description: 'Warranty ending before this date.', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  warrantyExpiringBefore?: string;

  @ApiPropertyOptional({ description: 'Only machines whose repair bill is at least this much.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minRepairCost?: number;

  @ApiPropertyOptional({ description: 'Untouched for at least this many days.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idleSinceDays?: number;

  /**
   * Retired machines are hidden by default: the fleet lists, the pickers and the transfer forms
   * all want the machines that still exist, and a decommissioned unit showing up in a hand-off
   * picker is a support call.
   */
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeRetired?: boolean;

  @ApiPropertyOptional({ enum: MACHINE_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(MACHINE_SORT_FIELDS)
  sortBy: MachineSortField = 'createdAt';
}

export class LookupMachineDto {
  @ApiProperty({ description: 'A scanned code: machine, battery, SIM or box serial.' })
  @IsString()
  @Length(1, 100)
  code: string;
}
