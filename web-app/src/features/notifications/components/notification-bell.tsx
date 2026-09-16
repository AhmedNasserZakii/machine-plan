'use client';

import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { DateText } from '@/components/common/date-text';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link, useRouter } from '@/i18n/navigation';

import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsList,
  useUnreadCount,
} from '../hooks';
import { notificationHref } from '../model';

export function NotificationBell() {
  const t = useTranslations();
  const router = useRouter();
  const unread = useUnreadCount();
  const recent = useNotificationsList({ page: 1, limit: 10, sortDir: 'desc' });
  const markRead = useMarkNotificationReadMutation();
  const markAll = useMarkAllNotificationsReadMutation();
  const [open, setOpen] = useState(false);
  const count = unread.data ?? 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="ghost" size="icon" aria-label={t('web.nav.notifications')} className="relative">
            <Bell className="size-4" />
            {count > 0 ? (
              <span className="absolute end-1 top-1 inline-flex min-w-4 items-center justify-center rounded-sm bg-danger px-xs t-caption text-danger-fg">
                {count > 99 ? '99+' : count}
              </span>
            ) : null}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>{t('web.notifications.title')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(recent.data?.data ?? []).map((n) => (
          <DropdownMenuItem
            key={n.id}
            className="flex flex-col items-stretch gap-xs"
            onClick={() => {
              if (!n.isRead) void markRead.mutateAsync(n.id);
              const href = notificationHref(n);
              setOpen(false);
              router.push(href ?? '/notifications');
            }}
          >
            <span className="flex items-center justify-between gap-sm">
              <span className="font-medium">{n.title}</span>
              {!n.isRead ? <span className="size-2 rounded-sm bg-primary" aria-hidden /> : null}
            </span>
            <span className="t-caption text-text-secondary line-clamp-2">{n.body}</span>
            <DateText value={n.createdAt} className="t-caption text-text-secondary" />
          </DropdownMenuItem>
        ))}
        {!recent.data?.data?.length ? (
          <p className="px-md py-sm t-caption text-text-secondary">{t('web.notifications.empty')}</p>
        ) : null}
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between gap-sm px-sm py-xs">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={markAll.isPending || count === 0}
            onClick={() => void markAll.mutateAsync(undefined)}
          >
            {t('web.notifications.markAll')}
          </Button>
          <Link href="/notifications" className="t-caption text-primary hover:underline" onClick={() => setOpen(false)}>
            {t('web.notifications.viewAll')}
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
