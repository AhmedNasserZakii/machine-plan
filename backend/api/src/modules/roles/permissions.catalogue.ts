import { Locale } from 'src/common/constants/locales';
import { SystemRole, SystemRoleCode } from './entities/role.entity';

/**
 * The permission catalogue from `04-auth-and-permissions.md`.
 *
 * This file is the single source of truth: the seeder inserts from it, guards reference the
 * constants, and `GET /permissions` renders its groups as a checkbox tree.
 */
export const Perm = {
  // machines
  MACHINES_READ: 'machines.read',
  MACHINES_READ_ALL: 'machines.read.all',
  MACHINES_CREATE: 'machines.create',
  MACHINES_UPDATE: 'machines.update',
  MACHINES_DELETE: 'machines.delete',
  MACHINES_IMPORT: 'machines.import',
  MACHINES_DECOMMISSION: 'machines.decommission',

  // transfers
  TRANSFERS_READ: 'transfers.read',
  TRANSFERS_READ_ALL: 'transfers.read.all',
  TRANSFERS_CREATE: 'transfers.create',
  TRANSFERS_CONFIRM: 'transfers.confirm',
  TRANSFERS_REJECT: 'transfers.reject',
  TRANSFERS_CANCEL: 'transfers.cancel',

  // merchants
  MERCHANTS_READ: 'merchants.read',
  MERCHANTS_READ_ALL: 'merchants.read.all',
  MERCHANTS_CREATE: 'merchants.create',
  MERCHANTS_UPDATE: 'merchants.update',
  MERCHANTS_DELETE: 'merchants.delete',

  // maintenance
  MAINTENANCE_READ: 'maintenance.read',
  MAINTENANCE_CREATE: 'maintenance.create',
  MAINTENANCE_UPDATE: 'maintenance.update',
  MAINTENANCE_CLOSE: 'maintenance.close',
  MAINTENANCE_SET_COST: 'maintenance.set_cost',

  // violations
  VIOLATIONS_READ: 'violations.read',
  VIOLATIONS_READ_ALL: 'violations.read.all',
  VIOLATIONS_CREATE: 'violations.create',
  VIOLATIONS_RESOLVE: 'violations.resolve',
  VIOLATIONS_WAIVE: 'violations.waive',

  // finance — the Director gates these individually
  FINANCE_READ: 'finance.read',
  FINANCE_READ_ALL: 'finance.read.all',
  FINANCE_CREATE: 'finance.create',
  FINANCE_UPDATE: 'finance.update',
  FINANCE_VOID: 'finance.void',
  FINANCE_CATEGORIES_MANAGE: 'finance.categories.manage',
  FINANCE_BUDGETS_MANAGE: 'finance.budgets.manage',

  // reports
  REPORTS_MACHINES: 'reports.machines',
  REPORTS_TRANSFERS: 'reports.transfers',
  REPORTS_VIOLATIONS: 'reports.violations',
  REPORTS_FINANCE: 'reports.finance',
  REPORTS_EXPORT: 'reports.export',

  // admin
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DEACTIVATE: 'users.deactivate',
  ROLES_MANAGE: 'roles.manage',
  BRANCHES_MANAGE: 'branches.manage',
  AUDIT_READ: 'audit.read',
  SETTINGS_MANAGE: 'settings.manage',
} as const;

export type PermissionCode = (typeof Perm)[keyof typeof Perm];

export interface PermissionDefinition {
  code: PermissionCode;
  group: string;
  sortOrder: number;
  translations: Record<Locale, { displayName: string; description?: string }>;
}

const define = (
  code: PermissionCode,
  group: string,
  ar: string,
  en: string,
): Omit<PermissionDefinition, 'sortOrder'> => ({
  code,
  group,
  translations: { ar: { displayName: ar }, en: { displayName: en } },
});

