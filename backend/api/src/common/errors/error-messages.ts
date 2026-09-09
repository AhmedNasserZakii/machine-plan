import { DEFAULT_LOCALE, Locale } from '../constants/locales';
import { ErrorCode, ErrorCodeValue } from '../constants/error-codes';

export type MessageParams = Record<string, string | number | undefined>;

type LocalizedMessage = Record<Locale, string>;

/**
 * Human-facing messages per error code. `{placeholder}` tokens are filled from the
 * params passed to `AppException`.
 */
const MESSAGES: Record<ErrorCodeValue, LocalizedMessage> = {
  [ErrorCode.VALIDATION_FAILED]: {
    ar: 'البيانات المرسلة غير صحيحة',
    en: 'The submitted data is invalid',
  },
  [ErrorCode.NOT_FOUND]: {
    ar: 'العنصر المطلوب غير موجود',
    en: 'The requested resource was not found',
  },
  [ErrorCode.INTERNAL_ERROR]: {
    ar: 'حدث خطأ غير متوقع، برجاء المحاولة لاحقاً',
    en: 'An unexpected error occurred, please try again later',
  },
  [ErrorCode.RATE_LIMITED]: {
    ar: 'عدد كبير من الطلبات، برجاء المحاولة بعد قليل',
    en: 'Too many requests, please try again shortly',
  },
  [ErrorCode.REQUEST_TIMEOUT]: {
    ar: 'انتهت مدة تنفيذ الطلب',
    en: 'The request timed out',
  },
  [ErrorCode.CLIENT_UPGRADE_REQUIRED]: {
    ar: 'إصدار التطبيق قديم، برجاء التحديث للإصدار {minVersion} أو أحدث',
    en: 'Your app version is outdated, please update to {minVersion} or newer',
  },

  [ErrorCode.INVALID_CREDENTIALS]: {
    ar: 'رقم الهاتف أو كلمة المرور غير صحيحة',
    en: 'Invalid phone number or password',
  },
  [ErrorCode.ACCOUNT_INACTIVE]: {
    ar: 'هذا الحساب غير مُنشّط، برجاء التواصل مع الإدارة',
    en: 'This account is inactive, please contact the administrator',
  },
  [ErrorCode.ACCOUNT_LOCKED]: {
    ar: 'تم إيقاف الحساب مؤقتاً بعد محاولات دخول خاطئة، حاول بعد {minutes} دقيقة',
    en: 'Account temporarily locked after failed attempts, try again in {minutes} minutes',
  },
  [ErrorCode.TOKEN_EXPIRED]: {
    ar: 'انتهت صلاحية الجلسة، برجاء تسجيل الدخول مرة أخرى',
    en: 'Your session has expired, please sign in again',
  },
  [ErrorCode.TOKEN_REVOKED]: {
    ar: 'تم إلغاء هذه الجلسة، برجاء تسجيل الدخول مرة أخرى',
    en: 'This session was revoked, please sign in again',
  },
  [ErrorCode.PASSWORD_CHANGE_REQUIRED]: {
    ar: 'يجب تغيير كلمة المرور قبل استخدام التطبيق',
    en: 'You must change your password before continuing',
  },
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: {
    ar: 'لا تمتلك صلاحية تنفيذ هذا الإجراء',
    en: 'You do not have permission to perform this action',
  },
  [ErrorCode.BRANCH_SCOPE_VIOLATION]: {
    ar: 'لا تمتلك صلاحية الوصول لبيانات فرع آخر',
    en: 'You cannot access data belonging to another branch',
  },
  [ErrorCode.UNAUTHENTICATED]: {
    ar: 'برجاء تسجيل الدخول',
    en: 'Authentication is required',
  },
  [ErrorCode.DEVICE_NOT_ENROLLED]: {
    ar: 'هذا الجهاز غير مسجل لاستخدام البصمة',
    en: 'This device is not enrolled for biometric confirmation',
  },

  [ErrorCode.SERIAL_EXISTS]: {
    ar: 'الرقم التسلسلي {serial} مستخدم بالفعل',
    en: 'Serial {serial} already exists',
  },
  [ErrorCode.BATTERY_SERIAL_EXISTS]: {
    ar: 'الرقم التسلسلي للبطارية {serial} مستخدم بالفعل',
    en: 'Battery serial {serial} already exists',
  },
  [ErrorCode.SIM_SERIAL_EXISTS]: {
    ar: 'الرقم التسلسلي للشريحة {serial} مستخدم بالفعل',
    en: 'SIM serial {serial} already exists',
  },
  [ErrorCode.BOX_SERIAL_EXISTS]: {
    ar: 'الرقم التسلسلي للكرتونة {serial} مستخدم بالفعل',
    en: 'Box serial {serial} already exists',
  },
  [ErrorCode.SERIAL_IMMUTABLE]: {
    ar: 'لا يمكن تعديل الرقم التسلسلي للماكينة',
    en: 'A machine serial cannot be changed',
  },
  [ErrorCode.MACHINE_NOT_FOUND]: {
    ar: 'الماكينة غير موجودة',
    en: 'Machine not found',
  },
  [ErrorCode.MACHINE_RETIRED]: {
    ar: 'الماكينة {serial} خارج الخدمة ولا يمكن التعامل عليها',
    en: 'Machine {serial} is retired and cannot be operated on',
  },
  [ErrorCode.MACHINE_ALREADY_REPLACED]: {
    ar: 'الماكينة {serial} تم استبدالها بالفعل',
    en: 'Machine {serial} has already been replaced',
  },

  [ErrorCode.INVALID_MACHINE_STATUS]: {
    ar: 'حالة الماكينة {serial} الحالية ({status}) لا تسمح بهذه العملية',
    en: 'Machine {serial} is in status {status}, which does not allow this operation',
  },
  [ErrorCode.NOT_IN_YOUR_CUSTODY]: {
    ar: 'الماكينة {serial} ليست في عهدتك',
    en: 'Machine {serial} is not in your custody',
  },
  [ErrorCode.MACHINE_ALREADY_IN_TRANSIT]: {
    ar: 'الماكينة {serial} مرتبطة بعملية تسليم قيد الانتظار',
    en: 'Machine {serial} is already part of a pending transfer',
  },
  [ErrorCode.TRANSFER_NOT_FOUND]: {
    ar: 'عملية التسليم غير موجودة',
    en: 'Transfer not found',
  },
  [ErrorCode.TRANSFER_NOT_PENDING]: {
    ar: 'عملية التسليم لم تعد قيد الانتظار',
    en: 'This transfer is no longer pending',
  },
  [ErrorCode.PAYLOAD_CHANGED]: {
    ar: 'تم تعديل بيانات التسليم بعد التوقيع، برجاء إعادة المراجعة والتوقيع',
    en: 'The transfer contents changed after signing, please review and sign again',
  },
  [ErrorCode.INVALID_TRANSFER_TYPE]: {
    ar: 'نوع عملية التسليم غير صحيح لهذه الأطراف',
    en: 'The transfer type is not valid for the given parties',
  },
  [ErrorCode.INTER_BRANCH_DIRECT_TRANSFER_NOT_ALLOWED]: {
    ar: 'لا يمكن نقل الماكينة بين الفروع مباشرة، يجب إرجاعها لمخزن الشركة أولاً',
    en: 'Direct branch-to-branch movement is not allowed, return the machine to the company warehouse first',
  },
  [ErrorCode.SIGNATURE_REQUIRED]: {
    ar: 'التوقيع مطلوب لإتمام عملية التسليم',
    en: 'A signature is required to complete this transfer',
  },
  [ErrorCode.CANCEL_WINDOW_EXPIRED]: {
    ar: 'انتهت المدة المسموح فيها بإلغاء عملية التسليم',
    en: 'The cancellation window for this transfer has expired',
  },
  [ErrorCode.NOT_THE_RECEIVER]: {
    ar: 'هذه العملية موجّهة لطرف آخر، لا يمكنك استلامها',
    en: 'This transfer is addressed to someone else, you cannot receive it',
  },
  [ErrorCode.NOT_THE_SENDER]: {
    ar: 'أنت لست الطرف المُرسِل لهذه العملية',
    en: 'You are not the sender of this transfer',
  },

  [ErrorCode.MACHINE_ALREADY_IN_MAINTENANCE]: {
    ar: 'يوجد أمر صيانة مفتوح للماكينة {serial}',
    en: 'Machine {serial} already has an open maintenance order',
  },
  [ErrorCode.ORDER_ALREADY_CLOSED]: {
    ar: 'أمر الصيانة مغلق بالفعل',
    en: 'This maintenance order is already closed',
  },
  [ErrorCode.COST_REQUIRED]: {
    ar: 'تكلفة الصيانة مطلوبة عند الإغلاق',
    en: 'A cost is required when closing a maintenance order',
  },
  [ErrorCode.REPLACEMENT_PAYLOAD_REQUIRED]: {
    ar: 'بيانات الماكينة البديلة مطلوبة',
    en: 'Replacement machine details are required',
  },
  [ErrorCode.MAINTENANCE_ORDER_NOT_FOUND]: {
    ar: 'أمر الصيانة غير موجود',
    en: 'Maintenance order not found',
  },
  [ErrorCode.INVALID_MAINTENANCE_STATUS]: {
    ar: 'حالة أمر الصيانة الحالية ({status}) لا تسمح بهذا الإجراء',
    en: 'The maintenance order is {status}, which does not allow this step',
  },

  [ErrorCode.MACHINE_NOT_IN_WAREHOUSE]: {
    ar: 'يجب أن تكون الماكينة في مخزن الشركة قبل إخراجها من الخدمة',
    en: 'The machine must be in the company warehouse before decommissioning',
  },
  [ErrorCode.OPEN_MAINTENANCE_ORDER]: {
    ar: 'لا يمكن إخراج الماكينة من الخدمة مع وجود أمر صيانة مفتوح',
    en: 'Cannot decommission a machine with an open maintenance order',
  },
  [ErrorCode.ALREADY_DECOMMISSIONED]: {
    ar: 'الماكينة خارج الخدمة بالفعل',
    en: 'This machine is already decommissioned',
  },
  [ErrorCode.DECOMMISSION_NOT_FOUND]: {
    ar: 'لا يوجد سجل إخراج من الخدمة لهذه الماكينة',
    en: 'This machine has no decommission record',
  },

  [ErrorCode.SETTING_NOT_FOUND]: {
    ar: 'الإعداد {key} غير معروف',
    en: 'Unknown setting {key}',
  },

  [ErrorCode.MERCHANT_HAS_MACHINES]: {
    ar: 'لا يمكن حذف التاجر لوجود {count} ماكينة في عهدته',
    en: 'Cannot remove this merchant while holding {count} machine(s)',
  },
  [ErrorCode.DUPLICATE_NATIONAL_ID]: {
    ar: 'الرقم القومي مسجل لتاجر آخر',
    en: 'This national ID is already registered to another merchant',
  },

  [ErrorCode.CATEGORY_KIND_MISMATCH]: {
    ar: 'نوع التصنيف لا يطابق نوع الحركة المالية',
    en: 'The category kind does not match the transaction kind',
  },
  [ErrorCode.CATEGORY_HAS_CHILDREN]: {
    ar: 'لا يمكن حذف تصنيف يحتوي على تصنيفات فرعية',
    en: 'Cannot delete a category that has sub-categories',
  },
  [ErrorCode.CATEGORY_HAS_TRANSACTIONS]: {
    ar: 'لا يمكن حذف تصنيف مرتبط بـ {count} حركة مالية، يمكن تعطيله بدلاً من ذلك',
    en: 'Cannot delete a category with {count} transactions; deactivate it instead',
  },
  [ErrorCode.CIRCULAR_CATEGORY_REFERENCE]: {
    ar: 'لا يمكن نقل التصنيف إلى أحد فروعه',
    en: 'A category cannot be moved under one of its own descendants',
  },
  [ErrorCode.SYSTEM_CATEGORY_PROTECTED]: {
    ar: 'هذا تصنيف نظامي ولا يمكن حذفه أو تعديل نوعه',
    en: 'This is a system category and cannot be deleted or re-typed',
  },
  [ErrorCode.FUTURE_DATE_NOT_ALLOWED]: {
    ar: 'لا يمكن تسجيل حركة بتاريخ مستقبلي',
    en: 'A transaction cannot be dated in the future',
  },
  [ErrorCode.BACKDATE_LIMIT_EXCEEDED]: {
    ar: 'لا يمكن تسجيل حركة بتاريخ أقدم من {days} يوم',
    en: 'A transaction cannot be backdated more than {days} days',
  },
  [ErrorCode.AUTO_TRANSACTION_IMMUTABLE]: {
    ar: 'هذه حركة مُسجلة تلقائياً ولا يمكن تعديلها يدوياً',
    en: 'This transaction was posted automatically and cannot be edited manually',
  },
  [ErrorCode.TRANSACTION_ALREADY_VOIDED]: {
    ar: 'الحركة ملغاة بالفعل',
    en: 'This transaction is already voided',
  },
  [ErrorCode.OVERLAPPING_BUDGET]: {
    ar: 'توجد ميزانية أخرى لنفس التصنيف والفترة',
    en: 'Another budget already covers this category and period',
  },
  [ErrorCode.BUDGET_ON_INCOME_CATEGORY]: {
    ar: 'الميزانيات تُحدد لتصنيفات المصروفات فقط',
    en: 'Budgets can only be set on expense categories',
  },
  [ErrorCode.EDIT_WINDOW_EXPIRED]: {
    ar: 'انتهت مدة تعديل الحركة ({days} يوم)، يمكن إلغاؤها فقط',
    en: 'The {days}-day edit window has passed, this transaction can only be voided',
  },

  [ErrorCode.EXPORT_FORMAT_UNAVAILABLE]: {
    ar: 'صيغة التصدير {format} غير متاحة حالياً، استخدم csv',
    en: 'Export format {format} is not available yet, use csv',
  },

  [ErrorCode.ALREADY_CHARGED]: {
    ar: 'تم تحصيل قيمة هذه المخالفة بالفعل',
    en: 'This violation has already been charged',
  },
  [ErrorCode.AUTO_VIOLATION_IMMUTABLE]: {
    ar: 'هذه مخالفة مُسجلة تلقائياً ولا يمكن تعديل بياناتها',
    en: 'This violation was generated automatically and cannot be edited',
  },

  [ErrorCode.USER_HAS_CUSTODY]: {
    ar: 'لا يمكن إيقاف المستخدم لوجود {count} ماكينة في عهدته',
    en: 'Cannot deactivate this user while holding {count} machine(s)',
  },
  [ErrorCode.LAST_DIRECTOR]: {
    ar: 'يجب أن يوجد مدير واحد على الأقل مُنشّط',
    en: 'At least one active director must remain',
  },
  [ErrorCode.CANNOT_EDIT_OWN_PERMISSIONS]: {
    ar: 'لا يمكنك تعديل صلاحياتك أو دورك بنفسك',
    en: 'You cannot edit your own permissions or role',
  },
  [ErrorCode.SYSTEM_ROLE_PROTECTED]: {
    ar: 'لا يمكن تعديل صلاحيات دور المدير',
    en: 'The Director role permissions cannot be modified',
  },
  [ErrorCode.PHONE_EXISTS]: {
    ar: 'رقم الهاتف مسجل لمستخدم آخر',
    en: 'This phone number is already registered',
  },
  [ErrorCode.EMAIL_EXISTS]: {
    ar: 'البريد الإلكتروني مسجل لمستخدم آخر',
    en: 'This email is already registered',
  },
  [ErrorCode.BRANCH_REQUIRED_FOR_ROLE]: {
    ar: 'يجب تحديد الفرع لهذا الدور',
    en: 'A branch is required for this role',
  },

  [ErrorCode.BRANCH_HAS_MACHINES]: {
    ar: 'لا يمكن إيقاف الفرع لوجود {count} ماكينة مرتبطة به',
    en: 'Cannot deactivate this branch while it holds {count} machine(s)',
  },
  [ErrorCode.BRANCH_HAS_ACTIVE_STAFF]: {
    ar: 'لا يمكن إيقاف الفرع لوجود {count} مستخدم مُنشّط',
    en: 'Cannot deactivate this branch while it has {count} active user(s)',
  },
  [ErrorCode.BRANCH_CODE_EXISTS]: {
    ar: 'كود الفرع {code} مستخدم بالفعل',
    en: 'Branch code {code} already exists',
  },
  [ErrorCode.WAREHOUSE_TYPE_CONFLICT]: {
    ar: 'يوجد مخزن آخر بنفس النوع {type}',
    en: 'Another warehouse of type {type} already exists',
  },

  [ErrorCode.CODE_EXISTS]: {
    ar: 'الكود {code} مستخدم بالفعل',
    en: 'Code {code} already exists',
  },
  [ErrorCode.DEFAULT_LOCALE_REQUIRED]: {
    ar: 'الترجمة العربية مطلوبة',
    en: 'The Arabic translation is required',
  },
  [ErrorCode.LOOKUP_IN_USE]: {
    ar: 'هذا العنصر مستخدم ولا يمكن حذفه',
    en: 'This item is in use and cannot be deleted',
  },

  [ErrorCode.IDEMPOTENCY_KEY_REUSED]: {
    ar: 'تم استخدام مفتاح الطلب مع بيانات مختلفة',
    en: 'This idempotency key was already used with a different payload',
  },
  [ErrorCode.IDEMPOTENCY_KEY_REQUIRED]: {
    ar: 'مفتاح الطلب (Idempotency-Key) مطلوب',
    en: 'An Idempotency-Key header is required',
  },
  [ErrorCode.IDEMPOTENT_REQUEST_IN_PROGRESS]: {
    ar: 'الطلب قيد التنفيذ بالفعل، برجاء الانتظار',
    en: 'A request with this key is still being processed',
  },
  [ErrorCode.INVALID_OCCURRED_AT]: {
    ar: 'وقت تنفيذ العملية غير منطقي',
    en: 'The provided occurrence time is not acceptable',
  },
  [ErrorCode.SCHEMA_VERSION_MISMATCH]: {
    ar: 'إصدار البيانات غير متوافق، برجاء تحديث التطبيق',
    en: 'Data schema version mismatch, please update the app',
  },
  [ErrorCode.TOO_MANY_PHOTOS]: {
    ar: 'الحد الأقصى {max} صور لكل ماكينة',
    en: 'A maximum of {max} photos per item is allowed',
  },
  [ErrorCode.MEDIA_NOT_FOUND]: {
    ar: 'الملف غير موجود',
    en: 'File not found',
  },
  [ErrorCode.MEDIA_NOT_CONFIRMED]: {
    ar: 'لم يتم تأكيد رفع الملف',
    en: 'The uploaded file has not been confirmed',
  },
  [ErrorCode.MEDIA_ALREADY_USED]: {
    ar: 'هذا الملف مرتبط بعملية أخرى بالفعل',
    en: 'This file is already attached to another record',
  },
  [ErrorCode.UPLOAD_TOO_LARGE]: {
    ar: 'حجم الملف أكبر من الحد المسموح ({maxMb} ميجابايت)',
    en: 'The file exceeds the maximum allowed size ({maxMb} MB)',
  },
  [ErrorCode.UNSUPPORTED_MEDIA_TYPE]: {
    ar: 'نوع الملف {mimeType} غير مدعوم لهذا الغرض',
    en: 'File type {mimeType} is not supported for this purpose',
  },
  [ErrorCode.STORAGE_UNAVAILABLE]: {
    ar: 'خدمة تخزين الملفات غير متاحة حالياً',
    en: 'File storage is currently unavailable',
  },
  [ErrorCode.CHECKSUM_MISMATCH]: {
    ar: 'الملف المرفوع لا يطابق البيانات المرسلة، برجاء إعادة الرفع',
    en: 'The uploaded file does not match what was declared, please upload again',
  },
};

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

export function resolveErrorMessage(
  code: string,
  locale: Locale = DEFAULT_LOCALE,
  params?: MessageParams,
): string {
  const entry = MESSAGES[code as ErrorCodeValue];
  if (!entry) return code;
  return interpolate(entry[locale] ?? entry[DEFAULT_LOCALE], params);
}
