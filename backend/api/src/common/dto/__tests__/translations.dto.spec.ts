import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  NameDescriptionTranslationsDto,
  NameTranslationsDto,
  PartialNameTranslationsDto,
} from '../translations.dto';

/** Mirrors the global `ValidationPipe` options from `main.ts`. */
function validate(cls: new () => object, payload: unknown): string[] {
  const instance = plainToInstance(cls, payload, { enableImplicitConversion: false });
  const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });

  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...(error.children ?? []).flatMap((child) => Object.values(child.constraints ?? {})),
  ]);
}

describe('translations payloads', () => {
  it('accepts the default locale on its own', () => {
    expect(validate(NameTranslationsDto, { ar: { name: 'ماكينة نقاط بيع' } })).toEqual([]);
  });

  it('accepts every supported locale', () => {
    expect(
      validate(NameTranslationsDto, {
        ar: { name: 'ماكينة نقاط بيع' },
        en: { name: 'POS Terminal' },
      }),
    ).toEqual([]);
  });

  it('requires the default locale', () => {
    const messages = validate(NameTranslationsDto, { en: { name: 'POS Terminal' } });
    expect(messages).toContain('ar is required');
  });

  it('rejects an unsupported locale', () => {
    const messages = validate(NameTranslationsDto, {
      ar: { name: 'نوع' },
      fr: { name: 'Type' },
    });
    expect(messages.join(' ')).toContain('property fr should not exist');
  });

  it('validates the fields inside a locale', () => {
    const messages = validate(NameTranslationsDto, { ar: { name: '' } });
    expect(messages.join(' ')).toContain('name should not be empty');
  });

  it('rejects an unknown field inside a locale', () => {
    const messages = validate(NameTranslationsDto, {
      ar: { name: 'نوع', description: 'الوصف' },
    });
    expect(messages.join(' ')).toContain('property description should not exist');
  });

  it('accepts a description on the name+description shape', () => {
    expect(
      validate(NameDescriptionTranslationsDto, {
        ar: { name: 'بطارية غير مطابقة', description: 'رقم البطارية لا يطابق الماكينة' },
      }),
    ).toEqual([]);
  });

  it('lets a patch send a single non-default locale', () => {
    expect(validate(PartialNameTranslationsDto, { en: { name: 'POS Terminal' } })).toEqual([]);
  });

  it('still validates locale fields on a patch', () => {
    const messages = validate(PartialNameTranslationsDto, { en: { name: '' } });
    expect(messages.join(' ')).toContain('name should not be empty');
  });
});
