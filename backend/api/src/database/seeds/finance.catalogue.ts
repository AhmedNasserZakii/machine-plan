import { Locale } from 'src/common/constants/locales';
import { FinanceKind } from 'src/common/enums/finance.enum';
import { SeedTranslation } from './lookups.catalogue';

export interface SeedFinanceCategory {
  code: string;
  kind: FinanceKind;
  sortOrder: number;
  translations: Record<Locale, SeedTranslation>;
}

/**
 * The four categories other modules post against (`14`, rule 2).
 *
 * Their codes are the contract — auto-posting resolves its target by code, never by id — so they
 * are seeded as protected roots. The names are the operator's to change and the shape of the tree
 * around them is his to build: nesting these under his own headings is a `move`, not a migration.
 */
export const FINANCE_CATEGORIES: SeedFinanceCategory[] = [
  {
    code: 'MAINTENANCE',
    kind: FinanceKind.EXPENSE,
    sortOrder: 10,
    translations: {
      ar: { name: 'صيانة', description: 'تكاليف إصلاح وصيانة الماكينات' },
      en: { name: 'Maintenance', description: 'Machine repair and servicing costs' },
    },
  },
  {
    code: 'MACHINE_PURCHASE',
    kind: FinanceKind.EXPENSE,
    sortOrder: 20,
    translations: {
      ar: { name: 'شراء ماكينات', description: 'تكلفة الماكينات الواردة من المصنع' },
      en: { name: 'Machine purchase', description: 'Cost of machines received from the factory' },
    },
  },
  {
    code: 'VIOLATION_CHARGES',
    kind: FinanceKind.INCOME,
    sortOrder: 30,
    translations: {
      ar: { name: 'غرامات المخالفات', description: 'المبالغ المحصلة من مخالفات المناديب' },
      en: {
        name: 'Violation charges',
        description: 'Amounts charged for representative violations',
      },
    },
  },
  {
    code: 'MERCHANT_SUBSCRIPTIONS',
    kind: FinanceKind.INCOME,
    sortOrder: 40,
    translations: {
      ar: { name: 'اشتراكات التجار', description: 'الاشتراكات الشهرية والسنوية المحصلة' },
      en: { name: 'Merchant subscriptions', description: 'Monthly and yearly plans collected' },
    },
  },
];
