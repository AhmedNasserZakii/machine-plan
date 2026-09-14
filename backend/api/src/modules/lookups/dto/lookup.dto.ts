import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { ActiveFilterQueryDto, toBoolean } from 'src/common/dto/query.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import {
  NameDescriptionTranslationsDto,
  NameTranslationsDto,
  PartialNameDescriptionTranslationsDto,
  PartialNameTranslationsDto,
} from 'src/common/dto/translations.dto';
import { Severity } from 'src/common/enums/operations.enum';

/** `code` is the stable identifier business logic switches on, so it is uppercase and immutable. */
class LookupCodeDto {
  @ApiProperty({ example: 'POS_TERMINAL', maxLength: 60 })
  @IsString()
  @Length(2, 60)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'code must be UPPER_SNAKE_CASE',
  })
  code: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0, description: 'Picker order; lower comes first.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateNameLookupDto extends LookupCodeDto {
  @ApiProperty({ type: NameTranslationsDto })
  @ValidateNested()
  @Type(() => NameTranslationsDto)
  translations: NameTranslationsDto;
}

export class UpdateNameLookupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  /** A patch may carry a single locale — the default-locale row already exists. */
  @ApiPropertyOptional({ type: PartialNameTranslationsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PartialNameTranslationsDto)
  translations?: PartialNameTranslationsDto;
}

export class CreateNameDescriptionLookupDto extends LookupCodeDto {
  @ApiProperty({ type: NameDescriptionTranslationsDto })
  @ValidateNested()
  @Type(() => NameDescriptionTranslationsDto)
  translations: NameDescriptionTranslationsDto;
}

export class UpdateNameDescriptionLookupDto extends UpdateNameLookupDto {
  @ApiPropertyOptional({ type: PartialNameDescriptionTranslationsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PartialNameDescriptionTranslationsDto)
  declare translations?: PartialNameDescriptionTranslationsDto;
}

export class CreateMachineTypeDto extends CreateNameLookupDto {
  @ApiPropertyOptional({
    default: true,
    description: 'Whether machines of this type carry a SIM card. False for a PIN pad.',
  })
  @IsOptional()
  @IsBoolean()
  requiresSim?: boolean;
}

export class UpdateMachineTypeDto extends UpdateNameLookupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresSim?: boolean;
}

export class CreateViolationTypeDto extends CreateNameDescriptionLookupDto {
  @ApiPropertyOptional({ enum: Severity, default: Severity.MEDIUM })
  @IsOptional()
  @IsEnum(Severity)
  defaultSeverity?: Severity;
}

export class UpdateViolationTypeDto extends UpdateNameDescriptionLookupDto {
  @ApiPropertyOptional({ enum: Severity })
  @IsOptional()
  @IsEnum(Severity)
  defaultSeverity?: Severity;
}

export class CreateMachineModelDto extends CreateNameDescriptionLookupDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  machineTypeId: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  manufacturer?: string;
}

export class UpdateMachineModelDto extends UpdateNameDescriptionLookupDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  machineTypeId?: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  manufacturer?: string;
}

/** Shared query string for every lookup list endpoint. */
export class QueryLookupDto extends ActiveFilterQueryDto {
  @ApiPropertyOptional({
    default: false,
    description: 'Return the full per-locale map instead of a resolved string (admin screens).',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  rawTranslations?: boolean;
}

export class QueryMachineModelsDto extends PaginationDto {
  @ApiPropertyOptional({ default: false, description: 'Include deactivated rows.' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeInactive?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Return the full per-locale map instead of a resolved string (admin screens).',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  rawTranslations?: boolean;

  @ApiPropertyOptional({ format: 'uuid', description: 'Limit to the models of one machine type.' })
  @IsOptional()
  @IsUUID()
  machineTypeId?: string;
}
