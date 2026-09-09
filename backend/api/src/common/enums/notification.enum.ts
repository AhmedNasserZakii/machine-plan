/**
 * The event catalogue of `18-feature-notifications.md`. These codes are the contract between the
 * trigger sites, the template table, the per-user preferences and the Flutter router, so they are
 * declared once here and never spelled out as literals anywhere else.
 */
export enum NotificationTemplateCode {
  TRANSFER_PENDING = 'TRANSFER_PENDING',
  TRANSFER_CONFIRMED = 'TRANSFER_CONFIRMED',
  TRANSFER_REJECTED = 'TRANSFER_REJECTED',
  TRANSFER_REMINDER = 'TRANSFER_REMINDER',
  TRANSFER_STUCK = 'TRANSFER_STUCK',
  VIOLATION_CREATED = 'VIOLATION_CREATED',
  VIOLATION_CHARGED = 'VIOLATION_CHARGED',
  MAINTENANCE_OPENED = 'MAINTENANCE_OPENED',
  MAINTENANCE_RETURNED = 'MAINTENANCE_RETURNED',
  MACHINE_REPLACED = 'MACHINE_REPLACED',
  WARRANTY_EXPIRING = 'WARRANTY_EXPIRING',
  WARRANTY_EXPIRED = 'WARRANTY_EXPIRED',
  BUDGET_WARNING = 'BUDGET_WARNING',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  SUBSCRIPTION_DUE = 'SUBSCRIPTION_DUE',
  SUBSCRIPTION_OVERDUE = 'SUBSCRIPTION_OVERDUE',
  MACHINE_IDLE = 'MACHINE_IDLE',
  DECOMMISSION_CANDIDATE = 'DECOMMISSION_CANDIDATE',
  /**
   * Not in the `18` catalogue, which stops at the *candidate* stage. `13`, step 7 requires the
   * Director to be told when a machine is actually scrapped, and that is a different event: one
   * is a recommendation he may ignore, the other is an asset that has left the books.
   */
  MACHINE_DECOMMISSIONED = 'MACHINE_DECOMMISSIONED',
  /** The summary sent in place of a flood of same-template pushes (`18`, delivery rule 3). */
  DIGEST = 'DIGEST',
}

export const NOTIFICATION_TEMPLATE_CODES = Object.values(NotificationTemplateCode);

/** What the notification points at, and what the deep link addresses. */
export enum NotificationEntityType {
  TRANSFER = 'transfer',
  VIOLATION = 'violation',
  MAINTENANCE_ORDER = 'maintenance-order',
  MACHINE = 'machine',
  BUDGET = 'budget',
  SUBSCRIPTION = 'subscription',
}

export const NOTIFICATION_ENTITY_TYPES = Object.values(NotificationEntityType);

/**
 * The outcome of the push leg, recorded on the notification row.
 *
 * `SKIPPED` is a first-class result rather than an absence: without it a notification whose push
 * never left the building is indistinguishable from one that was delivered, and the only way to
 * find out would be to ask the recipient.
 */
export enum PushStatus {
  /** Written, cleared to send, transport not yet asked. Never a resting state for long. */
  PENDING = 'PENDING',
  SENT = 'SENT',
  SKIPPED = 'SKIPPED',
  DEFERRED = 'DEFERRED',
  FAILED = 'FAILED',
}

export const PUSH_STATUSES = Object.values(PushStatus);

/** Why the push leg did not happen. Always stored alongside a non-`SENT` `PushStatus`. */
export enum PushSkipReason {
  /** No FCM credentials are configured, so there is no transport to hand the message to. */
  TRANSPORT_DISABLED = 'TRANSPORT_DISABLED',
  PREFERENCE_OFF = 'PREFERENCE_OFF',
  NO_ACTIVE_DEVICE = 'NO_ACTIVE_DEVICE',
  /** Inside quiet hours; the hourly flush picks it up in the next window. */
  QUIET_HOURS = 'QUIET_HOURS',
  /** Folded into a digest because the same template arrived more than the threshold in an hour. */
  DIGESTED = 'DIGESTED',
  TRANSPORT_ERROR = 'TRANSPORT_ERROR',
  /** Every token the recipient had was rejected by FCM and has been removed. */
  TOKENS_UNREGISTERED = 'TOKENS_UNREGISTERED',
}

export const PUSH_SKIP_REASONS = Object.values(PushSkipReason);
