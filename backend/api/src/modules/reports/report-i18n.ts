import { Locale } from 'src/common/constants/locales';
import { ExportCell } from 'src/common/export';
import { ReportResult } from './report.types';

type Localized = Record<Locale, string>;

/**
 * English for every column header the report services declare.
 *
 * Keyed by the Arabic header rather than the column key because one key reads differently from
 * report to report — `amount` is "المبلغ" on a ledger and "الميزانية" on a budget — and the Arabic
 * is what the services already author. A header missing here stays Arabic, which the spec on this
 * file turns into a failing test rather than a screen.
 */
export const HEADERS_EN: Record<string, string> = {
  'اشتراكات نشطة': 'Active plans',
  'قيمة الاشتراك': 'Plan amount',
  المبلغ: 'Amount',
  الميزانية: 'Budget',
  التاريخ: 'Date',
  المصدر: 'Source',
  'متوسط ساعات التأكيد': 'Avg. confirmation hours',
  الفرع: 'Branch',
  التصنيف: 'Category',
  'طول السلسلة': 'Chain length',
  'المبالغ المحصلة': 'Charged amount',
  الكود: 'Code',
  'تاريخ التأكيد': 'Confirmed at',
  'نسبة التكلفة %': 'Cost ratio %',
  التكلفة: 'Cost',
  'الرقم الحالي': 'Current serial',
  'الأيام المتبقية': 'Days remaining',
  المستوى: 'Level',
  التفاصيل: 'Details',
  'عدد الحركات': 'Entries',
  مباشر: 'Direct',
  الاتجاه: 'Direction',
  'نسبة الفترة %': 'Period elapsed %',
  الحدث: 'Event',
  المصروفات: 'Expenses',
  من: 'From',
  الحائز: 'Holder',
  'مخالفات جسيمة': 'High violations',
  'نوع الحائز': 'Holder type',
  'أيام بدون حركة': 'Idle days',
  الإيرادات: 'Income',
  أنشأه: 'Created by',
  الحالة: 'Status',
  'آخر حركة': 'Last movement',
  'تأكيدات متأخرة': 'Late confirmations',
  'جهة الصيانة': 'Maintenance location',
  'مخالفات بسيطة': 'Low violations',
  الماكينات: 'Machines',
  'ماكينات بالعهدة': 'Machines held',
  'ماكينات للصيانة': 'Machines to maintenance',
  'عدد الماكينات': 'Machines',
  'تكلفة الصيانة': 'Maintenance cost',
  'أوامر الصيانة': 'Maintenance orders',
  'مخالفات متوسطة': 'Medium violations',
  التاجر: 'Merchant',
  'تجار مسجلون': 'Merchants registered',
  التجار: 'Merchants',
  الموديل: 'Model',
  المندوب: 'Representative',
  الصافي: 'Net',
  'الاستحقاق القادم': 'Next due date',
  'الرقم الأصلي': 'Original serial',
  النتيجة: 'Result',
  متأخرات: 'Overdue plans',
  'تسليمات معلقة': 'Pending transfers',
  إلى: 'To',
  'نوع الفترة': 'Period type',
  الفترة: 'Period',
  الهاتف: 'Phone',
  المتوقع: 'Projected',
  'تاريخ الشراء': 'Purchase date',
  'سعر الشراء': 'Purchase price',
  'رقم الأمر': 'Order no.',
  'رقم الإذن': 'Receipt no.',
  المرجع: 'Reference',
  سجله: 'Registered by',
  المتبقي: 'Remaining',
  'إجمالي الإصلاح': 'Total repair cost',
  'تكلفة الإصلاح': 'Repair cost',
  'عدد الإصلاحات': 'Repairs',
  العطل: 'Reported fault',
  المسؤول: 'Responsible',
  'جهة التحمل': 'Responsible party',
  'تاريخ العودة': 'Returned at',
  'إجمالي الحركات': 'Total entries',
  'شامل الفروع': 'Rolled-up total',
  التقييم: 'Score',
  'تاريخ الإرسال': 'Sent at',
  'الرقم التسلسلي': 'Serial',
  الماكينة: 'Machine',
  الجسامة: 'Severity',
  'النسبة %': 'Share %',
  المحل: 'Shop',
  منذ: 'Since',
  المنصرف: 'Spent',
  'إجمالي المحصل': 'Total collected',
  'إذن التسليم': 'Transfer receipt',
  'تسليمات مستلمة': 'Transfers received',
  'تسليمات مرتجعة': 'Transfers returned',
  التسليمات: 'Transfers',
  'نوع المخالفة': 'Violation type',
  النوع: 'Type',
  'تحت الضمان': 'Under warranty',
  'نسبة الاستهلاك %': 'Used %',
  'مبالغ المخالفات': 'Violation charges',
  المخالفات: 'Violations',
  'ساعات الانتظار': 'Waiting hours',
  'نهاية الضمان': 'Warranty end',
  'بداية الضمان': 'Warranty start',
};

