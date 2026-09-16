'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { SerialText } from '@/components/common/serial-text';
import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/feedback/page-header';
import { DetailSkeleton } from '@/components/feedback/skeletons';
import { AppForm } from '@/components/form/app-form';
import { DateField } from '@/components/form/fields/date-field';
import { MoneyField } from '@/components/form/fields/money-field';
import { SelectField } from '@/components/form/fields/select-field';
import { SwitchField } from '@/components/form/fields/switch-field';
import { TextField } from '@/components/form/fields/text-field';
import { TextareaField } from '@/components/form/fields/textarea-field';
import { FormActions } from '@/components/form/form-actions';
import { FormSection } from '@/components/form/form-section';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/client';
import { ErrorCode } from '@/lib/api/error-codes';

import { machinesApi } from '../api/machines.api';
import {
  useCreateMachineMutation,
  useMachineDetailQuery,
  useMachineModelsQuery,
  useMachineTypesQuery,
  useUpdateMachineMutation,
} from '../hooks';
import { asNumber, asText } from '../lib/value';
import {
  createMachineFormSchema,
  machineFormDefaults,
  type MachineFormValues,
} from '../model';

const SERIAL_CONFLICT: Record<string, keyof MachineFormValues> = {
  [ErrorCode.SERIAL_EXISTS]: 'serial',
  [ErrorCode.BATTERY_SERIAL_EXISTS]: 'batterySerial',
  [ErrorCode.SIM_SERIAL_EXISTS]: 'simSerial',
  [ErrorCode.BOX_SERIAL_EXISTS]: 'boxSerial',
};

type MachineFormPageProps = {
  mode: 'create' | 'edit';
  id?: string;
};

