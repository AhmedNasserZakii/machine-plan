import { Severity } from 'src/common/enums/operations.enum';
import { Locale } from 'src/common/constants/locales';

export interface SeedTranslation {
  name: string;
  description?: string;
}

export interface SeedLookup {
  code: string;
  sortOrder: number;
  translations: Record<Locale, SeedTranslation>;
}

export interface SeedViolationType extends SeedLookup {
  defaultSeverity: Severity;
}

export interface SeedMachineModel extends SeedLookup {
  machineTypeCode: string;
  manufacturer?: string;
}

export interface SeedMachineType extends SeedLookup {
  /** Whether machines of this type carry a SIM card — false only for a PIN pad. */
  requiresSim: boolean;
}

/**
 * The reference data seeded in both locales, per `02-database-localization-strategy.md`.
 * Codes are the contract with the rest of the system and must not be renamed once shipped —
 * the display names in here are safe to change at any time.
 */
export const MACHINE_TYPES: SeedMachineType[] = [
  {
    code: 'POS_TERMINAL',
    sortOrder: 10,
    requiresSim: true,
    translations: {
      ar: { name: 'ماكينة نقاط بيع' },
      en: { name: 'POS Terminal' },
    },
  },
  {
    code: 'MOBILE_POS',
    sortOrder: 20,
    requiresSim: true,
    translations: {
      ar: { name: 'ماكينة نقاط بيع محمولة' },
      en: { name: 'Mobile POS' },
    },
  },
  {
    code: 'SMART_POS',
    sortOrder: 30,
    requiresSim: true,
    translations: {
      ar: { name: 'ماكينة نقاط بيع ذكية' },
      en: { name: 'Smart POS' },
    },
  },
  {
    code: 'PIN_PAD',
    // A PIN pad is tethered to a terminal, so it has no mobile line of its own.
    sortOrder: 40,
    requiresSim: false,
    translations: {
      ar: { name: 'لوحة إدخال الرقم السري' },
      en: { name: 'PIN Pad' },
    },
  },
];

export const MACHINE_MODELS: SeedMachineModel[] = [
  {
    code: 'INGENICO_MOVE_5000',
    machineTypeCode: 'MOBILE_POS',
    manufacturer: 'Ingenico',
    sortOrder: 10,
    translations: {
      ar: { name: 'إنجينيكو موف 5000', description: 'ماكينة محمولة تدعم الشرائح واللاسلكي' },
      en: { name: 'Ingenico Move 5000', description: 'Portable terminal with SIM and Wi-Fi' },
    },
  },
  {
    code: 'INGENICO_DESK_5000',
    machineTypeCode: 'POS_TERMINAL',
    manufacturer: 'Ingenico',
    sortOrder: 20,
    translations: {
      ar: { name: 'إنجينيكو ديسك 5000', description: 'ماكينة ثابتة للكاونتر' },
      en: { name: 'Ingenico Desk 5000', description: 'Countertop terminal' },
    },
  },
  {
    code: 'PAX_A920',
    machineTypeCode: 'SMART_POS',
    manufacturer: 'PAX',
    sortOrder: 30,
    translations: {
      ar: { name: 'باكس A920', description: 'ماكينة ذكية بشاشة لمس تعمل بأندرويد' },
      en: { name: 'PAX A920', description: 'Android smart terminal with touchscreen' },
    },
  },
  {
    code: 'VERIFONE_X990',
    machineTypeCode: 'SMART_POS',
    manufacturer: 'Verifone',
    sortOrder: 40,
    translations: {
      ar: { name: 'فيريفون X990' },
      en: { name: 'Verifone X990' },
    },
  },
];

export const PAYMENT_METHODS: SeedLookup[] = [
  {
    code: 'CASH',
    sortOrder: 10,
    translations: { ar: { name: 'نقدي' }, en: { name: 'Cash' } },
  },
  {
    code: 'BANK_TRANSFER',
    sortOrder: 20,
    translations: { ar: { name: 'تحويل بنكي' }, en: { name: 'Bank transfer' } },
  },
  {
    code: 'INSTAPAY',
    sortOrder: 30,
    translations: { ar: { name: 'إنستاباي' }, en: { name: 'InstaPay' } },
  },
  {
    code: 'WALLET',
    sortOrder: 40,
    translations: { ar: { name: 'محفظة إلكترونية' }, en: { name: 'Mobile wallet' } },
  },
  {
    code: 'CHEQUE',
    sortOrder: 50,
    translations: { ar: { name: 'شيك' }, en: { name: 'Cheque' } },
  },
  {
    code: 'CARD',
    sortOrder: 60,
    translations: { ar: { name: 'بطاقة' }, en: { name: 'Card' } },
  },
];

