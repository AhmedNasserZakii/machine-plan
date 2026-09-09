import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from 'src/common/dto';
import { CustodyGroupBy, ReportFormat, ReportGranularity } from 'src/common/enums/report.enum';

/**
 * The shared report contract of `17`: `dateFrom`, `dateTo`, `branchId`, paging, sorting and
 * `format`. Every report endpoint takes this or a subclass, so the mobile app can drive all
 * seventeen from one screen.
 */
export class ReportQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ignored for a caller the scope guard has already pinned to one branch.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  branchId?: string;

  @ApiPropertyOptional({
    enum: ReportFormat,
    default: ReportFormat.JSON,
    description: 'Anything but `json` is produced by a job and answered with 202.',
  })
  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;

  /**
   * A column key of the report being run. Validated against the report's own column list rather
   * than interpolated into SQL — the rows are already materialised under the row cap, so sorting
   * them is a comparison rather than a second query, and an unknown key is a 422 instead of an
   * injection point.
   */
  @ApiPropertyOptional({ description: 'One of the report’s column keys.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  sortBy?: string;
}

export class CustodyReportQueryDto extends ReportQueryDto {
  @ApiPropertyOptional({ enum: CustodyGroupBy, default: CustodyGroupBy.REPRESENTATIVE })
  @IsOptional()
  @IsEnum(CustodyGroupBy)
  groupBy?: CustodyGroupBy;
}

export class IdleReportQueryDto extends ReportQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 3650,
    description: 'Days without a hand-off. Defaults to `IDLE_ALERT_DAYS`.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;
}

export class WarrantyReportQueryDto extends ReportQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 3650,
    default: 30,
    description: 'Warranties lapsing within this many days.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;
}

export class ProfitLossQueryDto extends ReportQueryDto {
  @ApiPropertyOptional({ enum: ReportGranularity, default: ReportGranularity.MONTH })
  @IsOptional()
  @IsEnum(ReportGranularity)
  granularity?: ReportGranularity;
}
