import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { SUPPORTED_LOCALES } from 'src/common/constants/locales';
import { buildPath, depthOf } from 'src/modules/finance/category-path';
import { FinanceCategory } from 'src/modules/finance/entities/finance-category.entity';
import { FinanceCategoryTranslation } from 'src/modules/finance/entities/finance-category-translation.entity';
import { FINANCE_CATEGORIES } from './finance.catalogue';
import { SeedLogger } from './seed-logger';

/**
 * Seeds the protected finance categories.
 *
 * Idempotent by `code`, and deliberately narrow: an existing row keeps its `path`, so a category
 * an operator has since moved under one of his own headings is not yanked back to the root on the
 * next deploy. Only the translations and sort order are refreshed.
 */
export async function seedFinance(dataSource: DataSource, log: SeedLogger): Promise<void> {
  const categories = dataSource.getRepository(FinanceCategory);
  const translations = dataSource.getRepository(FinanceCategoryTranslation);

  let created = 0;
  let updated = 0;

  for (const row of FINANCE_CATEGORIES) {
    const existing = await categories.findOne({ where: { code: row.code } });
    let id: string;

    if (existing) {
      await categories.update(existing.id, { sortOrder: row.sortOrder, isSystem: true });
      id = existing.id;
      updated += 1;
    } else {
      // The id is generated here because the materialized path is built from it: a root's path is
      // its own label, so the row cannot be written until its id is known.
      id = randomUUID();
      const path = buildPath(null, id);

      await categories.save(
        categories.create({
          id,
          code: row.code,
          parentId: null,
          path,
          depth: depthOf(path),
          kind: row.kind,
          isSystem: true,
          isActive: true,
          sortOrder: row.sortOrder,
        }),
      );
      created += 1;
    }

    for (const locale of SUPPORTED_LOCALES) {
      const payload = row.translations[locale];
      const values = { name: payload.name, description: payload.description ?? null };
      const present = await translations.findOne({
        where: { financeCategoryId: id, locale },
      });

      if (present) await translations.update(present.id, values);
      else
        await translations.save(translations.create({ financeCategoryId: id, locale, ...values }));
    }
  }

  log.step(`finance categories: ${created} created, ${updated} updated`);
}