/**
 * Every enum code a report can put in a text cell, worded for a reader.
 *
 * One flat table rather than one per enum: where two enums share a code (`OPEN`, `REPLACED`,
 * `MERCHANT`) they also share its meaning, and a report cell does not say which enum it came from.
 */
export const VALUE_LABELS: Record<string, Localized> = {
  // Machine status
  IN_COMPANY_WAREHOUSE: { ar: 'في مخزن الشركة', en: 'In company warehouse' },
  IN_BRANCH_WAREHOUSE: { ar: 'في مخزن الفرع', en: 'In branch warehouse' },
  WITH_SUPERVISOR: { ar: 'مع المشرف', en: 'With supervisor' },
  WITH_REPRESENTATIVE: { ar: 'مع المندوب', en: 'With representative' },
  WITH_MERCHANT: { ar: 'مع التاجر', en: 'With merchant' },
  IN_TRANSIT: { ar: 'قيد النقل', en: 'In transit' },
  UNDER_MAINTENANCE: { ar: 'في الصيانة', en: 'Under maintenance' },
  AT_FACTORY: { ar: 'في المصنع', en: 'At factory' },
  AT_SERVICE_CENTER: { ar: 'في مركز الخدمة', en: 'At service center' },
  DECOMMISSIONED: { ar: 'مُكهّنة', en: 'Decommissioned' },
  REPLACED: { ar: 'مستبدلة', en: 'Replaced' },

  // Holder / party types
  FACTORY: { ar: 'المصنع', en: 'Factory' },
  WAREHOUSE: { ar: 'مخزن', en: 'Warehouse' },
  SUPERVISOR: { ar: 'مشرف', en: 'Supervisor' },
  REPRESENTATIVE: { ar: 'مندوب', en: 'Representative' },
  MERCHANT: { ar: 'تاجر', en: 'Merchant' },
  SERVICE_CENTER: { ar: 'مركز خدمة', en: 'Service center' },
  BRANCH: { ar: 'فرع', en: 'Branch' },
  COMPANY: { ar: 'الشركة', en: 'Company' },
  UNASSIGNED: { ar: 'غير مسند', en: 'Unassigned' },

  // Transfer types
  FACTORY_TO_COMPANY: { ar: 'من المصنع إلى الشركة', en: 'Factory to company' },
  COMPANY_TO_BRANCH: { ar: 'من الشركة إلى الفرع', en: 'Company to branch' },
  BRANCH_TO_REPRESENTATIVE: { ar: 'من الفرع إلى المندوب', en: 'Branch to representative' },
  REPRESENTATIVE_TO_MERCHANT: { ar: 'من المندوب إلى التاجر', en: 'Representative to merchant' },
  MERCHANT_TO_REPRESENTATIVE: { ar: 'من التاجر إلى المندوب', en: 'Merchant to representative' },
  REPRESENTATIVE_TO_BRANCH: { ar: 'من المندوب إلى الفرع', en: 'Representative to branch' },
  BRANCH_TO_COMPANY: { ar: 'من الفرع إلى الشركة', en: 'Branch to company' },
  COMPANY_TO_MAINTENANCE: { ar: 'من الشركة إلى الصيانة', en: 'Company to maintenance' },
  MAINTENANCE_TO_COMPANY: { ar: 'من الصيانة إلى الشركة', en: 'Maintenance to company' },
  COMPANY_TO_FACTORY: { ar: 'من الشركة إلى المصنع', en: 'Company to factory' },
  FACTORY_TO_COMPANY_RETURN: { ar: 'مرتجع من المصنع', en: 'Factory return to company' },
  COMPANY_TO_SERVICE_CENTER: { ar: 'من الشركة إلى مركز الخدمة', en: 'Company to service center' },
  SERVICE_CENTER_TO_COMPANY: { ar: 'من مركز الخدمة إلى الشركة', en: 'Service center to company' },
  COMPANY_TO_SCRAP: { ar: 'من الشركة إلى الخردة', en: 'Company to scrap' },

  // Transfer status / direction
  PENDING: { ar: 'معلق', en: 'Pending' },
  CONFIRMED: { ar: 'مؤكد', en: 'Confirmed' },
  REJECTED: { ar: 'مرفوض', en: 'Rejected' },
  CANCELLED: { ar: 'ملغي', en: 'Cancelled' },
  OUT: { ar: 'تسليم', en: 'Out' },
  RETURN: { ar: 'مرتجع', en: 'Return' },

  // Lifecycle events
  TRANSFER: { ar: 'تسليم', en: 'Transfer' },
  MAINTENANCE: { ar: 'صيانة', en: 'Maintenance' },
  VIOLATION: { ar: 'مخالفة', en: 'Violation' },
  REPLACEMENT: { ar: 'استبدال', en: 'Replacement' },
  DECOMMISSION: { ar: 'تكهين', en: 'Decommission' },

  // Violations
  LOW: { ar: 'بسيطة', en: 'Low' },
  MEDIUM: { ar: 'متوسطة', en: 'Medium' },
  HIGH: { ar: 'جسيمة', en: 'High' },
  OPEN: { ar: 'مفتوح', en: 'Open' },
  ACKNOWLEDGED: { ar: 'تم الإقرار', en: 'Acknowledged' },
  WAIVED: { ar: 'تم الإعفاء', en: 'Waived' },
  CHARGED: { ar: 'تم التحصيل', en: 'Charged' },
  CLOSED: { ar: 'مغلق', en: 'Closed' },
  AUTO: { ar: 'تلقائي', en: 'Automatic' },
  MANUAL: { ar: 'يدوي', en: 'Manual' },

  // Maintenance
  IN_PROGRESS: { ar: 'قيد التنفيذ', en: 'In progress' },
  RETURNED: { ar: 'عادت', en: 'Returned' },
  REPAIRED: { ar: 'تم الإصلاح', en: 'Repaired' },
  UNREPAIRABLE: { ar: 'غير قابلة للإصلاح', en: 'Unrepairable' },

  // Merchants
  ACTIVE: { ar: 'نشط', en: 'Active' },
  INACTIVE: { ar: 'غير نشط', en: 'Inactive' },

  // Yes / no
  YES: { ar: 'نعم', en: 'Yes' },
  NO: { ar: 'لا', en: 'No' },

  // Finance
  INCOME: { ar: 'إيرادات', en: 'Income' },
  EXPENSE: { ar: 'مصروفات', en: 'Expense' },

  // Budgets
  OK: { ar: 'ضمن الحد', en: 'On track' },
  WARNING: { ar: 'تحذير', en: 'Warning' },
  EXCEEDED: { ar: 'متجاوزة', en: 'Exceeded' },
  WEEKLY: { ar: 'أسبوعي', en: 'Weekly' },
  MONTHLY: { ar: 'شهري', en: 'Monthly' },
  QUARTERLY: { ar: 'ربع سنوي', en: 'Quarterly' },
  YEARLY: { ar: 'سنوي', en: 'Yearly' },
  CUSTOM: { ar: 'مخصص', en: 'Custom' },
};

