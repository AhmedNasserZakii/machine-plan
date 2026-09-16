import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import type { ListMeta } from '@/lib/api/pagination';
import type { QueryParams } from '@/lib/api/query';

import type {
  Notification,
  NotificationPreferences,
  NotificationsListParams,
  UnreadCount,
  UpdateNotificationPreferencesDto,
} from '../model';

function listQuery(params: NotificationsListParams): QueryParams {
  return {
    page: params.page,
    limit: params.limit,
    sortDir: params.sortDir,
    unreadOnly: params.unreadOnly,
    templateCode: params.templateCode,
  };
}

export const notificationsApi = {
  list(params: NotificationsListParams = {}) {
    return api.get<Notification[], ListMeta>(endpoints.notifications.list, listQuery(params));
  },
  unreadCount() {
    return api.get<UnreadCount>(endpoints.notifications.unreadCount);
  },
  markRead(id: string, idempotencyKey: string) {
    return api.patch<Notification>(endpoints.notifications.read(id), {}, idempotencyKey);
  },
  markAllRead(body: { ids?: string[] }, idempotencyKey: string) {
    return api.patch<{ updated: number }>(endpoints.notifications.readAll, body, idempotencyKey);
  },
  preferences() {
    return api.get<NotificationPreferences>(endpoints.notifications.preferences);
  },
  updatePreferences(body: UpdateNotificationPreferencesDto, idempotencyKey: string) {
    return api.put<NotificationPreferences>(endpoints.notifications.preferences, body, idempotencyKey);
  },
};
