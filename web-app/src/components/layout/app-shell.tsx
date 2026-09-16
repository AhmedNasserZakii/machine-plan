'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { OfflineBanner } from '@/components/feedback/offline-banner';
import { CommandPalette } from '@/components/layout/command-palette';
import { ExportsPanel } from '@/components/layout/exports-panel';
import { FocusToHeading } from '@/components/layout/focus-to-heading';
import { ShortcutHelp } from '@/components/layout/shortcut-help';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { ExportsProvider } from '@/components/providers/exports-provider';

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const [collapsed, setCollapsed] = useState(false);
  const [command, setCommand] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('shell.collapsed');
    if (stored === '1') setCollapsed(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommand(true);
      }
      if (
        event.key === '?' &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        setHelp(true);
      }
      if (event.key === 'Escape') {
        setCommand(false);
        setHelp(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggle = () => {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem('shell.collapsed', next ? '1' : '0');
      return next;
    });
  };

  return (
    <ExportsProvider>
      <div className="flex min-h-screen bg-background">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:px-md focus:py-sm"
        >
          {t('web.shell.skipToContent')}
        </a>
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onCommand={() => setCommand(true)} onHelp={() => setHelp(true)} />
          <OfflineBanner />
          <main id="content" className="min-w-0 flex-1 overflow-auto p-lg">
            <FocusToHeading />
            {children}
          </main>
          <ExportsPanel />
        </div>
        <CommandPalette open={command} onOpenChange={setCommand} />
        <ShortcutHelp open={help} onOpenChange={setHelp} />
      </div>
    </ExportsProvider>
  );
}