const DEFINITIONS: Omit<PermissionDefinition, 'sortOrder'>[] = [
  define(Perm.MACHINES_READ, 'machines', 'عرض الماكينات', 'View machines'),
  define(
    Perm.MACHINES_READ_ALL,
    'machines',
    'عرض ماكينات كل الفروع',
    'View machines in all branches',
  ),
  define(Perm.MACHINES_CREATE, 'machines', 'إضافة ماكينة', 'Create machines'),
  define(Perm.MACHINES_UPDATE, 'machines', 'تعديل ماكينة', 'Update machines'),
  define(Perm.MACHINES_DELETE, 'machines', 'حذف ماكينة', 'Delete machines'),
  define(Perm.MACHINES_IMPORT, 'machines', 'استيراد دفعة من المصنع', 'Bulk factory intake'),
  define(Perm.MACHINES_DECOMMISSION, 'machines', 'إخراج ماكينة من الخدمة', 'Decommission machines'),

  define(Perm.TRANSFERS_READ, 'transfers', 'عرض عمليات التسليم', 'View transfers'),
  define(
    Perm.TRANSFERS_READ_ALL,
    'transfers',
    'عرض تسليمات كل الفروع',
    'View transfers in all branches',
  ),
  define(Perm.TRANSFERS_CREATE, 'transfers', 'إنشاء عملية تسليم', 'Create transfers'),
  define(Perm.TRANSFERS_CONFIRM, 'transfers', 'تأكيد الاستلام', 'Confirm transfers'),
  define(Perm.TRANSFERS_REJECT, 'transfers', 'رفض الاستلام', 'Reject transfers'),
  define(Perm.TRANSFERS_CANCEL, 'transfers', 'إلغاء عملية تسليم', 'Cancel transfers'),

  define(Perm.MERCHANTS_READ, 'merchants', 'عرض التجار', 'View merchants'),
  define(
    Perm.MERCHANTS_READ_ALL,
    'merchants',
    'عرض تجار كل الفروع',
    'View merchants in all branches',
  ),
  define(Perm.MERCHANTS_CREATE, 'merchants', 'إضافة تاجر', 'Create merchants'),
  define(Perm.MERCHANTS_UPDATE, 'merchants', 'تعديل تاجر', 'Update merchants'),
  define(Perm.MERCHANTS_DELETE, 'merchants', 'حذف تاجر', 'Delete merchants'),

  define(Perm.MAINTENANCE_READ, 'maintenance', 'عرض أوامر الصيانة', 'View maintenance orders'),
  define(Perm.MAINTENANCE_CREATE, 'maintenance', 'إنشاء أمر صيانة', 'Create maintenance orders'),
  define(Perm.MAINTENANCE_UPDATE, 'maintenance', 'تعديل أمر صيانة', 'Update maintenance orders'),
  define(Perm.MAINTENANCE_CLOSE, 'maintenance', 'إغلاق أمر صيانة', 'Close maintenance orders'),
  define(Perm.MAINTENANCE_SET_COST, 'maintenance', 'تحديد تكلفة الصيانة', 'Set maintenance cost'),

  define(Perm.VIOLATIONS_READ, 'violations', 'عرض المخالفات', 'View violations'),
  define(
    Perm.VIOLATIONS_READ_ALL,
    'violations',
    'عرض مخالفات كل الفروع',
    'View violations in all branches',
  ),
  define(Perm.VIOLATIONS_CREATE, 'violations', 'تسجيل مخالفة', 'Create violations'),
  define(Perm.VIOLATIONS_RESOLVE, 'violations', 'إنهاء مخالفة', 'Resolve violations'),
  define(Perm.VIOLATIONS_WAIVE, 'violations', 'إعفاء من مخالفة', 'Waive violations'),

  define(Perm.FINANCE_READ, 'finance', 'عرض الحركات المالية', 'View finance transactions'),
  define(Perm.FINANCE_READ_ALL, 'finance', 'عرض مالية كل الفروع', 'View finance in all branches'),
  define(Perm.FINANCE_CREATE, 'finance', 'تسجيل حركة مالية', 'Create finance transactions'),
  define(Perm.FINANCE_UPDATE, 'finance', 'تعديل حركة مالية', 'Update finance transactions'),
  define(Perm.FINANCE_VOID, 'finance', 'إلغاء حركة مالية', 'Void finance transactions'),
  define(
    Perm.FINANCE_CATEGORIES_MANAGE,
    'finance',
    'إدارة تصنيفات المالية',
    'Manage finance categories',
  ),
  define(Perm.FINANCE_BUDGETS_MANAGE, 'finance', 'إدارة الميزانيات', 'Manage budgets'),

  define(Perm.REPORTS_MACHINES, 'reports', 'تقارير الماكينات', 'Machine reports'),
  define(Perm.REPORTS_TRANSFERS, 'reports', 'تقارير التسليم', 'Transfer reports'),
  define(Perm.REPORTS_VIOLATIONS, 'reports', 'تقارير المخالفات', 'Violation reports'),
  define(Perm.REPORTS_FINANCE, 'reports', 'التقارير المالية', 'Finance reports'),
  define(Perm.REPORTS_EXPORT, 'reports', 'تصدير التقارير', 'Export reports'),

  define(Perm.USERS_READ, 'admin', 'عرض المستخدمين', 'View users'),
  define(Perm.USERS_CREATE, 'admin', 'إضافة مستخدم', 'Create users'),
  define(Perm.USERS_UPDATE, 'admin', 'تعديل مستخدم', 'Update users'),
  define(Perm.USERS_DEACTIVATE, 'admin', 'إيقاف/تنشيط مستخدم', 'Activate or deactivate users'),
  define(Perm.ROLES_MANAGE, 'admin', 'إدارة الأدوار والصلاحيات', 'Manage roles and permissions'),
  define(Perm.BRANCHES_MANAGE, 'admin', 'إدارة الفروع والمخازن', 'Manage branches and warehouses'),
  define(Perm.AUDIT_READ, 'admin', 'عرض سجل العمليات', 'View the audit log'),
  define(Perm.SETTINGS_MANAGE, 'admin', 'إدارة إعدادات النظام', 'Manage system settings'),
];

