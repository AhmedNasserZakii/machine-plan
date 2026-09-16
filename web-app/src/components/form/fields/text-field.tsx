'use client';

import { type FieldValues, type Path,useFormContext } from 'react-hook-form';

import { FieldShell } from '@/components/form/fields/field-shell';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type TextFieldProps<T extends FieldValues> = {
  name: Path<T>;
  label?: string;
  required?: boolean;
  placeholder?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  mono?: boolean;
  type?: string;
  disabled?: boolean;
  className?: string;
  showIf?: (values: T) => boolean;
};

export function TextField<T extends FieldValues>({
  name,
  label,
  required,
  placeholder,
  dir,
  mono,
  type = 'text',
  disabled,
  className,
  showIf,
}: TextFieldProps<T>) {
  const { register, watch } = useFormContext<T>();
  const values = watch();
  if (showIf && !showIf(values)) return null;

  return (
    <FieldShell name={String(name)} label={label} required={required} className={className}>
      <Input
        id={String(name)}
        type={type}
        dir={dir}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(mono && 't-mono')}
        aria-required={required || undefined}
        {...register(name)}
      />
    </FieldShell>
  );
}
