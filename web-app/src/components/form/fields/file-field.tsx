'use client';

import { useTranslations } from 'next-intl';
import { Controller, type FieldValues, type Path,useFormContext } from 'react-hook-form';

import { FieldShell } from '@/components/form/fields/field-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type FileFieldProps<T extends FieldValues> = {
  name: Path<T>;
  label?: string;
  required?: boolean;
  accept?: string;
  className?: string;
};

export function FileField<T extends FieldValues>({
  name,
  label,
  required,
  accept,
  className,
}: FileFieldProps<T>) {
  const t = useTranslations();
  const { control } = useFormContext<T>();

  return (
    <FieldShell name={String(name)} label={label} required={required} className={className}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => {
          const file = field.value && typeof field.value === 'object' && 'name' in field.value
            ? (field.value as File)
            : null;
          return (
            <div className="flex flex-wrap items-center gap-sm">
              <Input
                id={String(name)}
                type="file"
                accept={accept}
                className="max-w-full"
                onChange={(e) => field.onChange(e.target.files?.[0] ?? null)}
                aria-required={required || undefined}
              />
              {file ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => field.onChange(null)}>
                  {t('web.form.removeFile')}
                </Button>
              ) : (
                <span className="t-caption text-text-secondary">{t('web.form.upload')}</span>
              )}
            </div>
          );
        }}
      />
    </FieldShell>
  );
}
