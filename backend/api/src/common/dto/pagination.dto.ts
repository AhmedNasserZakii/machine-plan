import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { LocalizedQueryDto, toBoolean } from './query.dto';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
/** Reports and sync endpoints are allowed a larger page size. */
export const MAX_BULK_LIMIT = 500;

export type SortDirection = 'asc' | 'desc';

export class PaginationDto extends LocalizedQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: DEFAULT_PAGE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_PAGE;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir: SortDirection = 'desc';

  get skip(): number {
    return (this.page - 1) * this.limit;
  }

  get take(): number {
    return this.limit;
  }

  /** Uppercased direction for TypeORM's `orderBy`. */
  get order(): 'ASC' | 'DESC' {
    return this.sortDir === 'asc' ? 'ASC' : 'DESC';
  }
}

/**
 * Offset pagination plus the inactive-row flag the reference lists already use.
 * `PaginationDto` cannot extend `ActiveFilterQueryDto` (both hang off `LocalizedQueryDto`),
 * so DTOs that used to extend `ActiveFilterQueryDto` switch to this instead of re-declaring
 * `includeInactive` on every list.
 */
export class PaginatedActiveFilterQueryDto extends PaginationDto {
  @ApiPropertyOptional({ default: false, description: 'Include deactivated rows.' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeInactive?: boolean;
}
