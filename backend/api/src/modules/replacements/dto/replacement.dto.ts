import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CreateBatteryDto } from 'src/modules/machines/dto/machine.dto';

/**
 * What the factory handed back. Everything the new unit needs that is *not* inherited from the old
 * one: the serials on the box in front of the storekeeper, and the warranty the factory issued
 * with it.
 */
export class ReplacementMachineDto {
  @ApiProperty({ example: 'SN-00712', maxLength: 100 })
  @IsString()
  @Length(3, 100)
  newSerial: string;

  @ApiProperty({ type: CreateBatteryDto })
  @ValidateNested()
  @Type(() => CreateBatteryDto)
  newBattery: CreateBatteryDto;

  /** Same type-driven rule as intake: required when the type has `requiresSim`. */
  @ApiPropertyOptional({ example: '8920011234567890123', maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(3, 100)
  newSimSerial?: string;

  @ApiPropertyOptional({ example: 'BX-00712', maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(3, 100)
  newBoxSerial?: string;

  @ApiPropertyOptional({ format: 'uuid', description: "Defaults to the old machine's model." })
  @IsOptional()
  @IsUUID()
  machineModelId?: string;

  @ApiPropertyOptional({ example: '2026-03-02' })
  @IsOptional()
  @IsDateString()
  newWarrantyStart?: string;

  @ApiPropertyOptional({ example: '2027-03-02' })
  @IsOptional()
  @IsDateString()
  newWarrantyEnd?: string;

  @ApiProperty({ description: 'Whether the carton came with the replacement.' })
  @IsBoolean()
  hasBox: boolean;

  @ApiProperty({ example: 'لوحة رئيسية تالفة', minLength: 5, maxLength: 500 })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;

  @ApiProperty({ example: '2026-03-02T10:00:00.000Z' })
  @IsDateString()
  replacedAt: string;
}

export const REPLACEMENT_SORT_FIELDS = ['replacedAt', 'createdAt'] as const;

export type ReplacementSortField = (typeof REPLACEMENT_SORT_FIELDS)[number];

export class QueryReplacementsDto extends PaginationDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Matches either side of the swap, so a serial finds its own replacement.',
  })
  @IsOptional()
  @IsUUID()
  machineId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  maintenanceOrderId?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