export const PERMISSION_CATALOGUE: readonly PermissionDefinition[] = DEFINITIONS.map(
  (definition, index) => ({ ...definition, sortOrder: (index + 1) * 10 }),
);

export const ALL_PERMISSION_CODES: readonly PermissionCode[] = PERMISSION_CATALOGUE.map(
  (permission) => permission.code,
);

/** Display order of groups in the app's permission tree. */
export const PERMISSION_GROUP_ORDER: readonly string[] = [
  'machines',
  'transfers',
  'merchants',
  'maintenance',
  'violations',
  'finance',
  'reports',
  'admin',
];

export const PERMISSION_GROUP_LABELS: Record<string, Record<Locale, string>> = {
  machines: { ar: 'الماكينات', en: 'Machines' },
  transfers: { ar: 'عمليات التسليم', en: 'Transfers' },
  merchants: { ar: 'التجار', en: 'Merchants' },
  maintenance: { ar: 'الصيانة', en: 'Maintenance' },
  violations: { ar: 'المخالفات', en: 'Violations' },
  finance: { ar: 'المالية', en: 'Finance' },
  reports: { ar: 'التقارير', en: 'Reports' },
  admin: { ar: 'الإدارة', en: 'Administration' },
};

export interface RoleDefinition {
  code: SystemRoleCode;
  translations: Record<Locale, { displayName: string; description: string }>;
  permissions: readonly PermissionCode[];
}

/**
 * Default role → permission mapping.
 *
 * Note that **no role gets finance permissions except `ACCOUNTANT` and `DIRECTOR`** — not even
 * `VIEWER`, whose "read everything" is deliberately scoped to operations. Anyone else who
 * needs finance access gets a `user_permission_overrides` row with effect `ALLOW`.
 */
