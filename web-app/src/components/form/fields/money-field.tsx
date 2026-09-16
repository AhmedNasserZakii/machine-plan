'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, type FieldValues, type Path,useFormContext } from 'react-hook-form';

import { FieldShell } from '@/components/form/fields/field-shell';
import { Input } from '@/components/ui/input';
import { formatNumber } from '@/lib/format';

type MoneyFieldProps<T extends FieldValues> = {
  name: Path<T>;
  label?: string;
  required?: boolean;
  currency?: string;
  className?: string;
};

function parseMoneyInput(raw: string): number | undefined {
  const cleaned = raw.replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

export function MoneyField<T extends FieldValues>({
  name,
  label,
  required,
  currency = 'EGP',
  className,
}: MoneyFieldProps<T>) {
  const t = useTranslations();
  const locale = useLocale();
  const { control } = useFormContext<T>();
  const [focused, setFocused] = useState(false);

  return (
    <FieldShell
      name={String(name)}
      label={label}
      required={required}
      className={className}
      hint={currency === 'EGP' ? t('web.form.currencyEgp') : currency}
    >
      <Controller
        control={control}
        name={name}
        render={({ field }) => {
          const numeric = typeof field.value === 'number' ? field.value : undefined;
          const display =
            focused || numeric === undefined
              ? field.value === undefined || field.value === null
                ? ''
                : String(field.value)
              : formatNumber(numeric, locale);

          return (
            <Input
              id={String(name)}
              dir="ltr"
              inputMode="decimal"
              className="t-mono"
              value={
                focused
                  ? (typeof field.value === 'number' || typeof field.value === 'string'
                      ? String(field.value)
                      : '')
                  : display
              }
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                const parsed = parseMoneyInput(String(field.value ?? ''));
                field.onChange(parsed);
                field.onBlur();
              }}
              onChange={(e) => {
                const raw = e.target.value;
                // Reject locale decimal ambiguity: only `.` as decimal separator.
                if (/[٬,]/u.test(raw)) return;
                field.onChange(raw);
              }}
              aria-required={required || undefined}
            />
          );
        }}
      />
    </FieldShell>
  );
}
