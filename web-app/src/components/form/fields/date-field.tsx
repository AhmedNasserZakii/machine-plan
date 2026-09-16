'use client';

import { Controller, type FieldValues, type Path,useFormContext } from 'react-hook-form';

import { FieldShell } from '@/components/form/fields/field-shell';
import { Input } from '@/components/ui/input';

type DateFieldProps<T extends FieldValues> = {
  name: Path<T>;
  label?: string;
  required?: boolean;
  minDate?: string;
  maxDate?: string;
  className?: string;
};

/** Stores `yyyy-MM-dd`; native date input displays per browser locale / dir. */
export function DateField<T extends FieldValues>({
  name,
  label,
  required,
  minDate,
  maxDate,
  className,
}: DateFieldProps<T>) {
  const { control } = useFormContext<T>();
  return (
    <FieldShell name={String(name)} label={label} required={required} className={className}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            id={String(name)}
            type="date"
            dir="ltr"
            className="t-mono"
            min={minDate}
            max={maxDate}
            value={field.value ?? ''}
            onChange={(e) => field.onChange(e.target.value || undefined)}
            onBlur={field.onBlur}
            aria-required={required || undefined}
          />
        )}
      />
    </FieldShell>
  );
}