export const ROLE_CATALOGUE: readonly RoleDefinition[] = [
  {
    code: SystemRole.DIRECTOR,
    translations: {
      ar: { displayName: 'المدير', description: 'صلاحيات كاملة على النظام' },
      en: { displayName: 'Director', description: 'Full access to the entire system' },
    },
    permissions: ALL_PERMISSION_CODES,
  },
  {
    code: SystemRole.BRANCH_SUPERVISOR,
    translations: {
      ar: { displayName: 'مشرف فرع', description: 'إدارة ماكينات وتسليمات الفرع' },
      en: {
        displayName: 'Branch supervisor',
        description: 'Manages the machines and hand-offs of one branch',
      },
    },
    permissions: [
      Perm.MACHINES_READ,
      Perm.MACHINES_UPDATE,
      Perm.TRANSFERS_READ,
      Perm.TRANSFERS_CREATE,
      Perm.TRANSFERS_CONFIRM,
      Perm.TRANSFERS_REJECT,
      Perm.TRANSFERS_CANCEL,
      Perm.MERCHANTS_READ,
      Perm.MAINTENANCE_READ,
      Perm.MAINTENANCE_CREATE,
      Perm.VIOLATIONS_READ,
      Perm.VIOLATIONS_CREATE,
      Perm.REPORTS_MACHINES,
      Perm.REPORTS_TRANSFERS,
      Perm.REPORTS_VIOLATIONS,
      Perm.USERS_READ,
    ],
  },
  {
    code: SystemRole.REPRESENTATIVE,
    translations: {
      ar: { displayName: 'مندوب', description: 'تسليم واستلام الماكينات من التجار' },
      en: {
        displayName: 'Representative',
        description: 'Hands machines out to merchants and takes them back',
      },
    },
    permissions: [
      Perm.MACHINES_READ,
      Perm.TRANSFERS_READ,
      Perm.TRANSFERS_CREATE,
      Perm.TRANSFERS_CONFIRM,
      Perm.MERCHANTS_READ,
      Perm.MERCHANTS_CREATE,
      Perm.MERCHANTS_UPDATE,
      Perm.VIOLATIONS_READ,
    ],
  },
  {
    code: SystemRole.ACCOUNTANT,
    translations: {
      ar: { displayName: 'محاسب', description: 'إدارة مصروفات وإيرادات الشركة' },
      en: { displayName: 'Accountant', description: 'Manages company income and expenses' },
    },
    permissions: [
      Perm.FINANCE_READ,
      Perm.FINANCE_READ_ALL,
      Perm.FINANCE_CREATE,
      Perm.FINANCE_UPDATE,
      Perm.FINANCE_VOID,
      Perm.FINANCE_CATEGORIES_MANAGE,
      Perm.FINANCE_BUDGETS_MANAGE,
      Perm.REPORTS_FINANCE,
      Perm.REPORTS_EXPORT,
      Perm.MACHINES_READ,
    ],
  },
  {
    code: SystemRole.VIEWER,
    translations: {
      ar: { displayName: 'مشاهد', description: 'عرض البيانات التشغيلية دون تعديل' },
      en: { displayName: 'Viewer', description: 'Read-only access to operational data' },
    },
    // The `.all` variants are what make this role company-wide. A viewer belongs to no branch,
    // so without them every branch-scoped endpoint would refuse the request outright — there
    // would be no branch to narrow to — and "read-only access to operational data" would mean
    // access to nothing. Finance is deliberately excluded, per the note above.
    permissions: [
      Perm.MACHINES_READ,
      Perm.MACHINES_READ_ALL,
      Perm.TRANSFERS_READ,
      Perm.TRANSFERS_READ_ALL,
      Perm.MERCHANTS_READ,
      Perm.MERCHANTS_READ_ALL,
      Perm.MAINTENANCE_READ,
      Perm.VIOLATIONS_READ,
      Perm.VIOLATIONS_READ_ALL,
      Perm.USERS_READ,
    ],
  },
];
