'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';

import { PhoneText } from '@/components/common/phone-text';
import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/feedback/page-header';
import { DetailSkeleton } from '@/components/feedback/skeletons';
import { AppForm } from '@/components/form/app-form';
import { TextField } from '@/components/form/fields/text-field';
import { TextareaField } from '@/components/form/fields/textarea-field';
import { FormActions } from '@/components/form/form-actions';
import { FormSection } from '@/components/form/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/client';
import { ErrorCode } from '@/lib/api/error-codes';

import {
  useCreateMerchantMutation,
  useMerchantCheck,
  useMerchantDetail,
  useUpdateMerchantMutation,
} from '../hooks';
import { asText } from '../lib/value';
import {
  merchantFormDefaults,
  merchantFormSchema,
  type MerchantFormValues,
  type MerchantListItem,
} from '../model';

type MerchantFormPageProps = {
  mode: 'create' | 'edit';
  id?: string;
};

export function MerchantFormPage({ mode, id }: MerchantFormPageProps) {
  const t = useTranslations();
  const router = useRouter();
  const isEdit = mode === 'edit';
  const detail = useMerchantDetail(isEdit && id ? id : '');
  const createMutation = useCreateMerchantMutation();
  const updateMutation = useUpdateMerchantMutation(id ?? '');
  const checkMutation = useMerchantCheck();
  const [duplicates, setDuplicates] = useState<MerchantListItem[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<string[]>([]);
  const [ackDuplicate, setAckDuplicate] = useState(false);

  const defaults = useMemo<MerchantFormValues>(() => {
    if (!isEdit || !detail.data) return merchantFormDefaults;
    const m = detail.data;
    return {
      name: m.name,
      phone: m.phone,
      shopName: m.shopName,
      address: asText(m.address) ?? '',
      nationalId: asText(m.nationalId) ?? undefined,
      notes: asText(m.notes) ?? undefined,
    };
  }, [detail.data, isEdit]);

  if (isEdit && detail.isLoading) return <DetailSkeleton />;
  if (isEdit && (detail.error || !detail.data)) {
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  }

  const runCheck = async (values: Pick<MerchantFormValues, 'phone' | 'nationalId'>) => {
    if (!values.phone || !/^01[0125][0-9]{8}$/.test(values.phone)) {
      setDuplicates([]);
      setDuplicateWarnings([]);
      return;
    }
    try {
      const result = await checkMutation.mutateAsync({
        phone: values.phone,
        nationalId: values.nationalId || undefined,
      });
      setDuplicates(result.existing ?? []);
      setDuplicateWarnings(result.warnings ?? []);
      if (!(result.existing?.length)) setAckDuplicate(false);
    } catch {
      /* pre-check is best-effort */
    }
  };

  return (
    <div className="space-y-md">
      <PageHeader
        title={isEdit ? t('web.merchants.editTitle') : t('web.merchants.createTitle')}
        subtitle={isEdit ? t('web.merchants.editSubtitle') : t('web.merchants.createSubtitle')}
      />

      <AppForm
        key={isEdit ? id : 'new'}
        schema={merchantFormSchema}
        defaultValues={defaults}
        onSubmit={async (values) => {
          if (duplicates.length && !ackDuplicate && !isEdit) {
            toast.error(t('web.merchants.acknowledgeDuplicate'));
            return;
          }
          try {
            if (isEdit && id) {
              const merchant = await updateMutation.mutateAsync({
                name: values.name,
                phone: values.phone,
                shopName: values.shopName,
                address: values.address,
                nationalId: values.nationalId,
                notes: values.notes,
              });
              toast.success(t('web.merchants.saved'));
              router.push(`/merchants/${merchant.id}`);
              return;
            }
            const merchant = await createMutation.mutateAsync({
              name: values.name,
              phone: values.phone,
              shopName: values.shopName,
              address: values.address,
              nationalId: values.nationalId,
              notes: values.notes,
            });
            toast.success(t('web.merchants.created'));
            router.push(`/merchants/${merchant.id}`);
          } catch (error) {
            if (error instanceof ApiError && error.code === ErrorCode.DUPLICATE_NATIONAL_ID) {
              throw new ApiError(
                error.status,
                error.code,
                t('errors.DUPLICATE_NATIONAL_ID'),
                [{ field: 'nationalId', constraint: t('errors.DUPLICATE_NATIONAL_ID') }],
                error.requestId,
              );
            }
            throw error;
          }
        }}
      >
        {(form) => (
          <>
            <FormSection title={t('web.merchants.sectionIdentity')}>
              <TextField name="name" label={t('web.merchants.name')} required />
              <div className="space-y-xs">
                <Label htmlFor="nationalId">{t('web.merchants.nationalId')}</Label>
                <Controller
                  control={form.control}
                  name="nationalId"
                  render={({ field }) => (
                    <Input
                      id="nationalId"
                      dir="ltr"
                      className="t-mono"
                      inputMode="numeric"
                      maxLength={14}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || undefined)}
                      onBlur={() => {
                        field.onBlur();
                        void runCheck({
                          phone: form.getValues('phone'),
                          nationalId: form.getValues('nationalId'),
                        });
                      }}
                    />
                  )}
                />
              </div>
              <div className="space-y-xs">
                <Label htmlFor="phone">{t('web.merchants.phone')}</Label>
                <Controller
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <Input
                      id="phone"
                      dir="ltr"
                      className="t-mono"
                      inputMode="tel"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={() => {
                        field.onBlur();
                        void runCheck({
                          phone: form.getValues('phone'),
                          nationalId: form.getValues('nationalId'),
                        });
                      }}
                    />
                  )}
                />
              </div>
            </FormSection>

            <FormSection title={t('web.merchants.sectionShop')}>
              <TextField name="shopName" label={t('web.merchants.shopName')} required />
              <TextareaField name="address" label={t('web.merchants.address')} required />
              <TextareaField name="notes" label={t('web.merchants.notes')} />
            </FormSection>

            {duplicates.length > 0 ? (
              <div
                className="space-y-sm rounded-md border border-warning bg-warning-surface p-md"
                role="status"
              >
                <p className="t-body font-medium text-warning">
                  {t('web.merchants.duplicateFound')}
                </p>
                <ul className="space-y-xs">
                  {duplicates.map((row) => (
                    <li key={row.id} className="flex flex-wrap items-center gap-sm t-body">
                      <Link href={`/merchants/${row.id}`} className="text-primary hover:underline">
                        {row.name} · {row.shopName}
                      </Link>
                      <PhoneText value={row.phone} />
                    </li>
                  ))}
                </ul>
                {duplicateWarnings.includes('DUPLICATE_NATIONAL_ID') ? (
                  <p className="t-caption text-text-secondary">
                    {t('web.merchants.duplicateNationalIdHint')}
                  </p>
                ) : null}
                {!isEdit ? (
                  <label className="flex items-center gap-sm t-body">
                    <input
                      type="checkbox"
                      checked={ackDuplicate}
                      onChange={(e) => setAckDuplicate(e.target.checked)}
                    />
                    {t('web.merchants.continueAnyway')}
                  </label>
                ) : null}
              </div>
            ) : null}

            <FormActions
              submitLabel={isEdit ? t('web.form.save') : t('web.merchants.create')}
              onCancel={() =>
                router.push(isEdit && id ? `/merchants/${id}` : '/merchants')
              }
            />
          </>
        )}
      </AppForm>
    </div>
  );
}
