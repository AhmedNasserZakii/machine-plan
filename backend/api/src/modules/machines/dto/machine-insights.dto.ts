import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { LocalizedQueryDto } from 'src/common/dto/query.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';

const MAX_TIMELINE_PAGE = 100;

export class QueryMachineTimelineDto extends LocalizedQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: MAX_TIMELINE_PAGE, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_TIMELINE_PAGE)
  limit: number = 30;

  /**
   * Keyset rather than an offset: the timeline is read newest-first while events are still being
   * written, and an offset would show the same hand-off twice or skip one entirely.
   */
  @ApiPropertyOptional({ description: 'The `nextCursor` from the previous page.' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class QueryDecommissionCandidatesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Repair cost over purchase price. Defaults to the configured consider ratio.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  minCostRatio?: number;

  @ApiPropertyOptional({ description: 'Defaults to the configured consider repair count.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minRepairCount?: number;

  @ApiPropertyOptional({ description: 'Only assets at least this many months old.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minAgeMonths?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
