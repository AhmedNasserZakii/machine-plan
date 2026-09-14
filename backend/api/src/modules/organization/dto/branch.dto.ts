import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { PaginatedActiveFilterQueryDto } from 'src/common/dto/pagination.dto';

export class CreateBranchDto {
  @ApiProperty({ example: 'ALX', maxLength: 30 })
  @IsString()
  @Length(2, 30)
  @Matches(/^[A-Z][A-Z0-9_]*$/, { message: 'code must be UPPER_SNAKE_CASE' })
  code: string;

  /** Operational data, not localized — see `06-feature-branches-warehouses.md` rule 4. */
  @ApiProperty({ example: 'فرع الإسكندرية', maxLength: 150 })
  @IsString()
  @Length(2, 150)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  /** Not the mobile validator: a branch line is frequently a landline such as `0341234567`. */
  @ApiPropertyOptional({ example: '0341234567', maxLength: 20 })
  @IsOptional()
  @IsString()
  @Length(5, 20)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Name for the branch warehouse created alongside the branch.',
    example: 'مخزن فرع الإسكندرية',
  })
  @IsOptional()
  @IsString()
  @Length(2, 150)
  warehouseName?: string;
}

export class UpdateBranchDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @Length(2, 150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @Length(5, 20)
  phone?: string;
}

export class QueryBranchesDto extends PaginatedActiveFilterQueryDto {
  @ApiPropertyOptional({ description: 'Match against code or name.' })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  search?: string;
}
