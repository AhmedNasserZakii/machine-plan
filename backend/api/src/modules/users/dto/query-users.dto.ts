import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { toBoolean } from 'src/common/dto/query.dto';

export const USER_SORT_FIELDS = ['fullName', 'phone', 'createdAt', 'lastLoginAt'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export class QueryUsersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Partial match on full name or phone' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  // Coerced before validation, like every other boolean query flag — validating the raw
  // string here would reject the value the transform has already turned into a boolean.
  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: USER_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(USER_SORT_FIELDS)
  sortBy: UserSortField = 'createdAt';
}

export class QueryUserCustodyDto extends PaginationDto {}