export const VIOLATION_TYPES: SeedViolationType[] = [
  {
    code: 'BATTERY_MISMATCH',
    defaultSeverity: Severity.HIGH,
    sortOrder: 10,
    translations: {
      ar: {
        name: 'بطارية غير مطابقة',
        description: 'رقم البطارية المستلمة لا يطابق البطارية المرتبطة بالماكينة',
      },
      en: {
        name: 'Battery mismatch',
        description: 'The returned battery serial does not match the one bonded to the machine',
      },
    },
  },
  {
    code: 'MISSING_CHARGER',
    defaultSeverity: Severity.LOW,
    sortOrder: 20,
    translations: {
      ar: { name: 'شاحن مفقود', description: 'الماكينة أُعيدت بدون الشاحن' },
      en: { name: 'Missing charger', description: 'The machine was returned without its charger' },
    },
  },
  {
    code: 'MISSING_BOX',
    defaultSeverity: Severity.LOW,
    sortOrder: 30,
    translations: {
      ar: { name: 'علبة مفقودة', description: 'الماكينة أُعيدت بدون العلبة الأصلية' },
      en: { name: 'Missing box', description: 'The machine was returned without its original box' },
    },
  },
  {
    code: 'PHYSICAL_DAMAGE',
    defaultSeverity: Severity.HIGH,
    sortOrder: 40,
    translations: {
      ar: { name: 'تلف مادي', description: 'تلف ظاهر في جسم الماكينة أو الشاشة' },
      en: { name: 'Physical damage', description: 'Visible damage to the body or screen' },
    },
  },
  {
    code: 'LATE_RETURN',
    defaultSeverity: Severity.MEDIUM,
    sortOrder: 50,
    translations: {
      ar: { name: 'تأخير في الإرجاع', description: 'تجاوز المندوب المدة المسموحة للاحتفاظ' },
      en: { name: 'Late return', description: 'Held beyond the permitted custody period' },
    },
  },
  {
    code: 'MISSING_MACHINE',
    defaultSeverity: Severity.HIGH,
    sortOrder: 60,
    translations: {
      ar: { name: 'ماكينة مفقودة', description: 'الماكينة غير موجودة ولم يتم تسليمها' },
      en: { name: 'Missing machine', description: 'The machine cannot be accounted for' },
    },
  },
  {
    code: 'OTHER',
    defaultSeverity: Severity.MEDIUM,
    sortOrder: 999,
    translations: {
      ar: { name: 'أخرى', description: 'مخالفة أخرى توضح في الوصف' },
      en: { name: 'Other', description: 'Any other violation, explained in the description' },
    },
  },
];

export const MAINTENANCE_LOCATIONS: SeedLookup[] = [
  {
    code: 'INTERNAL_WORKSHOP',
    sortOrder: 10,
    translations: { ar: { name: 'الورشة الداخلية' }, en: { name: 'Internal workshop' } },
  },
  {
    code: 'FACTORY',
    sortOrder: 20,
    translations: { ar: { name: 'المصنع' }, en: { name: 'Factory' } },
  },
  {
    code: 'SERVICE_CENTER',
    sortOrder: 30,
    translations: { ar: { name: 'مركز خدمة معتمد' }, en: { name: 'Service centre' } },
  },
];

export const DECOMMISSION_REASONS: SeedLookup[] = [
  {
    code: 'BEYOND_REPAIR',
    sortOrder: 10,
    translations: { ar: { name: 'غير قابلة للإصلاح' }, en: { name: 'Beyond repair' } },
  },
  {
    code: 'NOT_COST_EFFECTIVE',
    sortOrder: 20,
    translations: {
      ar: { name: 'الإصلاح غير مجدٍ اقتصاديًا' },
      en: { name: 'Not cost effective to repair' },
    },
  },
  {
    code: 'OBSOLETE',
    sortOrder: 30,
    translations: { ar: { name: 'موديل قديم' }, en: { name: 'Obsolete' } },
  },
  {
    code: 'LOST',
    sortOrder: 40,
    translations: { ar: { name: 'مفقودة' }, en: { name: 'Lost' } },
  },
  {
    code: 'STOLEN',
    sortOrder: 50,
    translations: { ar: { name: 'مسروقة' }, en: { name: 'Stolen' } },
  },
  {
    code: 'OTHER',
    sortOrder: 999,
    translations: { ar: { name: 'أخرى' }, en: { name: 'Other' } },
  },
];

/** The two singleton warehouses the transfer rules assume exist. */
export const COMPANY_WAREHOUSES = [
  { type: 'COMPANY_MAIN', name: 'مخزن الشركة الرئيسي' },
  { type: 'SCRAP', name: 'مخزن التوالف' },
] as const;
