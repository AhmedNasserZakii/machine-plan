'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

export function ShortcutHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations();
  if (!open) return null;
  const rows = [
    ['⌘/Ctrl K', t('web.shortcuts.command')],
    ['/', t('web.shortcuts.search')],
    ['?', t('web.shortcuts.help')],
    ['j / k', `${t('web.shortcuts.rowNext')} / ${t('web.shortcuts.rowPrev')}`],
    ['Enter', t('web.shortcuts.open')],
    ['⌘/Ctrl Enter', t('web.shortcuts.submit')],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40" onClick={() => onOpenChange(false)}>
      <div
        role="dialog"
        aria-labelledby="shortcut-title"
        className="w-full max-w-md rounded-lg bg-surface p-lg shadow-popover"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="shortcut-title" className="t-h3">
          {t('web.shortcuts.title')}
        </h2>
        <ul className="mt-md space-y-sm">
          {rows.map(([key, label]) => (
            <li key={key} className="flex justify-between gap-md t-body">
              <span>{label}</span>
              <kbd className="t-mono rounded-sm bg-surface-alt px-sm py-xs">{key}</kbd>
            </li>
          ))}
        </ul>
        <Button type="button" className="mt-lg" onClick={() => onOpenChange(false)}>
          Esc
        </Button>
      </div>
    </div>
  );
}
