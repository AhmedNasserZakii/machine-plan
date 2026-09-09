import { Locale } from 'src/common/constants/locales';
import { ReportKey } from 'src/common/enums/report.enum';
import { Perm, PermissionCode } from 'src/modules/roles/permissions.catalogue';

export interface ReportDefinition {
  key: ReportKey;
  /** Checked by `PermissionsGuard` on the endpoint; repeated here for the catalogue endpoint. */
  permission: PermissionCode;
  /**
   * The `*.read.all` permission that widens the report past the caller's own branch (`17`,
   * rule 4). Each report borrows the one its underlying module uses, so a supervisor who cannot
   * see another branch's machines cannot see them in a report either.
   */
  branchScopePermission: PermissionCode;
  titles: Record<Locale, string>;
}

const define = (
  key: ReportKey,
  permission: PermissionCode,
  branchScopePermission: PermissionCode,
  ar: string,
  en: string,
): ReportDefinition => ({ key, permission, branchScopePermission, titles: { ar, en } });

/**
 * The report catalogue of `17`, with the permission each endpoint is gated on.
 *
 * One table rather than decorators alone: the guards read `Perm.*` on the handler, and this is
 * what `GET /reports` renders so the app can hide the reports a user may not run instead of
 * offering him seventeen tiles that answer 403.
 */
export const REPORT_CATALOGUE: readonly ReportDefinition[] = [
  define(
    ReportKey.MACHINE_INVENTORY,
    Perm.REPORTS_MACHINES,
    Perm.MACHINES_READ_ALL,
    'جرد الماكينات',
    'Machine inventory',
  ),
  define(
    ReportKey.MACHINE_CUSTODY,
    Perm.REPORTS_MACHINES,
    Perm.MACHINES_READ_ALL,
    'عهدة الماكينات',
    'Machine custody',
  ),
  define(
    ReportKey.MACHINE_IDLE,
    Perm.REPORTS_MACHINES,
    Perm.MACHINES_READ_ALL,
    'ماكينات بدون حركة',
    'Idle machines',
  ),
  define(
    ReportKey.MACHINE_LIFECYCLE,
    Perm.REPORTS_MACHINES,
    Perm.MACHINES_READ_ALL,
    'تاريخ الماكينة',
    'Machine lifecycle',
  ),
  define(
    ReportKey.MACHINE_COSTS,
    Perm.REPORTS_MACHINES,
    Perm.MACHINES_READ_ALL,
    'تكاليف الماكينات',
    'Machine costs',
  ),
  define(
    ReportKey.WARRANTY_EXPIRY,
    Perm.REPORTS_MACHINES,
    Perm.MACHINES_READ_ALL,
    'انتهاء الضمان',
    'Warranty expiry',
  ),
  define(
    ReportKey.TRANSFERS_LOG,
    Perm.REPORTS_TRANSFERS,
    Perm.TRANSFERS_READ_ALL,
    'سجل التسليمات',
    'Transfers log',
  ),
  define(
    ReportKey.TRANSFERS_PENDING,
    Perm.REPORTS_TRANSFERS,
    Perm.TRANSFERS_READ_ALL,
    'تسليمات معلقة',
    'Pending transfers',
  ),
  define(
    ReportKey.REPRESENTATIVE_PERFORMANCE,
    Perm.REPORTS_VIOLATIONS,
    Perm.VIOLATIONS_READ_ALL,
    'أداء المندوبين',
    'Representative performance',
  ),
  define(
    ReportKey.VIOLATIONS_REGISTER,
    Perm.REPORTS_VIOLATIONS,
    Perm.VIOLATIONS_READ_ALL,
    'سجل المخالفات',
    'Violations register',
  ),
  define(
    ReportKey.MERCHANT_PORTFOLIO,
    Perm.MERCHANTS_READ,
    Perm.MERCHANTS_READ_ALL,
    'محفظة التجار',
    'Merchant portfolio',
  ),
  define(
    ReportKey.MAINTENANCE_LOG,
    Perm.MAINTENANCE_READ,
    Perm.MACHINES_READ_ALL,
    'سجل الصيانة',
    'Maintenance log',
  ),
  define(
    ReportKey.EXPENSES_BY_CATEGORY,
    Perm.REPORTS_FINANCE,
    Perm.FINANCE_READ_ALL,
    'المصروفات حسب التصنيف',
    'Expenses by category',
  ),
  define(
    ReportKey.INCOME_BY_CATEGORY,
    Perm.REPORTS_FINANCE,
    Perm.FINANCE_READ_ALL,
    'الإيرادات حسب التصنيف',
    'Income by category',
  ),
  define(
    ReportKey.PROFIT_LOSS,
    Perm.REPORTS_FINANCE,
    Perm.FINANCE_READ_ALL,
    'الأرباح والخسائر',
    'Profit and loss',
  ),
  define(
    ReportKey.BUDGET_PERFORMANCE,
    Perm.REPORTS_FINANCE,
    Perm.FINANCE_READ_ALL,
    'أداء الميزانيات',
    'Budget performance',
  ),
  define(
    ReportKey.BRANCH_COMPARISON,
    Perm.REPORTS_FINANCE,
    Perm.FINANCE_READ_ALL,
    'مقارنة الفروع',
    'Branch comparison',
  ),
];

/**
 * Where each report lives, for the catalogue endpoint.
 *
 * Kept beside the definitions rather than derived from the controller's decorators: the app
 * builds its report menu from this list, and a path it has to guess is a path that will
 * eventually be wrong.
 */
export const REPORT_PATHS: Record<ReportKey, string> = {
  [ReportKey.MACHINE_INVENTORY]: '/reports/machines/inventory',
  [ReportKey.MACHINE_CUSTODY]: '/reports/machines/custody',
  [ReportKey.MACHINE_IDLE]: '/reports/machines/idle',
  [ReportKey.MACHINE_LIFECYCLE]: '/reports/machines/{id}/lifecycle',
  [ReportKey.MACHINE_COSTS]: '/reports/machines/costs',
  [ReportKey.WARRANTY_EXPIRY]: '/reports/machines/warranty',
  [ReportKey.TRANSFERS_LOG]: '/reports/transfers',
  [ReportKey.TRANSFERS_PENDING]: '/reports/transfers/pending',
  [ReportKey.REPRESENTATIVE_PERFORMANCE]: '/reports/representatives',
  [ReportKey.VIOLATIONS_REGISTER]: '/reports/violations',
  [ReportKey.MERCHANT_PORTFOLIO]: '/reports/merchants',
  [ReportKey.MAINTENANCE_LOG]: '/reports/maintenance',
  [ReportKey.EXPENSES_BY_CATEGORY]: '/reports/finance/expenses',
  [ReportKey.INCOME_BY_CATEGORY]: '/reports/finance/income',
  [ReportKey.PROFIT_LOSS]: '/reports/finance/pnl',
  [ReportKey.BUDGET_PERFORMANCE]: '/reports/finance/budgets',
  [ReportKey.BRANCH_COMPARISON]: '/reports/branches/comparison',
};

const BY_KEY = new Map<ReportKey, ReportDefinition>(
  REPORT_CATALOGUE.map((definition) => [definition.key, definition]),
);

export function reportDefinition(key: ReportKey): ReportDefinition {
  const definition = BY_KEY.get(key);
  if (!definition) throw new Error(`No report is defined for ${key}`);

  return definition;
}

export function reportTitle(key: ReportKey, locale: Locale): string {
  return reportDefinition(key).titles[locale];
}
