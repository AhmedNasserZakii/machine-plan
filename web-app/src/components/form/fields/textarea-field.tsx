'use client';

import { type FieldValues, type Path,useFormContext } from 'react-hook-form';

import { FieldShell } from '@/components/form/fields/field-shell';
import { Textarea } from '@/components/ui/textarea';

type TextareaFieldProps<T extends FieldValues> = {
  name: Path<T>;
  label?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  className?: string;
};

export function TextareaField<T extends FieldValues>({
  name,
  label,
  required,
  maxLength,
  placeholder,
  className,
}: TextareaFieldProps<T>) {
  const { register } = useFormContext<T>();
  return (
    <FieldShell name={String(name)} label={label} required={required} className={cnSpan(className)}>
      <Textarea
        id={String(name)}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-required={required || undefined}
        {...register(name)}
      />
    </FieldShell>
  );
}

function cnSpan(className?: string) {
  return className ? `md:col-span-2 ${className}` : 'md:col-span-2';
}