export function MachineFormPage({ mode, id }: MachineFormPageProps) {
  const t = useTranslations();
  const router = useRouter();
  const isEdit = mode === 'edit';
  const detail = useMachineDetailQuery(isEdit ? id : undefined);
  const typesQuery = useMachineTypesQuery();
  const createMutation = useCreateMachineMutation();
  const updateMutation = useUpdateMachineMutation(id ?? '');

  const [typeId, setTypeId] = useState('');
  const [conflictLinks, setConflictLinks] = useState<Partial<Record<keyof MachineFormValues, string>>>(
    {},
  );
  const modelsQuery = useMachineModelsQuery(typeId || undefined);

  const requiresSim = useMemo(() => {
    const type = (typesQuery.data ?? []).find((row) => row.id === typeId);
    return type?.requiresSim ?? true;
  }, [typeId, typesQuery.data]);

  const schema = useMemo(() => createMachineFormSchema(requiresSim), [requiresSim]);

  const defaults = useMemo<MachineFormValues>(() => {
    if (!isEdit || !detail.data) return machineFormDefaults;
    const m = detail.data;
    return {
      serial: m.serial,
      batterySerial: m.battery?.serial ?? '',
      simSerial: asText(m.simSerial) ?? undefined,
      boxSerial: asText(m.boxSerial) ?? undefined,
      machineTypeId: m.type.id,
      machineModelId: m.model.id,
      purchasePrice: asNumber(m.purchase.price) ?? undefined,
      purchaseDate: asText(m.purchase.date) ?? undefined,
      factoryInvoiceNo: asText(m.purchase.invoiceNo) ?? undefined,
      warrantyStart: asText(m.warranty.start) ?? undefined,
      warrantyEnd: asText(m.warranty.end) ?? undefined,
      hasBox: m.hasBox,
      notes: asText(m.notes) ?? undefined,
    };
  }, [detail.data, isEdit]);

  useEffect(() => {
    if (defaults.machineTypeId) setTypeId(defaults.machineTypeId);
  }, [defaults.machineTypeId]);

  if (isEdit && detail.isLoading) return <DetailSkeleton />;
  if (isEdit && (detail.error || !detail.data)) {
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  }

  const today = new Date().toISOString().slice(0, 10);
  const typeOptions = (typesQuery.data ?? []).map((row) => ({ value: row.id, label: row.name }));
  const modelOptions = (modelsQuery.data ?? []).map((row) => ({ value: row.id, label: row.name }));

  return (
    <div className="space-y-md">
      <PageHeader
        title={isEdit ? t('web.machines.editTitle') : t('web.machines.createTitle')}
        subtitle={isEdit ? t('web.machines.editSubtitle') : t('web.machines.createSubtitle')}
      />

      <AppForm
        key={`${isEdit ? id : 'new'}-${requiresSim}-${defaults.machineModelId}`}
        schema={schema}
        defaultValues={defaults}
        onSubmit={async (values) => {
          setConflictLinks({});
          try {
            if (isEdit && id) {
              const machine = await updateMutation.mutateAsync(values);
              toast.success(t('web.machines.saved'));
              router.push(`/machines/${machine.id}`);
              return;
            }
            const machine = await createMutation.mutateAsync(values);
            toast.success(t('web.machines.created'));
            router.push(`/machines/${machine.id}`);
          } catch (error) {
            if (error instanceof ApiError) {
              const field = SERIAL_CONFLICT[error.code];
              if (field) {
                let href: string | undefined;
                const serialMatch = error.message.match(/[A-Za-z0-9._-]{4,}/);
                try {
                  if (error.code === ErrorCode.SERIAL_EXISTS && serialMatch?.[0]) {
                    const found = await machinesApi.bySerial(serialMatch[0]);
                    href = `/machines/${found.data.id}`;
                  } else if (serialMatch?.[0]) {
                    const found = await machinesApi.lookup(serialMatch[0]);
                    href = `/machines/${found.data.machine.id}`;
                  }
                } catch {
                  /* best-effort */
                }
                if (href) setConflictLinks({ [field]: href });
                throw new ApiError(
                  error.status,
                  error.code,
                  error.message,
                  [{ field, constraint: error.message }],
                  error.requestId,
                  error.retryAfterSeconds,
                );
              }
            }
            throw error;
          }
        }}
      >
        {(form) => (
          <TypeSync form={form} typeId={typeId} onTypeId={setTypeId}>
            <FormSection title={t('web.machines.sectionIdentity')}>
              {isEdit ? (
                <>
                  <ReadOnlySerial label={t('web.machines.serial')} value={defaults.serial} hint={t('web.machines.serialImmutable')} />
                  <ReadOnlySerial label={t('web.machines.batterySerial')} value={defaults.batterySerial} />
                  {requiresSim ? (
                    <ReadOnlySerial label={t('web.machines.simSerial')} value={defaults.simSerial ?? '—'} />
                  ) : null}
                  <ReadOnlySerial label={t('web.machines.boxSerial')} value={defaults.boxSerial ?? '—'} />
                  {/* Keep values in form state for schema, but locked */}
                  <input type="hidden" {...form.register('serial')} />
                  <input type="hidden" {...form.register('batterySerial')} />
                  <input type="hidden" {...form.register('simSerial')} />
                  <input type="hidden" {...form.register('boxSerial')} />
                  <input type="hidden" {...form.register('hasBox')} />
                </>
              ) : (
                <>
                  <TextField name="serial" label={t('web.machines.serial')} required mono dir="ltr" />
                  <TextField name="batterySerial" label={t('web.machines.batterySerial')} required mono dir="ltr" />
                  {requiresSim ? (
                    <TextField name="simSerial" label={t('web.machines.simSerial')} required mono dir="ltr" />
                  ) : null}
                  <TextField name="boxSerial" label={t('web.machines.boxSerial')} mono dir="ltr" />
                  <SwitchField name="hasBox" label={t('web.machines.hasBox')} />
                </>
              )}
              {Object.entries(conflictLinks).map(([field, href]) =>
                href ? (
                  <p key={field} className="t-caption md:col-span-2">
                    <Link href={href} className="text-primary hover:underline">
                      {t('web.machines.viewConflict')}
                    </Link>
                  </p>
                ) : null,
              )}
            </FormSection>

            <FormSection title={t('web.machines.sectionClassification')}>
              {isEdit ? (
                <>
                  <div className="space-y-xs">
                    <p className="t-caption text-text-secondary">{t('web.machines.type')}</p>
                    <p>{detail.data?.type.name}</p>
                    <input type="hidden" {...form.register('machineTypeId')} />
                  </div>
                  <SelectField
                    name="machineModelId"
                    label={t('web.machines.model')}
                    required
                    options={modelOptions}
                    searchable
                  />
                </>
              ) : (
                <>
                  <SelectField
                    name="machineTypeId"
                    label={t('web.machines.type')}
                    required
                    options={typeOptions}
                    searchable
                  />
                  <SelectField
                    name="machineModelId"
                    label={t('web.machines.model')}
                    required
                    options={modelOptions}
                    searchable
                  />
                </>
              )}
            </FormSection>

            <FormSection title={t('web.machines.sectionPurchase')}>
              <MoneyField name="purchasePrice" label={t('web.machines.purchasePrice')} />
              <DateField name="purchaseDate" label={t('web.machines.purchaseDate')} maxDate={today} />
              <TextField name="factoryInvoiceNo" label={t('web.machines.invoiceNo')} mono dir="ltr" />
            </FormSection>

            <FormSection title={t('web.machines.sectionWarranty')}>
              <DateField name="warrantyStart" label={t('web.machines.warrantyStart')} />
              <DateField name="warrantyEnd" label={t('web.machines.warrantyEnd')} />
            </FormSection>

            <FormSection title={t('web.machines.sectionNotes')}>
              <TextareaField name="notes" label={t('web.machines.notes')} />
            </FormSection>

            <FormActions
              submitLabel={isEdit ? t('web.form.save') : t('web.machines.createSubmit')}
              onCancel={() => router.push(isEdit && id ? `/machines/${id}` : '/machines')}
            />
          </TypeSync>
        )}
      </AppForm>
    </div>
  );
}

function ReadOnlySerial({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="space-y-xs">
      <p className="t-caption text-text-secondary">{label}</p>
      {value === '—' ? <p>—</p> : <SerialText value={value} />}
      {hint ? <p className="t-caption text-text-secondary" title={hint}>{hint}</p> : null}
    </div>
  );
}

function TypeSync({
  form,
  typeId,
  onTypeId,
  children,
}: {
  form: { watch: (name: 'machineTypeId') => string; setValue: (name: 'machineModelId', value: string) => void };
  typeId: string;
  onTypeId: (id: string) => void;
  children: React.ReactNode;
}) {
  const watchedType = form.watch('machineTypeId');
  useEffect(() => {
    if (!watchedType || watchedType === typeId) return;
    onTypeId(watchedType);
    form.setValue('machineModelId', '');
  }, [form, onTypeId, typeId, watchedType]);
  return <>{children}</>;
}
