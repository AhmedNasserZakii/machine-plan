import { SelectQueryBuilder } from 'typeorm';
import { DEFAULT_LOCALE, Locale } from '../constants/locales';

/**
 * Left-joins a translation relation for the requested locale **and** the default locale,
 * so a mapper can fall back when a translation is missing.
 *
 * ```ts
 * const qb = repo.createQueryBuilder('mt');
 * joinTranslation(qb, 'mt', 'translations', locale);
 * ```
 */
export function joinTranslation<T extends object>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  translationRelation: string,
  locale: Locale,
): SelectQueryBuilder<T> {
  const locales = locale === DEFAULT_LOCALE ? [DEFAULT_LOCALE] : [locale, DEFAULT_LOCALE];
  const paramName = `${alias}_locales`;

  return qb.leftJoinAndSelect(
    `${alias}.${translationRelation}`,
    `${alias}_tr`,
    `${alias}_tr.locale IN (:...${paramName})`,
    { [paramName]: locales },
  );
}

/**
 * Orders a query by the translated name of the requested locale.
 * Requires `joinTranslation` to have run with the same alias.
 */
export function orderByTranslatedName<T extends object>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  locale: Locale,
  direction: 'ASC' | 'DESC' = 'ASC',
): SelectQueryBuilder<T> {
  return qb
    .addSelect(
      `CASE WHEN ${alias}_tr.locale = :${alias}_primary THEN 0 ELSE 1 END`,
      `${alias}_rank`,
    )
    .setParameter(`${alias}_primary`, locale)
    .orderBy(`${alias}_rank`, 'ASC')
    .addOrderBy(`${alias}_tr.name`, direction);
}
