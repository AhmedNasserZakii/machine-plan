import { Locale } from 'src/common/constants/locales';
import {
  NotificationEntityType,
  NotificationTemplateCode,
} from 'src/common/enums/notification.enum';
import { NotificationChannel } from 'src/common/enums/operations.enum';

export interface TemplateWording {
  title: string;
  body: string;
}

export interface NotificationTemplateDefinition {
  code: NotificationTemplateCode;
  entityType: NotificationEntityType | null;
  defaultChannels: readonly NotificationChannel[];
  /** In-app cannot be switched off — the event is operationally critical (`18`, Preferences). */
  inAppLocked?: boolean;
  ignoresQuietHours?: boolean;
  deepLinkTemplate: string | null;
  /**
   * Every `{token}` the body may use. Declared so the renderer can refuse a template rendered
   * with a missing placeholder instead of shipping `{spent}` to somebody's phone.
   */
  placeholders: readonly string[];
  translations: Record<Locale, TemplateWording>;
}

const BOTH: readonly NotificationChannel[] = [NotificationChannel.PUSH, NotificationChannel.IN_APP];

/**
 * The event catalogue of `18-feature-notifications.md`, in both locales.
 *
 * This file is the source the seeder inserts from; the dispatcher reads the wording back out of
 * `notification_templates` so an operator retitling an event does not need a release. What it may
 * not change is the set of codes — those are compiled into the trigger sites.
 */
