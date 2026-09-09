import { Notification } from '../entities/notification.entity';
import { NotificationResponse } from '../dto/responses/notification.response';

export function toNotificationResponse(notification: Notification): NotificationResponse {
  return {
    id: notification.id,
    templateCode: notification.templateCode,
    title: notification.title,
    body: notification.body,
    locale: notification.locale,
    entityType: notification.entityType,
    entityId: notification.entityId,
    deepLink: notification.deepLink,
    data: notification.data,
    isRead: notification.readAt !== null,
    readAt: notification.readAt?.toISOString() ?? null,
    pushStatus: notification.pushStatus,
    pushSkipReason: notification.pushSkipReason,
    createdAt: notification.createdAt.toISOString(),
  };
}
