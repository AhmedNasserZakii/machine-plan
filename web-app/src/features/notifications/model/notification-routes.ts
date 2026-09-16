import type { Notification, NotificationTemplate } from './types';

export type NotificationTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export const NOTIFICATION_TONE: Record<NotificationTemplate, NotificationTone> = {
  TRANSFER_PENDING: 'warning',
  TRANSFER_CONFIRMED: 'success',
  TRANSFER_REJECTED: 'danger',
  TRANSFER_REMINDER: 'warning',
  TRANSFER_STUCK: 'danger',
  VIOLATION_CREATED: 'warning',
  VIOLATION_CHARGED: 'danger',
  MAINTENANCE_OPENED: 'info',
  MAINTENANCE_RETURNED: 'success',
  MACHINE_REPLACED: 'info',
  WARRANTY_EXPIRING: 'warning',
  WARRANTY_EXPIRED: 'danger',
  BUDGET_WARNING: 'warning',
  BUDGET_EXCEEDED: 'danger',
  SUBSCRIPTION_DUE: 'warning',
  SUBSCRIPTION_OVERDUE: 'danger',
  MACHINE_IDLE: 'warning',
  DECOMMISSION_CANDIDATE: 'warning',
  MACHINE_DECOMMISSIONED: 'neutral',
  DIGEST: 'info',
};

/** Mirrors mobile `notification_deep_link_router.dart` → web paths. */
export function notificationHref(notification: Notification): string | null {
  const raw = typeof notification.deepLink === 'string' ? notification.deepLink : null;
  if (raw) {
    const parsed = parseMachineryDeepLink(raw);
    if (parsed) return parsed;
  }

  const entityId = typeof notification.entityId === 'string' ? notification.entityId : null;
  switch (notification.entityType) {
    case 'transfer':
      return entityId ? `/transfers/${entityId}` : '/transfers';
    case 'violation':
      return entityId ? `/violations/${entityId}` : '/violations';
    case 'maintenance-order':
      return entityId ? `/maintenance/${entityId}` : '/maintenance';
    case 'machine':
      return entityId ? `/machines/${entityId}` : '/machines';
    case 'budget':
      return entityId ? `/finance/budgets/${entityId}` : '/finance/budgets';
    case 'subscription':
      return '/merchants';
    default:
      return hrefFromTemplate(notification.templateCode, entityId);
  }
}

function hrefFromTemplate(code: NotificationTemplate, entityId: string | null): string | null {
  switch (code) {
    case 'TRANSFER_PENDING':
    case 'TRANSFER_CONFIRMED':
    case 'TRANSFER_REJECTED':
    case 'TRANSFER_REMINDER':
    case 'TRANSFER_STUCK':
      return entityId ? `/transfers/${entityId}` : '/transfers';
    case 'VIOLATION_CREATED':
    case 'VIOLATION_CHARGED':
      return entityId ? `/violations/${entityId}` : '/violations';
    case 'MAINTENANCE_OPENED':
    case 'MAINTENANCE_RETURNED':
      return entityId ? `/maintenance/${entityId}` : '/maintenance';
    case 'MACHINE_REPLACED':
    case 'WARRANTY_EXPIRING':
    case 'WARRANTY_EXPIRED':
    case 'MACHINE_IDLE':
    case 'DECOMMISSION_CANDIDATE':
    case 'MACHINE_DECOMMISSIONED':
      return entityId ? `/machines/${entityId}` : '/machines';
    case 'BUDGET_WARNING':
    case 'BUDGET_EXCEEDED':
      return entityId ? `/finance/budgets/${entityId}` : '/finance/budgets';
    case 'SUBSCRIPTION_DUE':
    case 'SUBSCRIPTION_OVERDUE':
      return '/merchants';
    case 'DIGEST':
      return '/notifications';
    default:
      return '/notifications';
  }
}

function parseMachineryDeepLink(raw: string): string | null {
  const uri = (() => {
    try {
      return new URL(raw);
    } catch {
      return null;
    }
  })();
  if (!uri) return null;
  if (uri.protocol && uri.protocol !== 'machinery:') return null;
  const host = uri.hostname || uri.host;
  const segments = uri.pathname.split('/').filter(Boolean);
  const id = segments.at(-1);

  switch (host) {
    case 'transfers':
      return id ? `/transfers/${id}` : '/transfers';
    case 'violations':
      return id ? `/violations/${id}` : '/violations';
    case 'maintenance':
      return id ? `/maintenance/${id}` : '/maintenance';
    case 'machines':
      return id ? `/machines/${id}` : '/machines';
    case 'finance':
      if (segments[0] === 'budgets') {
        return segments[1] ? `/finance/budgets/${segments[1]}` : '/finance/budgets';
      }
      return '/finance';
    case 'subscriptions':
      return '/merchants';
    case 'notifications':
      return '/notifications';
    default:
      return null;
  }
}
