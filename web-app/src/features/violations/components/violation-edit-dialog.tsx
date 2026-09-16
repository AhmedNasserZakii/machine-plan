'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { AppForm } from '@/components/form/app-form';
import { SelectField } from '@/components/form/fields/select-field';
import { TextareaField } from '@/components/form/fields/textarea-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api/client';
import { ErrorCode } from '@/lib/api/error-codes';

import { useUpdateViolationMutation } from '../hooks/use-violations';
import { violationEditSchema, type ViolationEditValues } from '../model/form-schema';
import { asText, type Violation } from '../model/types';

type ViolationEditDialogProps = {
  violation: Violation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImmutable: () => void;
};

export function ViolationEditDialog({
  violation,
  open,
  onOpenChange,
  onImmutable,
}: ViolationEditDialogProps) {
  const t = useTranslations();
  const mutation = useUpdateViolationMutation(violation.id);

  useEffect(() => {
    if (open && !violation.isEditable) {
      onImmutable();
    }
  }, [onImmutable, open, violation.isEditable]);

  if (!violation.isEditable) return null;

  const defaults: ViolationEditValues = {
    severity: violation.severity,
    description: asText(violation.description) ?? '',
  };

  const severityOptions = (['LOW', 'MEDIUM', 'HIGH'] as const).map((value) => ({
    value,
    label: t(`enums.severity.${value}`),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('shared.violation_edit_title')}</DialogTitle>
          <DialogDescription>{t('web.violations.editDescription')}</DialogDescription>
        </DialogHeader>
        <AppForm
          key={`${violation.id}-${open}`}
          schema={violationEditSchema}
          defaultValues={defaults}
          dirtyGuard={false}
          onSubmit={async (values) => {
            try {
              await mutation.mutateAsync({
                severity: values.severity,
                description: values.description,
              });
              toast.success(t('shared.violation_edit_done'));
              onOpenChange(false);
            } catch (err) {
              if (err instanceof ApiError && err.code === ErrorCode.AUTO_VIOLATION_IMMUTABLE) {
                onImmutable();
                return;
              }
              throw err;
            }
          }}
        >
          <div className="space-y-md">
            <SelectField
              name="severity"
              label={t('web.violations.severity')}
              required
              options={severityOptions}
            />
            <TextareaField
              name="description"
              label={t('shared.violation_description')}
              required
            />
          </div>
          <DialogFooter className="mt-md">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('shared.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {t('shared.violation_edit')}
            </Button>
          </DialogFooter>
        </AppForm>
      </DialogContent>
    </Dialog>
  );
}
