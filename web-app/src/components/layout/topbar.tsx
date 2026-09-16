'use client';

import { useQueryClient } from '@tanstack/react-query';
import { HelpCircle, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { LocaleSwitcher } from '@/components/common/locale-switcher';
import { BranchSwitcher } from '@/components/layout/branch-switcher';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/features/notifications/components';
import { useRouter } from '@/i18n/navigation';
import { useSession } from '@/lib/auth/use-session';

export function Topbar({ onCommand, onHelp }: { onCommand: () => void; onHelp: () => void }) {
  const t = useTranslations();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useSession();

  const logout = async () => {
    await fetch('/api/bff/logout', { method: 'POST' });
    qc.clear();
    router.replace('/login');
  };

  return (
    <header
      data-slot="topbar"
      className="flex h-[var(--topbar-height)] items-center gap-md border-b border-border bg-surface px-md"
    >
      <div className="hidden min-w-0 shrink-0 md:block">
        <Breadcrumbs />
      </div>
      <button
        type="button"
        onClick={onCommand}
        className="min-w-0 flex-1 rounded-md border border-border bg-background px-md py-sm text-start t-body text-text-placeholder"
      >
        {t('web.shell.search')}
      </button>
      <BranchSwitcher />
      <LocaleSwitcher />
      <NotificationBell />
      <Button type="button" variant="ghost" size="icon" aria-label={t('web.shell.shortcuts')} onClick={onHelp}>
        <HelpCircle className="size-4" />
      </Button>
      <div className="flex items-center gap-sm">
        <span className="t-label">{user?.fullName}</span>
        <Button type="button" variant="ghost" size="icon" aria-label={t('shared.logout')} onClick={logout}>
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
