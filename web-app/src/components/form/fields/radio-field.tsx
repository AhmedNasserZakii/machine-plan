'use client';

import { Controller, type FieldValues, type Path,useFormContext } from 'react-hook-form';

import { FieldShell } from '@/components/form/fields/field-shell';
import type { SelectOption } from '@/components/form/fields/select-field';

type RadioFieldProps<T extends FieldValues> = {
  name: Path<T>;
  label?: string;
  required?: boolean;
  options: SelectOption[];
  className?: string;
};

export function RadioField<T extends FieldValues>({
  name,
  label,
  required,
  options,
  className,
}: RadioFieldProps<T>) {
  const { control } = useFormContext<T>();
  return (
    <FieldShell name={String(name)} label={label} required={required} className={className}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div role="radiogroup" aria-required={required || undefined} className="flex flex-col gap-sm">
            {options.map((opt) => (
              <label key={opt.value} className="inline-flex items-center gap-sm t-body">
                <input
                  type="radio"
                  className="size-4 accent-primary"
                  name={String(name)}
                  value={opt.value}
                  checked={field.value === opt.value}
                  onChange={() => field.onChange(opt.value)}
                  onBlur={field.onBlur}
                />
                {opt.label}
              </label>
            ))}
          </div>
        )}
      />
    </FieldShell>
  );
}
