'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/feedback/page-header';
import { AppForm } from '@/components/form/app-form';
import { DateField } from '@/components/form/fields/date-field';
import { SelectField } from '@/components/form/fields/select-field';
import { TextField } from '@/components/form/fields/text-field';
import { TextareaField } from '@/components/form/fields/textarea-field';
import { FormActions } from '@/components/form/form-actions';
import { FormSection } from '@/components/form/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { ErrorCode } from '@/lib/api/error-codes';

import { useCreateMaintenanceMutation } from '../hooks';
import { createMaintenanceSchema } from '../model';

export function MaintenanceFormPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillMachineId = searchParams.get('machineId') ?? '';
  const createMutation = useCreateMaintenanceMutation();
  const [machineSearch, setMachineSearch] = useState('');
  const [machineId, setMachineId] = useState(prefillMachineId);

  const locations = useQuery({
    queryKey: ['lookups', 'maintenance-locations'],
    queryFn: async () => {
      const result = await api.get<{ id: string; name: string }[]>(
        endpoints.lookups.maintenanceLocations,
        { limit: 100, isActive: true },
      );
      return Array.isArray(result.data) ? result.data : [];
    },
  });

  const machines = useQuery({
    queryKey: ['machines', 'picker', machineSearch],
    queryFn: async () => {
      const result = await api.get<{ id: string; serial: string; status: string }[]>(
        endpoints.machines.list,
        {
          search: machineSearch || undefined,
          limit: 20,
          status: [
            'IN_COMPANY_WAREHOUSE',
            'IN_BRANCH_WAREHOUSE',
            'WITH_SUPERVISOR',
            'WITH_REPRESENTATIVE',
            'WITH_MERCHANT',
          ],
        },
      );
      return Array.isArray(result.data) ? result.data : [];
    },
  });

  const locationOptions = useMemo(
    () => (locations.data ?? []).map((row) => ({ value: row.id, label: row.name })),
    [locations.data],
  );

  const defaults = useMemo(
    () => ({
      machineId: prefillMachineId,
      locationId: '',
      reportedFault: '',
      sentAt: new Date().toISOString().slice(0, 10),
      notes: undefined as string | undefined,
    }),
    [prefillMachineId],
  );

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('web.maintenance.createTitle')}
        subtitle={t('web.maintenance.createSubtitle')}
      />

      <AppForm
        schema={createMaintenanceSchema}
        defaultValues={defaults}
        onSubmit={async (values) => {
          try {
            const order = await createMutation.mutateAsync({
              machineId: values.machineId,
              locationId: values.locationId,
              reportedFault: values.reportedFault,
              sentAt: new Date(values.sentAt).toISOString(),
              notes: values.notes,
            });
            toast.success(t('web.maintenance.created'));
            router.push(`/maintenance/${order.id}`);
          } catch (error) {
            if (
              error instanceof ApiError &&
              error.code === ErrorCode.MACHINE_ALREADY_IN_MAINTENANCE
            ) {
              toast.error(t('errors.MACHINE_ALREADY_IN_MAINTENANCE'));
              return;
            }
            throw error;
          }
        }}
      >
        {(form) => (
          <>
            <FormSection title={t('web.maintenance.sectionOrder')}>
              <div className="space-y-xs">
                <Label htmlFor="machine-search">{t('web.machines.serial')}</Label>
                <Input
                  id="machine-search"
                  dir="ltr"
                  className="t-mono"
                  value={machineSearch}
                  onChange={(e) => setMachineSearch(e.target.value)}
                  placeholder={t('web.form.searchOptions')}
                />
                <select
                  className="h-8 w-full rounded-lg border border-border bg-surface px-sm t-body"
                  value={machineId}
                  onChange={(e) => {
                    setMachineId(e.target.value);
                    form.setValue('machineId', e.target.value, { shouldValidate: true });
                  }}
                >
                  <option value="">{t('web.form.selectPlaceholder')}</option>
                  {(machines.data ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.serial} · {m.status}
                    </option>
                  ))}
                </select>
              </div>
              <SelectField
                name="locationId"
                label={t('web.maintenance.location')}
                required
                options={locationOptions}
              />
              <TextareaField
                name="reportedFault"
                label={t('web.maintenance.reportedFault')}
                required
              />
              <DateField name="sentAt" label={t('web.maintenance.sentAt')} required />
              <TextareaField name="notes" label={t('web.maintenance.notes')} />
              <TextField name="machineId" label="" showIf={() => false} />
            </FormSection>
            <FormActions
              submitLabel={t('web.maintenance.create')}
              onCancel={() => router.push('/maintenance')}
            />
          </>
        )}
      </AppForm>
    </div>
  );
}
