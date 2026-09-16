'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/feedback/page-header';
import { DetailSkeleton } from '@/components/feedback/skeletons';
import { AppForm } from '@/components/form/app-form';
import { SelectField } from '@/components/form/fields/select-field';
import { TextField } from '@/components/form/fields/text-field';
import { FormActions } from '@/components/form/form-actions';
import { FormSection } from '@/components/form/form-section';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/client';
import { ErrorCode } from '@/lib/api/error-codes';

import {
  useBranchesOptions,
  useCreateUserMutation,
  useRolesOptions,
  useUpdateUserMutation,
  useUserDetail,
} from '../hooks';
import { asText, generateTempPassword } from '../lib/value';
import { userFormSchema,type UserFormValues } from '../model';

type Props = { mode: 'create' | 'edit'; id?: string };

export function UserFormPage({ mode, id }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const isEdit = mode === 'edit';
  const detail = useUserDetail(isEdit && id ? id : '');
  const roles = useRolesOptions();
  const branches = useBranchesOptions();
  const createMutation = useCreateUserMutation();
  const updateMutation = useUpdateUserMutation(id ?? '');
  const [handoff, setHandoff] = useState<{ phone: string; password: string } | null>(null);

  const defaults = useMemo<UserFormValues>(() => {
    if (!isEdit || !detail.data) {
      return {
        fullName: '',
        phone: '',
        email: '',
        roleId: '',
        branchId: '',
        password: generateTempPassword(),
      };
    }
    return {
      fullName: detail.data.fullName,
      phone: detail.data.phone,
      email: asText(detail.data.email) ?? '',
      roleId: detail.data.role.id,
      branchId: asText(detail.data.branchId) ?? '',
      password: '',
    };
  }, [detail.data, isEdit]);

  const roleOptions = (roles.data ?? []).map((r) => ({ value: r.id, label: r.displayName }));
  const branchOptions = (branches.data ?? []).map((b) => ({ value: b.id, label: b.name }));

  if (isEdit && detail.isLoading) return <DetailSkeleton />;
  if (isEdit && (detail.error || !detail.data)) {
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  }

  return (
    <div className="space-y-md">
      <PageHeader
        title={isEdit ? t('web.users.editTitle') : t('web.users.createTitle')}
        subtitle={isEdit ? t('web.users.editSubtitle') : t('web.users.createSubtitle')}
      />

      <AppForm
        schema={userFormSchema}
        defaultValues={defaults}
        onSubmit={async (values) => {
          try {
            if (isEdit && id) {
              await updateMutation.mutateAsync({
                fullName: values.fullName,
                email: values.email || null,
                roleId: values.roleId,
                branchId: values.branchId || null,
              });
              toast.success(t('web.users.updated'));
              router.push(`/users/${id}`);
              return;
            }
            if (!values.password || values.password.length < 8) {
              toast.error(t('shared.password_min_eight'));
              return;
            }
            const created = await createMutation.mutateAsync({
              fullName: values.fullName,
              phone: values.phone,
              email: values.email || undefined,
              roleId: values.roleId,
              branchId: values.branchId || undefined,
              password: values.password,
            });
            setHandoff({ phone: values.phone, password: values.password });
            toast.success(t('web.users.created'));
            // keep id for navigation after ack
            (window as unknown as { __newUserId?: string }).__newUserId = created?.id;
          } catch (error) {
            if (error instanceof ApiError && error.code === ErrorCode.LAST_DIRECTOR) {
              toast.error(t('web.users.lastDirectorBody'));
              return;
            }
            toast.error(error instanceof ApiError ? error.message : t('web.errors.generic'));
          }
        }}
      >
        {(form) => (
          <>
            <FormSection title={t('web.users.profileSection')}>
              <TextField name="fullName" label={t('web.users.fullName')} required />
              <TextField
                name="phone"
                label={t('web.users.phone')}
                required
                disabled={isEdit}
                dir="ltr"
              />
              <TextField name="email" label={t('web.users.email')} dir="ltr" />
              <SelectField name="roleId" label={t('web.users.role')} required options={roleOptions} searchable />
              <SelectField name="branchId" label={t('web.users.branch')} options={branchOptions} searchable />
            </FormSection>
            {!isEdit ? (
              <FormSection title={t('web.users.credentialsSection')}>
                <p className="t-caption text-text-secondary">{t('web.users.mustChangeHint')}</p>
                <div className="flex flex-wrap items-end gap-sm">
                  <div className="min-w-[220px] flex-1">
                    <TextField name="password" label={t('web.users.initialPassword')} required dir="ltr" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.setValue('password', generateTempPassword(), { shouldValidate: true })}
                  >
                    {t('web.users.generate')}
                  </Button>
                </div>
              </FormSection>
            ) : null}
            <FormActions
              submitLabel={isEdit ? t('web.users.save') : t('web.users.create')}
              onCancel={() => router.push(isEdit && id ? `/users/${id}` : '/users')}
            />
          </>
        )}
      </AppForm>

      <ConfirmDialog
        open={Boolean(handoff)}
        onOpenChange={(next) => {
          if (!next && handoff) {
            const newId = (window as unknown as { __newUserId?: string }).__newUserId;
            setHandoff(null);
            router.push(newId ? `/users/${newId}` : '/users');
          }
        }}
        title={t('web.users.credentialsTitle')}
        description={
          handoff ? (
            <div className="space-y-sm">
              <p className="text-warning">{t('web.users.credentialsWarning')}</p>
              <p>
                {t('web.users.phone')}:{' '}
                <bdi dir="ltr" className="t-mono">
                  {handoff.phone}
                </bdi>
              </p>
              <p>
                {t('web.users.initialPassword')}:{' '}
                <bdi dir="ltr" className="t-mono">
                  {handoff.password}
                </bdi>
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(`${handoff.phone}\n${handoff.password}`);
                  toast.success(t('web.users.copied'));
                }}
              >
                {t('web.users.copyCredentials')}
              </Button>
            </div>
          ) : null
        }
        confirmLabel={t('web.users.credentialsAck')}
        onConfirm={() => {
          const newId = (window as unknown as { __newUserId?: string }).__newUserId;
          setHandoff(null);
          router.push(newId ? `/users/${newId}` : '/users');
        }}
      />
    </div>
  );
}