export const NOTIFICATION_TEMPLATES: readonly NotificationTemplateDefinition[] = [
  {
    code: NotificationTemplateCode.TRANSFER_PENDING,
    entityType: NotificationEntityType.TRANSFER,
    defaultChannels: BOTH,
    // A representative who muted this would never learn a delivery is waiting for his signature,
    // and the machines would sit IN_TRANSIT until somebody phoned him.
    inAppLocked: true,
    deepLinkTemplate: 'machinery://transfers/{entityId}',
    placeholders: ['referenceNo', 'senderName', 'machineCount'],
    translations: {
      ar: {
        title: 'تسليم في انتظار توقيعك',
        body: 'أرسل {senderName} إليك {machineCount} ماكينة — إيصال {referenceNo}',
      },
      en: {
        title: 'A hand-off is waiting for your signature',
        body: '{senderName} sent you {machineCount} machine(s) — receipt {referenceNo}',
      },
    },
  },
  {
    code: NotificationTemplateCode.TRANSFER_CONFIRMED,
    entityType: NotificationEntityType.TRANSFER,
    defaultChannels: BOTH,
    deepLinkTemplate: 'machinery://transfers/{entityId}',
    placeholders: ['referenceNo', 'receiverName', 'machineCount'],
    translations: {
      ar: {
        title: 'تم تأكيد التسليم',
        body: 'استلم {receiverName} {machineCount} ماكينة ووقّع على إيصال {referenceNo}',
      },
      en: {
        title: 'Hand-off confirmed',
        body: '{receiverName} signed for {machineCount} machine(s) on receipt {referenceNo}',
      },
    },
  },
  {
    code: NotificationTemplateCode.TRANSFER_REJECTED,
    entityType: NotificationEntityType.TRANSFER,
    defaultChannels: BOTH,
    deepLinkTemplate: 'machinery://transfers/{entityId}',
    placeholders: ['referenceNo', 'receiverName', 'reason'],
    translations: {
      ar: {
        title: 'تم رفض التسليم',
        body: 'رفض {receiverName} إيصال {referenceNo} — السبب: {reason}',
      },
      en: {
        title: 'Hand-off rejected',
        body: '{receiverName} rejected receipt {referenceNo} — reason: {reason}',
      },
    },
  },
  {
    code: NotificationTemplateCode.TRANSFER_REMINDER,
    entityType: NotificationEntityType.TRANSFER,
    defaultChannels: BOTH,
    deepLinkTemplate: 'machinery://transfers/{entityId}',
    placeholders: ['referenceNo', 'hours', 'machineCount'],
    translations: {
      ar: {
        title: 'تذكير بتسليم لم يُوقّع',
        body: 'إيصال {referenceNo} في انتظار توقيعك منذ {hours} ساعة',
      },
      en: {
        title: 'Reminder: an unsigned hand-off',
        body: 'Receipt {referenceNo} has been waiting for your signature for {hours} hours',
      },
    },
  },
  {
    code: NotificationTemplateCode.TRANSFER_STUCK,
    entityType: NotificationEntityType.TRANSFER,
    defaultChannels: BOTH,
    // Machines have been in limbo for three days; waiting until 08:00 is not a service.
    ignoresQuietHours: true,
    deepLinkTemplate: 'machinery://transfers/{entityId}',
    placeholders: ['referenceNo', 'hours', 'receiverName'],
    translations: {
      ar: {
        title: 'تسليم متعطل',
        body: 'إيصال {referenceNo} لدى {receiverName} بدون توقيع منذ {hours} ساعة',
      },
      en: {
        title: 'A hand-off is stuck',
        body: 'Receipt {referenceNo} has been unsigned with {receiverName} for {hours} hours',
      },
    },
  },
  {
    code: NotificationTemplateCode.VIOLATION_CREATED,
    entityType: NotificationEntityType.VIOLATION,
    defaultChannels: BOTH,
    deepLinkTemplate: 'machinery://violations/{entityId}',
    placeholders: ['violationType', 'machineSerial', 'severity'],
    translations: {
      ar: {
        title: 'مخالفة جديدة',
        body: 'تم تسجيل مخالفة {violationType} على الماكينة {machineSerial} — الدرجة {severity}',
      },
      en: {
        title: 'A violation was filed',
        body: 'A {violationType} violation was filed on machine {machineSerial} — severity {severity}',
      },
    },
  },
  {
    code: NotificationTemplateCode.VIOLATION_CHARGED,
    entityType: NotificationEntityType.VIOLATION,
    defaultChannels: BOTH,
    deepLinkTemplate: 'machinery://violations/{entityId}',
    placeholders: ['violationType', 'amount'],
    translations: {
      ar: {
        title: 'تم تحصيل مخالفة',
        body: 'تم تحديد مبلغ {amount} جنيه على مخالفة {violationType}',
      },
      en: {
        title: 'A violation was charged',
        body: 'An amount of EGP {amount} was assigned to your {violationType} violation',
      },
    },
  },
  {
    code: NotificationTemplateCode.MAINTENANCE_OPENED,
    entityType: NotificationEntityType.MAINTENANCE_ORDER,
    defaultChannels: BOTH,
    deepLinkTemplate: 'machinery://maintenance/{entityId}',
    placeholders: ['referenceNo', 'machineSerial', 'locationName'],
    translations: {
      ar: {
        title: 'أمر صيانة جديد',
        body: 'الماكينة {machineSerial} في {locationName} — أمر {referenceNo}',
      },
      en: {
        title: 'A maintenance order was opened',
        body: 'Machine {machineSerial} went to {locationName} — order {referenceNo}',
      },
    },
  },
  {
    code: NotificationTemplateCode.MAINTENANCE_RETURNED,
    entityType: NotificationEntityType.MAINTENANCE_ORDER,
    defaultChannels: BOTH,
    deepLinkTemplate: 'machinery://maintenance/{entityId}',
    placeholders: ['referenceNo', 'machineSerial'],
    translations: {
      ar: {
        title: 'عودة ماكينة من الصيانة',
        body: 'عادت الماكينة {machineSerial} من الصيانة — أمر {referenceNo}',
      },
      en: {
        title: 'A machine came back from maintenance',
        body: 'Machine {machineSerial} is back from maintenance — order {referenceNo}',
      },
    },
  },
  {
    code: NotificationTemplateCode.MACHINE_REPLACED,
    entityType: NotificationEntityType.MACHINE,
    defaultChannels: BOTH,
    deepLinkTemplate: 'machinery://machines/{entityId}',
    placeholders: ['oldSerial', 'newSerial'],
    translations: {
      ar: {
        title: 'استبدال ماكينة من المصنع',
        body: 'تم استبدال الماكينة {oldSerial} بالماكينة {newSerial}',
      },
      en: {
        title: 'A machine was replaced at the factory',
        body: 'Machine {oldSerial} was replaced by machine {newSerial}',
      },
    },
  },
  {
    code: NotificationTemplateCode.WARRANTY_EXPIRING,
    entityType: NotificationEntityType.MACHINE,
    defaultChannels: BOTH,
    deepLinkTemplate: 'machinery://machines/{entityId}',
    placeholders: ['machineSerial', 'days', 'warrantyEnd'],
    translations: {
      ar: {
        title: 'ضمان على وشك الانتهاء',
        body: 'ينتهي ضمان الماكينة {machineSerial} بعد {days} يوم — بتاريخ {warrantyEnd}',
      },
      en: {
        title: 'A warranty is about to lapse',
        body: 'The warranty on machine {machineSerial} ends in {days} days — on {warrantyEnd}',
      },
    },
  },
  {
    code: NotificationTemplateCode.WARRANTY_EXPIRED,
    entityType: NotificationEntityType.MACHINE,
    defaultChannels: BOTH,
    deepLinkTemplate: 'machinery://machines/{entityId}',
    placeholders: ['machineSerial', 'warrantyEnd'],
    translations: {
      ar: {
        title: 'انتهى الضمان',
        body: 'انتهى ضمان الماكينة {machineSerial} بتاريخ {warrantyEnd}',
      },
      en: {
        title: 'A warranty has expired',
        body: 'The warranty on machine {machineSerial} expired on {warrantyEnd}',
      },
    },
  },
  {
    code: NotificationTemplateCode.BUDGET_WARNING,
    entityType: NotificationEntityType.BUDGET,
    defaultChannels: BOTH,
    deepLinkTemplate: 'machinery://finance/budgets/{entityId}',
    placeholders: ['categoryName', 'periodLabel', 'spent', 'amount', 'usedPercent'],
    translations: {
      ar: {
        title: 'اقتراب من حد الميزانية',
        body: 'قسم {categoryName} وصل إلى {usedPercent}% من ميزانية {periodLabel} — صرف {spent} من {amount}',
      },
      en: {
        title: 'A budget is close to its limit',
        body: '{categoryName} reached {usedPercent}% of the {periodLabel} budget — {spent} of {amount} spent',
      },
    },
  },
  {
    code: NotificationTemplateCode.BUDGET_EXCEEDED,
    entityType: NotificationEntityType.BUDGET,
    defaultChannels: BOTH,
    // `18`, delivery rule 2 names this one explicitly: money already spent does not wait.
    ignoresQuietHours: true,
    deepLinkTemplate: 'machinery://finance/budgets/{entityId}',
    placeholders: ['categoryName', 'periodLabel', 'spent', 'amount'],
    translations: {
      ar: {
        title: 'تعدي الميزانية',
        body: 'قسم {categoryName} تعدى ميزانية {periodLabel} — صرف {spent} من {amount}',
      },
      en: {
        title: 'Budget exceeded',
        body: '{categoryName} exceeded the {periodLabel} budget — {spent} of {amount} spent',
      },
    },
  },
  {
    code: NotificationTemplateCode.SUBSCRIPTION_DUE,
    entityType: NotificationEntityType.SUBSCRIPTION,
    defaultChannels: BOTH,
    deepLinkTemplate: 'machinery://subscriptions/{entityId}',
    placeholders: ['merchantName', 'amount', 'dueDate'],
    translations: {
      ar: {
        title: 'اشتراك مستحق',
        body: 'اشتراك {merchantName} بمبلغ {amount} مستحق بتاريخ {dueDate}',
      },
      en: {
        title: 'A subscription is due',
        body: "{merchantName}'s subscription of {amount} is due on {dueDate}",
      },
    },
  },
  {
    code: NotificationTemplateCode.SUBSCRIPTION_OVERDUE,
    entityType: NotificationEntityType.SUBSCRIPTION,
    defaultChannels: BOTH,
    deepLinkTemplate: 'machinery://subscriptions/{entityId}',
    placeholders: ['merchantName', 'amount', 'dueDate', 'days'],
    translations: {
      ar: {
        title: 'اشتراك متأخر',
        body: 'اشتراك {merchantName} بمبلغ {amount} متأخر {days} يوم عن {dueDate}',
      },
      en: {
        title: 'A subscription is overdue',
        body: "{merchantName}'s subscription of {amount} is {days} days past {dueDate}",
      },
    },
  },
  {
    code: NotificationTemplateCode.MACHINE_IDLE,
    entityType: NotificationEntityType.MACHINE,
    defaultChannels: BOTH,
    deepLinkTemplate: 'machinery://machines/{entityId}',
    placeholders: ['machineSerial', 'days', 'holderName'],
    translations: {
      ar: {
        title: 'ماكينة بدون حركة',
        body: 'الماكينة {machineSerial} لدى {holderName} بدون حركة منذ {days} يوم',
      },
      en: {
        title: 'A machine has not moved',
        body: 'Machine {machineSerial} has been with {holderName} for {days} days without movement',
      },
    },
  },
  {
    code: NotificationTemplateCode.DECOMMISSION_CANDIDATE,
    entityType: NotificationEntityType.MACHINE,
    defaultChannels: BOTH,
    deepLinkTemplate: 'machinery://machines/{entityId}',
    placeholders: ['machineSerial', 'repairCost', 'purchasePrice', 'ratio'],
    translations: {
      ar: {
        title: 'ماكينة مرشحة للإخراج من الخدمة',
        body: 'تكلفة إصلاح الماكينة {machineSerial} بلغت {repairCost} من سعر شراء {purchasePrice} — نسبة {ratio}%',
      },
      en: {
        title: 'A machine is a decommission candidate',
        body: 'Repairs on machine {machineSerial} reached {repairCost} against a purchase price of {purchasePrice} — {ratio}%',
      },
    },
  },
  {
    code: NotificationTemplateCode.MACHINE_DECOMMISSIONED,
    entityType: NotificationEntityType.MACHINE,
    defaultChannels: BOTH,
    deepLinkTemplate: 'machinery://machines/{entityId}',
    placeholders: ['machineSerial', 'reason', 'repairCost'],
    translations: {
      ar: {
        title: 'تم إخراج ماكينة من الخدمة',
        body: 'خرجت الماكينة {machineSerial} من الخدمة — {reason}، بعد إصلاحات بقيمة {repairCost}',
      },
      en: {
        title: 'A machine was decommissioned',
        body: 'Machine {machineSerial} left service — {reason}, after {repairCost} of repairs',
      },
    },
  },
  {
    code: NotificationTemplateCode.DIGEST,
    entityType: null,
    defaultChannels: [NotificationChannel.PUSH],
    deepLinkTemplate: null,
    placeholders: ['count', 'subject'],
    translations: {
      ar: { title: 'تحديثات جديدة', body: '{count} {subject} في انتظارك' },
      en: { title: 'New updates', body: '{count} {subject} waiting for you' },
    },
  },
];

const BY_CODE = new Map<NotificationTemplateCode, NotificationTemplateDefinition>(
  NOTIFICATION_TEMPLATES.map((template) => [template.code, template]),
);

export function templateDefinition(code: NotificationTemplateCode): NotificationTemplateDefinition {
  const definition = BY_CODE.get(code);
  if (!definition) {
    throw new Error(`No notification template is defined for ${code}`);
  }
  return definition;
}

/** What a digest counts, phrased per locale — `"3 عمليات تسليم في انتظار توقيعك"`. */
export const DIGEST_SUBJECTS: Record<
  NotificationTemplateCode,
  Record<Locale, string>
> = Object.fromEntries(
  NOTIFICATION_TEMPLATES.map((template) => [
    template.code,
    { ar: template.translations.ar.title, en: template.translations.en.title },
  ]),
) as Record<NotificationTemplateCode, Record<Locale, string>>;
