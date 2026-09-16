import type { Schema } from '@/lib/api/types';

export type Notification = Schema<'NotificationResponse'>;
export type NotificationTemplate = Notification['templateCode'];
export type UnreadCount = Schema<'UnreadCountResponse'>;
export type NotificationPreferences = Schema<'NotificationPreferencesResponse'>;
export type UpdateNotificationPreferencesDto = Schema<'UpdateNotificationPreferencesDto'>;

export type NotificationsListParams = {
  page?: number;
  limit?: number;
  sortDir?: 'asc' | 'desc';
  unreadOnly?: boolean;
  templateCode?: NotificationTemplate[];
};
