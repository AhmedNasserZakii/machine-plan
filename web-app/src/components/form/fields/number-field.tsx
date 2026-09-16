'use client';

import { Controller, type FieldValues, type Path,useFormContext } from 'react-hook-form';

import { FieldShell } from '@/components/form/fields/field-shell';
import { Input } from '@/components/ui/input';

type NumberFieldProps<T extends FieldValues> = {
  name: Path<T>;
  label?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
};

export function NumberField<T extends FieldValues>({
  name,
  label,
  required,
  min,
  max,
  step,
  className,
}: NumberFieldProps<T>) {
  const { control } = useFormContext<T>();
  return (
    <FieldShell name={String(name)} label={label} required={required} className={className}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            id={String(name)}
            type="number"
            dir="ltr"
            className="t-mono"
            min={min}
            max={max}
            step={step}
            value={field.value ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              field.onChange(v === '' ? undefined : Number(v));
            }}
            onBlur={field.onBlur}
            aria-required={required || undefined}
          />
        )}
      />
    </FieldShell>
  );
}
