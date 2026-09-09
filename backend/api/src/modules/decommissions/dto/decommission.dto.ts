import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { SignatureDto } from 'src/modules/transfers/dto/transfer.dto';

export class DecommissionMachineDto {
  @ApiProperty({ format: 'uuid', description: 'A seeded decommission reason.' })
  @IsUUID()
  reasonId: string;

  @ApiProperty({
    example: 'تكلفة الإصلاح تجاوزت قيمة الماكينة',
    minLength: 5,
    maxLength: 1000,
    description: 'Mandatory: scrapping an asset has to say why on the record.',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  notes: string;

  @ApiProperty({ example: '2026-09-01T09:00:00.000Z' })
  @IsDateString()
  decommissionedAt: string;

  @ApiPropertyOptional({ type: SignatureDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SignatureDto)
  signature?: SignatureDto;
}

export class RevertDecommissionDto {
  @ApiProperty({
    example: 'أُخرجت بالخطأ، الماكينة سليمة',
    minLength: 10,
    maxLength: 1000,
    description: 'A revert is a loud, reasoned act (`13`, rule 3) — never a silent flag flip.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;
}

export const DECOMMISSION_SORT_FIELDS = ['decommissionedAt', 'createdAt'] as const;

export type DecommissionSortField = (typeof DECOMMISSION_SORT_FIELDS)[number];

export class QueryDecommissionsDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  reasonId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ enum: DECOMMISSION_SORT_FIELDS, default: 'decommissionedAt' })
  @IsOptional()
  @IsIn(DECOMMISSION_SORT_FIELDS)
  sortBy: DecommissionSortField = 'decommissionedAt';
}