/**
 * The columns whose cells are enum codes. Names, serials and free text are never looked up, so a
 * merchant whose shop happens to be called "OPEN" keeps its name.
 */
const CODE_COLUMNS = new Set([
  'status',
  'holderType',
  'type',
  'direction',
  'event',
  'outcome',
  'result',
  'severity',
  'periodType',
  'isActive',
  'underWarranty',
  'autoGenerated',
  'responsibleParty',
  // The custody group is a status code when grouped by status, and a name otherwise.
  'group',
  // A transfer event in the lifecycle carries its transfer type here.
  'detail',
]);

/** Columns rendered as `Name (PARTY_TYPE)`, whose suffix is the code. */
const PARTY_COLUMNS = new Set(['fromParty', 'toParty']);

/** Labels for the keys of `ReportResult.totals`, which the app shows as the KPI row. */
export const TOTAL_LABELS: Record<string, Localized> = {
  machines: { ar: 'الماكينات', en: 'Machines' },
  purchaseValue: { ar: 'قيمة الشراء', en: 'Purchase value' },
  purchasePrice: { ar: 'سعر الشراء', en: 'Purchase price' },
  repairCost: { ar: 'تكلفة الإصلاح', en: 'Repair cost' },
  repairCount: { ar: 'عدد الإصلاحات', en: 'Repairs' },
  holders: { ar: 'الحائزون', en: 'Holders' },
  thresholdDays: { ar: 'حد الأيام', en: 'Threshold (days)' },
  windowDays: { ar: 'نافذة الأيام', en: 'Window (days)' },
  events: { ar: 'الأحداث', en: 'Events' },
  assets: { ar: 'الأصول', en: 'Assets' },
  transfers: { ar: 'التسليمات', en: 'Transfers' },
  confirmed: { ar: 'مؤكدة', en: 'Confirmed' },
  pending: { ar: 'معلقة', en: 'Pending' },
  overdue: { ar: 'متأخرة', en: 'Overdue' },
  representatives: { ar: 'المندوبون', en: 'Representatives' },
  chargedAmount: { ar: 'المبالغ المحصلة', en: 'Charged amount' },
  averageScore: { ar: 'متوسط التقييم', en: 'Average score' },
  violations: { ar: 'المخالفات', en: 'Violations' },
  merchants: { ar: 'التجار', en: 'Merchants' },
  machinesHeld: { ar: 'ماكينات بالعهدة', en: 'Machines held' },
  totalCollected: { ar: 'إجمالي المحصل', en: 'Total collected' },
  overduePlans: { ar: 'متأخرات', en: 'Overdue plans' },
  orders: { ar: 'الأوامر', en: 'Orders' },
  cost: { ar: 'التكلفة', en: 'Cost' },
  underWarranty: { ar: 'تحت الضمان', en: 'Under warranty' },
  income: { ar: 'الإيرادات', en: 'Income' },
  expense: { ar: 'المصروفات', en: 'Expenses' },
  net: { ar: 'الصافي', en: 'Net' },
  marginPercent: { ar: 'هامش الربح %', en: 'Margin %' },
  budgets: { ar: 'الميزانيات', en: 'Budgets' },
  amount: { ar: 'المبلغ', en: 'Amount' },
  spent: { ar: 'المنصرف', en: 'Spent' },
  exceeded: { ar: 'متجاوزة', en: 'Exceeded' },
  branches: { ar: 'الفروع', en: 'Branches' },
  categories: { ar: 'التصنيفات', en: 'Categories' },
  total: { ar: 'الإجمالي', en: 'Total' },
};

