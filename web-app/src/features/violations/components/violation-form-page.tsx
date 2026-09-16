'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { toast } from 'sonner';

import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/feedback/page-header';
import { DetailSkeleton } from '@/components/feedback/skeletons';
import { AppForm } from '@/components/form/app-form';
import { AsyncComboboxField } from '@/components/form/fields/async-combobox-field';
import { SelectField } from '@/components/form/fields/select-field';
import { TextareaField } from '@/components/form/fields/textarea-field';
import { FormActions } from '@/components/form/form-actions';
import { FormSection } from '@/components/form/form-section';
import { useRouter } from '@/i18n/navigation';
import { endpoints } from '@/lib/api/endpoints';
import { newIdempotencyKey } from '@/lib/api/idempotency';

import { useCreateViolationMutation, useViolationTypes } from '../hooks/use-violations';
import {
  violationFormDefaults,
  violationFormSchema,
  type ViolationFormValues,
} from '../model/form-schema';

function TypeSeveritySync({
  types,
}: {
  types: Array<{ id: string; defaultSeverity: 'LOW' | 'MEDIUM' | 'HIGH' }>;
}) {
  const { watch, setValue } = useFormContext<ViolationFormValues>();
  const typeId = watch('violationTypeId');

  useEffect(() => {
    if (!typeId) return;
    const match = types.find((row) => row.id === typeId);
    if (!match) return;
    // Type is a template: prefill severity, leave the field editable.
    setValue('severity', match.defaultSeverity, { shouldDirty: false });
  }, [setValue, typeId, types]);

  return null;
}

export function ViolationFormPage() {
  const t = useTranslations();
  const router = useRouter();
  const typesQuery = useViolationTypes();
  const createMutation = useCreateViolationMutation();

  const typeOptions = useMemo(
    () => (typesQuery.data ?? []).map((row) => ({ value: row.id, label: row.name })),
    [typesQuery.data],
  );

  const severityOptions = useMemo(
    () =>
      (['LOW', 'MEDIUM', 'HIGH'] as const).map((value) => ({
        value,
        label: t(`enums.severity.${value}`),
      })),
    [t],
  );

  if (typesQuery.isLoading) return <DetailSkeleton />;
  if (typesQuery.error) {
    return <ErrorState error={typesQuery.error} onRetry={() => void typesQuery.refetch()} />;
  }

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('shared.violation_raise_title')}
        subtitle={t('web.violations.createSubtitle')}
      />

      <AppForm
        schema={violationFormSchema}
        defaultValues={violationFormDefaults}
        onSubmit={async (values) => {
          const violation = await createMutation.mutateAsync({
            violationTypeId: values.violationTypeId,
            userId: values.userId,
            machineId: values.machineId,
            severity: values.severity,
            description: values.description,
            clientUuid: newIdempotencyKey(),
          });
          toast.success(t('shared.violation_raised'));
          router.push(`/violations/${violation.id}`);
        }}
      >
        <TypeSeveritySync types={typesQuery.data ?? []} />
        <FormSection title={t('web.violations.detailsSection')}>
          <SelectField
            name="violationTypeId"
            label={t('shared.violation_type')}
            required
            options={typeOptions}
            searchable
          />
          <SelectField
            name="severity"
            label={t('web.violations.severity')}
            required
            options={severityOptions}
          />
          <AsyncComboboxField
            name="userId"
            label={t('shared.violation_select_user')}
            required
            endpoint={endpoints.users.list}
            mapOption={(item) => ({
              value: String(item.id ?? ''),
              label: String(item.fullName ?? item.name ?? item.id ?? ''),
            })}
          />
          <AsyncComboboxField
            name="machineId"
            label={t('shared.violation_select_machine')}
            endpoint={endpoints.machines.list}
            mapOption={(item) => ({
              value: String(item.id ?? ''),
              label: String(item.serial ?? item.id ?? ''),
            })}
          />
          <TextareaField
            name="description"
            label={t('shared.violation_description')}
            required
          />
        </FormSection>
        <FormActions
          submitLabel={t('shared.violation_raise')}
          onCancel={() => router.push('/violations')}
        />
      </AppForm>
    </div>
  );
}
