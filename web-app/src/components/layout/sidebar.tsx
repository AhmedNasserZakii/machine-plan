'use client';

import { ChevronLeft, PanelLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DirectionalIcon } from '@/components/common/directional-icon';
import { useUnreadCount } from '@/features/notifications/hooks';
import { usePendingIncomingTransfers } from '@/features/transfers/hooks/use-transfers';
import { Link, usePathname } from '@/i18n/navigation';
import { useSession } from '@/lib/auth/use-session';
import { visibleNavGroups } from '@/lib/nav/nav-items';
import { cn } from '@/lib/utils';

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const { permissions } = useSession();
  const groups = visibleNavGroups(permissions);
  const unread = useUnreadCount();
  const incoming = usePendingIncomingTransfers(5);
  const badges = {
    unreadNotifications: unread.data ?? 0,
    pendingIncoming: incoming.data?.length ?? 0,
  };

  return (
    <aside
      data-slot="sidebar"
      className={cn(
        'flex h-full shrink-0 flex-col border-e border-border bg-surface transition-[width]',
        collapsed ? 'w-[var(--sidebar-width-collapsed)]' : 'w-[var(--sidebar-width)]',
      )}
    >
      <div className="flex h-[var(--topbar-height)] items-center justify-between gap-sm border-b border-border px-sm">
        {!collapsed ? <span className="t-h3 text-primary">Machinery</span> : null}
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-alt"
          onClick={onToggle}
          aria-label={collapsed ? t('web.nav.expand') : t('web.nav.collapse')}
        >
          {collapsed ? (
            <PanelLeft className="size-4" />
          ) : (
            <DirectionalIcon>
              <ChevronLeft className="size-4" />
            </DirectionalIcon>
          )}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-sm" aria-label="Primary">
        {groups.map((group) => (
          <div key={group.labelKey} className="mb-md">
            {!collapsed ? (
              <p className="px-md pb-xs t-caption text-text-secondary">{t(group.labelKey)}</p>
            ) : null}
            <ul className="flex flex-col gap-xs px-xs">
              {group.items.map((item) => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                const Icon = item.icon;
                const badgeCount = item.badge ? badges[item.badge] : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-sm rounded-sm px-sm py-sm t-label',
                        active
                          ? 'bg-info-surface text-primary'
                          : 'text-text-secondary hover:bg-surface-alt',
                      )}
                      title={t(item.labelKey)}
                    >
                      <Icon className="size-4 shrink-0" />
                      {!collapsed ? <span className="flex-1">{t(item.labelKey)}</span> : null}
                      {!collapsed && badgeCount > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-sm bg-danger px-xs t-caption text-danger-fg">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
