import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { NameDescriptionTranslationDto, TranslationsOf } from 'src/common/dto/translations.dto';

/** Locale payload for a role: `displayName` + optional `description`. */
export class RoleTranslationDto {
  @ApiProperty({ example: 'مشرف فرع' })
  @IsString()
  displayName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class RoleTranslationsDto extends TranslationsOf(RoleTranslationDto) {}

export class PartialRoleTranslationsDto extends TranslationsOf(RoleTranslationDto, {
  partial: true,
}) {}

export class CreateRoleDto {
  @ApiProperty({ example: 'WAREHOUSE_KEEPER', description: 'SCREAMING_SNAKE, unique' })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,49}$/, {
    message: 'code must be SCREAMING_SNAKE_CASE, 2-50 characters',
  })
  code: string;

  @ApiProperty({ type: RoleTranslationsDto })
  @ValidateNested()
  @Type(() => RoleTranslationsDto)
  translations: RoleTranslationsDto;

  @ApiPropertyOptional({ type: [String], description: 'Permission codes granted to the role' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ type: PartialRoleTranslationsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PartialRoleTranslationsDto)
  translations?: PartialRoleTranslationsDto;
}

export class SetRolePermissionsDto {
  @ApiProperty({ type: [String], description: 'The complete permission code set for the role' })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}

// Re-exported so lookup modules in Phase 2 can share the same shape.
export { NameDescriptionTranslationDto };
