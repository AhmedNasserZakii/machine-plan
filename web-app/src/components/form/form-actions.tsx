'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';

import { useOptionalAppFormContext } from '@/components/form/app-form';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type FormActionsProps = {
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  secondary?: ReactNode;
  className?: string;
};

export function FormActions({
  submitLabel,
  cancelLabel,
  onCancel,
  secondary,
  className,
}: FormActionsProps) {
  const t = useTranslations();
  const form = useFormContext();
  const ctx = useOptionalAppFormContext();
  const pending = ctx?.pending ?? form.formState.isSubmitting;

  return (
    <div
      data-slot="page-actions"
      className={cn('flex flex-wrap items-center justify-end gap-sm border-t border-divider pt-md', className)}
    >
      {secondary}
      {onCancel ? (
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          {cancelLabel ?? t('web.form.cancel')}
        </Button>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('web.form.submitting')}
          </>
        ) : (
          (submitLabel ?? t('web.form.save'))
        )}
      </Button>
    </div>
  );
}
