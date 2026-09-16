'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Controller, type FieldValues, type Path,useFormContext } from 'react-hook-form';

import { FieldShell } from '@/components/form/fields/field-shell';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';

type Option = { value: string; label: string };

type AsyncComboboxFieldProps<T extends FieldValues> = {
  name: Path<T>;
  label?: string;
  required?: boolean;
  endpoint: string;
  mapOption?: (item: Record<string, unknown>) => Option;
  className?: string;
  debounceMs?: number;
};

function defaultMap(item: Record<string, unknown>): Option {
  const id = String(item.id ?? item.value ?? '');
  const label = String(item.name ?? item.label ?? item.title ?? id);
  return { value: id, label };
}

export function AsyncComboboxField<T extends FieldValues>({
  name,
  label,
  required,
  endpoint,
  mapOption = defaultMap,
  className,
  debounceMs = 300,
}: AsyncComboboxFieldProps<T>) {
  const t = useTranslations();
  const { control } = useFormContext<T>();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, query]);

  const { data: options = [], isFetching } = useQuery({
    queryKey: ['async-combobox', endpoint, debounced],
    queryFn: async () => {
      const result = await api.get<unknown>(
        endpoint,
        debounced ? { search: debounced, limit: 20 } : { limit: 20 },
      );
      const payload = result.data;
      const items = Array.isArray(payload)
        ? payload
        : payload && typeof payload === 'object' && 'items' in payload
          ? ((payload as { items: unknown[] }).items ?? [])
          : [];
      return items
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map(mapOption);
    },
    staleTime: 30_000,
  });

  return (
    <FieldShell name={String(name)} label={label} required={required} className={className}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="space-y-xs">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('web.form.searchOptions')}
              aria-label={t('web.form.searchOptions')}
            />
            <select
              id={String(name)}
              className={cn(
                'h-8 w-full rounded-lg border border-border bg-surface px-sm t-body outline-none focus-visible:ring-2 focus-visible:ring-primary',
              )}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value || undefined)}
              onBlur={field.onBlur}
              aria-required={required || undefined}
              aria-busy={isFetching || undefined}
            >
              <option value="">{t('web.form.selectPlaceholder')}</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {!isFetching && options.length === 0 ? (
              <p className="t-caption text-text-secondary">{t('web.form.noOptions')}</p>
            ) : null}
          </div>
        )}
      />
    </FieldShell>
  );
}
