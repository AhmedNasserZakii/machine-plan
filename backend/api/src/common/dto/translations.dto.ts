import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type as TransformType } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { DEFAULT_LOCALE, Locale, SUPPORTED_LOCALES } from '../constants/locales';

/** A single locale's translatable fields for a name-only lookup entity. */
export class NameTranslationDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name: string;
}

/** A single locale's translatable fields for entities that also carry a description. */
export class NameDescriptionTranslationDto extends NameTranslationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export type TranslationsMap<T> = Partial<Record<Locale, T>>;

type LocalePayloadClass<T> = new (...args: never[]) => T;

/**
 * Builds the `{ ar: {...}, en: {...} }` payload class for one locale shape.
 *
 * The locales are declared as real properties instead of an index-signature map, because
 * class-validator's `@ValidateNested({ each: true })` only iterates arrays, Sets and Maps: given a
 * map it validates the wrapper object *itself* against the locale payload, which rejects `ar` and
 * `en` as unknown keys and reports a missing `name` that was never meant to be there. Declaring
 * the properties also lets `forbidNonWhitelisted` reject an unsupported locale and gives each
 * error its exact path, e.g. `translations.en.name`.
 *
 * `partial` drops the default-locale requirement, for PATCH payloads that carry only the locale
 * being edited (`02-database-localization-strategy.md`).
 */
export function TranslationsOf<T extends object>(
  localePayload: LocalePayloadClass<T>,
  options: { partial?: boolean } = {},
): LocalePayloadClass<TranslationsMap<T>> {
  class Translations {}

  for (const locale of SUPPORTED_LOCALES) {
    // Every fallback lands on the default locale, so it is the one entry a create must carry.
    const required = !options.partial && locale === DEFAULT_LOCALE;
    const target = Translations.prototype as object;

    (required ? IsDefined({ message: `${locale} is required` }) : IsOptional())(target, locale);
    ValidateNested()(target, locale);
    TransformType(() => localePayload)(target, locale);
    (required ? ApiProperty : ApiPropertyOptional)({ type: localePayload })(target, locale);
  }

  return Translations;
}

export class NameTranslationsDto extends TranslationsOf(NameTranslationDto) {}

export class PartialNameTranslationsDto extends TranslationsOf(NameTranslationDto, {
  partial: true,
}) {}

export class NameDescriptionTranslationsDto extends TranslationsOf(NameDescriptionTranslationDto) {}

export class PartialNameDescriptionTranslationsDto extends TranslationsOf(
  NameDescriptionTranslationDto,
  { partial: true },
) {}
