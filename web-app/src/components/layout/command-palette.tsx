'use client';

import { Command } from 'cmdk';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { useSession } from '@/lib/auth/use-session';
import { visibleNavGroups } from '@/lib/nav/nav-items';

type LookupHit = {
  id: string;
  serial: string;
  matchedOn?: 'MACHINE' | 'BATTERY' | 'SIM' | 'BOX';
};

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations();
  const router = useRouter();
  const { permissions } = useSession();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<LookupHit[]>([]);
  const pages = visibleNavGroups(permissions).flatMap((g) => g.items);

  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const result = await api.get<{
          matchedOn: LookupHit['matchedOn'];
          machine: { id: string; serial: string };
        }>(endpoints.machines.lookup, { q: query.trim() });
        const data = result.data;
        if (!data) {
          setHits([]);
          return;
        }
        // Lookup returns a single MachineLookupResponse; tolerate accidental arrays.
        const rows = Array.isArray(data) ? data : [data];
        setHits(
          rows
            .map((row) => {
              if (row && typeof row === 'object' && 'machine' in row && row.machine) {
                return {
                  id: row.machine.id,
                  serial: row.machine.serial,
                  matchedOn: row.matchedOn,
                };
              }
              if (row && typeof row === 'object' && 'id' in row && 'serial' in row) {
                return row as LookupHit;
              }
              return null;
            })
            .filter((row): row is LookupHit => !!row),
        );
      } catch {
        setHits([]);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-scrim/40" onClick={() => onOpenChange(false)}>
      <div
        className="mx-auto mt-[12vh] w-full max-w-lg rounded-md bg-surface p-sm shadow-popover"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label={t('web.shell.commandPlaceholder')}>
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder={t('web.shell.commandPlaceholder')}
            className="w-full border-b border-border px-md py-sm t-body outline-none"
            dir="auto"
          />
          <Command.List className="max-h-80 overflow-y-auto py-sm">
            <Command.Empty className="px-md py-sm t-body text-text-secondary">
              {t('web.shell.commandEmpty')}
            </Command.Empty>
            <Command.Group heading={t('web.shell.commandPages')}>
              {pages.map((item) => (
                <Command.Item
                  key={item.href}
                  value={item.href}
                  onSelect={() => {
                    router.push(item.href);
                    onOpenChange(false);
                  }}
                  className="cursor-pointer rounded-sm px-md py-sm t-body aria-selected:bg-surface-alt"
                >
                  {t(item.labelKey)}
                </Command.Item>
              ))}
            </Command.Group>
            {hits.length ? (
              <Command.Group heading={t('web.shell.commandMachines')}>
                {hits.map((hit) => (
                  <Command.Item
                    key={hit.id}
                    value={hit.serial}
                    onSelect={() => {
                      router.push(`/machines/${hit.id}`);
                      onOpenChange(false);
                    }}
                    className="cursor-pointer rounded-sm px-md py-sm aria-selected:bg-surface-alt"
                  >
                    <span className="t-mono" dir="ltr">
                      <bdi>{hit.serial}</bdi>
                    </span>
                    {hit.matchedOn ? (
                      <span className="ms-sm t-caption text-text-secondary">
                        {t(
                          `web.machines.matchedOn.${hit.matchedOn}` as 'web.machines.matchedOn.MACHINE',
                        )}
                      </span>
                    ) : null}
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
