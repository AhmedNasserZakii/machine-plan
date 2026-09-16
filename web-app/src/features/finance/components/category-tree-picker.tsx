'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { type FlatCategory,flattenCategories } from '../lib/categories';
import type { FinanceCategory, FinanceKind } from '../model';

type CategoryTreePickerProps = {
  tree: FinanceCategory[];
  value?: string;
  onChange: (id: string) => void;
  kind?: FinanceKind;
  /** When true, only nodes without children can be selected. */
  leavesOnly?: boolean;
  className?: string;
  id?: string;
};

export function CategoryTreePicker({
  tree,
  value,
  onChange,
  kind,
  leavesOnly = false,
  className,
  id,
}: CategoryTreePickerProps) {
  const t = useTranslations();
  const [search, setSearch] = useState('');

  const options = useMemo(() => {
    let rows = flattenCategories(tree);
    if (kind) rows = rows.filter((r) => r.kind === kind);
    if (leavesOnly) rows = rows.filter((r) => !r.hasChildren && r.isActive);
    else rows = rows.filter((r) => r.isActive);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) => r.name.toLowerCase().includes(q) || r.pathLabel.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [tree, kind, leavesOnly, search]);

  return (
    <div className={cn('space-y-xs', className)}>
      <Input
        id={id ? `${id}-search` : undefined}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('shared.finance_search_categories')}
        aria-label={t('shared.finance_search_categories')}
      />
      <select
        id={id}
        className="h-8 w-full rounded-lg border border-border bg-surface px-sm t-body outline-none focus-visible:ring-2 focus-visible:ring-primary"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t('shared.finance_choose_category')}</option>
        {options.map((row: FlatCategory) => (
          <option key={row.id} value={row.id}>
            {'\u00A0'.repeat(row.depth * 2)}
            {row.pathLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
