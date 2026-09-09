import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { SUPPORTED_LOCALES } from '../constants/locales';

/** Query strings arrive as text, so `?flag=true` has to be coerced before `@IsBoolean`. */
export const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === undefined ? undefined : value === 'true' || value === true;

/**
 * `?locale=` overrides `Accept-Language` (`02-database-localization-strategy.md`). `LocaleMiddleware`
 * has already resolved it by the time a DTO is validated; it is declared here only because
 * `forbidNonWhitelisted` would otherwise reject the parameter. Kept as a plain string rather than
 * an enum so an unsupported value falls back to the default locale instead of failing the request.
 */
export class LocalizedQueryDto {
  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    description: 'Overrides Accept-Language. Unsupported values fall back to the default locale.',
  })
  @IsOptional()
  @IsString()
  locale?: string;
}

/** Base for the reference-data lists that hide retired rows from pickers by default. */
export class ActiveFilterQueryDto extends LocalizedQueryDto {
  @ApiPropertyOptional({ default: false, description: 'Include deactivated rows.' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeInactive?: boolean;
}
