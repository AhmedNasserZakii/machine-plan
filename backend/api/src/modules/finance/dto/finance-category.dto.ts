import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ActiveFilterQueryDto } from 'src/common/dto/query.dto';
import { PaginatedActiveFilterQueryDto } from 'src/common/dto/pagination.dto';
import {
  NameDescriptionTranslationsDto,
  PartialNameDescriptionTranslationsDto,
} from 'src/common/dto/translations.dto';
import { FINANCE_KINDS, FinanceKind } from 'src/common/enums/finance.enum';

export class CreateFinanceCategoryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Omit to create a root category.' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiProperty({
    enum: FINANCE_KINDS,
    description: 'Must equal the parent kind; a child of an expense is always an expense.',
  })
  @IsIn(FINANCE_KINDS)
  kind: FinanceKind;

  @ApiProperty({ type: NameDescriptionTranslationsDto })
  @ValidateNested()
  @Type(() => NameDescriptionTranslationsDto)
  translations: NameDescriptionTranslationsDto;

  @ApiPropertyOptional({ default: 0, description: 'Picker order among siblings.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/**
 * `kind` and `parentId` are absent by design: the first is immutable after creation (`14`, rule 1)
 * and the second moves through `PATCH /finance/categories/:id/move`, which has a whole subtree to
 * rewrite and cannot be a field on a general-purpose patch.
 */
export class UpdateFinanceCategoryDto {
  @ApiPropertyOptional({ type: PartialNameDescriptionTranslationsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PartialNameDescriptionTranslationsDto)
  translations?: PartialNameDescriptionTranslationsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'False hides the category from pickers and keeps every booked transaction.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class MoveFinanceCategoryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Omit or send null to move to the root.' })
  @IsOptional()
  @IsUUID()
  newParentId?: string | null;
}

export class QueryFinanceCategoriesDto extends PaginatedActiveFilterQueryDto {
  @ApiPropertyOptional({ enum: FINANCE_KINDS })
  @IsOptional()
  @IsIn(FINANCE_KINDS)
  kind?: FinanceKind;

  @ApiPropertyOptional({ format: 'uuid', description: 'Direct children of this node only.' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Case-insensitive partial match on the localized name.' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;
}

/** Depth 0 is the roots alone; the tree is unbounded unless a caller asks for less. */
const MAX_TREE_DEPTH = 20;

export class QueryFinanceCategoryTreeDto extends ActiveFilterQueryDto {
  @ApiPropertyOptional({ enum: FINANCE_KINDS })
  @IsOptional()
  @IsIn(FINANCE_KINDS)
  kind?: FinanceKind;

  @ApiPropertyOptional({ format: 'uuid', description: 'Return only the subtree under this node.' })
  @IsOptional()
  @IsUUID()
  rootCategoryId?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_TREE_DEPTH })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_TREE_DEPTH)
  maxDepth?: number;
}
