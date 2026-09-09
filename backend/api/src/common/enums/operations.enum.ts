export enum WarehouseType {
  COMPANY_MAIN = 'COMPANY_MAIN',
  BRANCH = 'BRANCH',
  SCRAP = 'SCRAP',
  MAINTENANCE = 'MAINTENANCE',
}

export const WAREHOUSE_TYPES = Object.values(WarehouseType);

export enum Severity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export const SEVERITIES = Object.values(Severity);

export enum ViolationStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  WAIVED = 'WAIVED',
  CHARGED = 'CHARGED',
  CLOSED = 'CLOSED',
}

export const VIOLATION_STATUSES = Object.values(ViolationStatus);

export enum MaintenanceStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RETURNED = 'RETURNED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export const MAINTENANCE_STATUSES = Object.values(MaintenanceStatus);

/** An order in one of these statuses still blocks a second order on the same machine. */
export const OPEN_MAINTENANCE_STATUSES: readonly MaintenanceStatus[] = [
  MaintenanceStatus.OPEN,
  MaintenanceStatus.IN_PROGRESS,
  MaintenanceStatus.RETURNED,
];

export enum MaintenanceResult {
  REPAIRED = 'REPAIRED',
  REPLACED = 'REPLACED',
  UNREPAIRABLE = 'UNREPAIRABLE',
}

export const MAINTENANCE_RESULTS = Object.values(MaintenanceResult);

export enum ResponsibleParty {
  COMPANY = 'COMPANY',
  REPRESENTATIVE = 'REPRESENTATIVE',
  MERCHANT = 'MERCHANT',
  FACTORY = 'FACTORY',
}

export const RESPONSIBLE_PARTIES = Object.values(ResponsibleParty);

export enum MediaPurpose {
  TRANSFER_PHOTO = 'TRANSFER_PHOTO',
  SIGNATURE = 'SIGNATURE',
  INVOICE = 'INVOICE',
  AVATAR = 'AVATAR',
}

export const MEDIA_PURPOSES = Object.values(MediaPurpose);

export interface MediaPurposeRule {
  /**
   * Enforced on the declared size at presign and on the real size at confirm. Phone photos are
   * compressed on the device before they ever reach here (`19`), so these are already generous.
   */
  maxBytes: number;
  mimeTypes: readonly string[];
  /** Where the object lands, which is also how retention policy is applied later. */
  prefix: string;
}

const MB = 1024 * 1024;

export const MEDIA_PURPOSE_RULES: Record<MediaPurpose, MediaPurposeRule> = {
  [MediaPurpose.TRANSFER_PHOTO]: {
    maxBytes: 2 * MB,
    mimeTypes: ['image/jpeg', 'image/webp'],
    prefix: 'transfer-photos',
  },
  // A drawn signature is a few strokes on a transparent canvas. Anything approaching the size of a
  // photograph means the client sent the wrong thing.
  [MediaPurpose.SIGNATURE]: {
    maxBytes: 200 * 1024,
    mimeTypes: ['image/png'],
    prefix: 'signatures',
  },
  [MediaPurpose.INVOICE]: {
    maxBytes: 5 * MB,
    mimeTypes: ['image/jpeg', 'image/webp', 'application/pdf'],
    prefix: 'invoices',
  },
  [MediaPurpose.AVATAR]: {
    maxBytes: 1 * MB,
    mimeTypes: ['image/jpeg', 'image/webp'],
    prefix: 'avatars',
  },
};

export enum PermissionEffect {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
}

export const PERMISSION_EFFECTS = Object.values(PermissionEffect);

export enum NotificationChannel {
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
}

export const NOTIFICATION_CHANNELS = Object.values(NotificationChannel);
