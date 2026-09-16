'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function AuditDiff({ before, after }: { before: unknown; after: unknown }) {
  const t = useTranslations();
  const b = asRecord(before);
  const a = asRecord(after);
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();

  if (!keys.length) {
    return <p className="t-caption text-text-secondary">{t('web.audit.noDiff')}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-start">
        <thead className="bg-surface-alt t-caption text-text-secondary">
          <tr>
            <th className="px-md py-sm font-medium">{t('web.audit.field')}</th>
            <th className="px-md py-sm font-medium">{t('web.audit.before')}</th>
            <th className="px-md py-sm font-medium">{t('web.audit.after')}</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const left = formatValue(b[key]);
            const right = formatValue(a[key]);
            const changed = left !== right;
            return (
              <tr key={key} className="border-t border-border">
                <td className="px-md py-sm t-mono" dir="ltr">
                  {key}
                </td>
                <td className={cn('px-md py-sm', changed && 'bg-danger-surface/40')}>{left}</td>
                <td className={cn('px-md py-sm', changed && 'bg-success-surface/40')}>{right}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