export function valueLabel(code: string, locale: Locale): string {
  return VALUE_LABELS[code]?.[locale] ?? code;
}

function localizeCell(key: string, value: ExportCell, locale: Locale): ExportCell {
  if (typeof value !== 'string') return value;
  if (CODE_COLUMNS.has(key)) return valueLabel(value, locale);
  if (PARTY_COLUMNS.has(key)) {
    return value.replace(/\(([A-Z_]+)\)$/, (_, code: string) => `(${valueLabel(code, locale)})`);
  }
  return value;
}

/**
 * Puts a finished report into the reader's language: headers, enum cells, and the labels of its
 * totals. Applied once in the runner, so the screen and every export read the same words.
 */
export function localizeReport(result: ReportResult, locale: Locale): ReportResult {
  return {
    ...result,
    columns: result.columns.map((column) => ({
      ...column,
      header: locale === 'en' ? (HEADERS_EN[column.header] ?? column.header) : column.header,
    })),
    rows: result.rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, localizeCell(key, value, locale)]),
      ),
    ),
    totalLabels: Object.fromEntries(
      Object.keys(result.totals).map((key) => [key, TOTAL_LABELS[key]?.[locale] ?? key]),
    ),
    ...(result.extra ? { extra: localizeExtra(result.extra, locale) } : {}),
  };
}

/** The custody groups name their holder by status code when grouped by status. */
function localizeExtra(extra: Record<string, unknown>, locale: Locale): Record<string, unknown> {
  if (!Array.isArray(extra.groups)) return extra;

  return {
    ...extra,
    groups: (extra.groups as Array<{ holder?: { type?: string; name?: string } }>).map((group) =>
      group.holder
        ? {
            ...group,
            holder: {
              ...group.holder,
              type: group.holder.type && valueLabel(group.holder.type, locale),
              name: group.holder.name && valueLabel(group.holder.name, locale),
            },
          }
        : group,
    ),
  };
}
