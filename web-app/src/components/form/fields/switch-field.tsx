'use client';

import { Controller, type FieldValues, type Path,useFormContext } from 'react-hook-form';

import { FieldShell } from '@/components/form/fields/field-shell';

type SwitchFieldProps<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  className?: string;
};

export function SwitchField<T extends FieldValues>({ name, label, className }: SwitchFieldProps<T>) {
  const { control } = useFormContext<T>();
  return (
    <FieldShell name={String(name)} className={className}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <label className="inline-flex items-center gap-sm t-body">
            <input
              id={String(name)}
              type="checkbox"
              role="switch"
              className="size-4 accent-primary"
              checked={!!field.value}
              onChange={(e) => field.onChange(e.target.checked)}
              onBlur={field.onBlur}
            />
            {label}
          </label>
        )}
      />
    </FieldShell>
  );
}
