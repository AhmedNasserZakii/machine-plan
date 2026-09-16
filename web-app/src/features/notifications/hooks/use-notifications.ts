'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { newIdempotencyKey } from '@/lib/api/idempotency';
import { useIdempotentMutation } from '@/lib/query/use-idempotent-mutation';

import { notificationsApi } from '../api/notifications.api';
import type { NotificationsListParams, UpdateNotificationPreferencesDto } from '../model';
import { notificationKeys } from './query-keys';

export function useNotificationsList(params: NotificationsListParams) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationsApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: async () => {
      const result = await notificationsApi.unreadCount();
      return result.data?.unread ?? 0;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: async () => (await notificationsApi.preferences()).data,
  });
}

/** Optimistic mark-read — the only optimistic mutation allowed (07). */
export function useMarkNotificationReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const key = newIdempotencyKey();
      return (await notificationsApi.markRead(id, key)).data;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: notificationKeys.all });
      const prevUnread = qc.getQueryData<number>(notificationKeys.unread());
      qc.setQueryData(notificationKeys.unread(), (old: number | undefined) =>
        Math.max(0, (old ?? 1) - 1),
      );
      return { prevUnread, id };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prevUnread !== undefined) {
        qc.setQueryData(notificationKeys.unread(), ctx.prevUnread);
      }
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation<{ updated: number }, { ids?: string[] } | void>({
    mutationFn: async (vars, key: string) =>
      (await notificationsApi.markAllRead(vars?.ids ? { ids: vars.ids } : {}, key)).data!,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useUpdateNotificationPreferencesMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (body: UpdateNotificationPreferencesDto, key: string) =>
      (await notificationsApi.updatePreferences(body, key)).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: notificationKeys.preferences() });
    },
  });
}
