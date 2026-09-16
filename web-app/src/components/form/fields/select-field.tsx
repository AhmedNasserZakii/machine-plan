'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Controller, type FieldValues, type Path,useFormContext } from 'react-hook-form';

import { FieldShell } from '@/components/form/fields/field-shell';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type SelectOption = { value: string; label: string };

type SelectFieldProps<T extends FieldValues> = {
  name: Path<T>;
  label?: string;
  required?: boolean;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  className?: string;
};

export function SelectField<T extends FieldValues>({
  name,
  label,
  required,
  options,
  placeholder,
  searchable,
  className,
}: SelectFieldProps<T>) {
  const t = useTranslations();
  const { control } = useFormContext<T>();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, query, searchable]);

  return (
    <FieldShell name={String(name)} label={label} required={required} className={className}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="space-y-xs">
            {searchable ? (
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('web.form.searchOptions')}
                aria-label={t('web.form.searchOptions')}
              />
            ) : null}
            <select
              id={String(name)}
              className={cn(
                'h-8 w-full rounded-lg border border-border bg-surface px-sm t-body outline-none focus-visible:ring-2 focus-visible:ring-primary',
              )}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value || undefined)}
              onBlur={field.onBlur}
              aria-required={required || undefined}
            >
              <option value="">{placeholder ?? t('web.form.selectPlaceholder')}</option>
              {filtered.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {searchable && filtered.length === 0 ? (
              <p className="t-caption text-text-secondary">{t('web.form.noOptions')}</p>
            ) : null}
          </div>
        )}
      />
    </FieldShell>
  );
}
