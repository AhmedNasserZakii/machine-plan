'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { DateText } from '@/components/common/date-text';
import { PhoneText } from '@/components/common/phone-text';
import { SerialText } from '@/components/common/serial-text';
import { StatusChip } from '@/components/common/status-chip';
import { DetailPageScaffold } from '@/components/detail/detail-page-scaffold';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { DetailSkeleton, TableSkeleton } from '@/components/feedback/skeletons';
import { Button } from '@/components/ui/button';
import { AuditSection } from '@/features/audit/components';
import { UserViolationsPanel } from '@/features/violations/components';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/client';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { MACHINE_STATUS_TONE } from '@/lib/theme/status-tone';

import { useActivateUserMutation, useBranchesOptions, useUserCustody, useUserDetail } from '../hooks';
import { asText } from '../lib/value';
import { DeactivateUserDialog } from './deactivate-user-dialog';
import { PermissionOverrideEditor } from './permission-override-editor';
import { ResetPasswordDialog } from './reset-password-dialog';

function CustodyTab({ userId }: { userId: string }) {
  const t = useTranslations();
  const custody = useUserCustody(userId, { page: 1, limit: 50 });
  if (custody.isLoading) return <TableSkeleton rows={5} />;
  if (custody.error || !custody.data) {
    return <ErrorState error={custody.error} onRetry={() => void custody.refetch()} />;
  }
  const machines = custody.data.machines;
  if (!machines.length) {
    return <EmptyState title={t('web.users.custodyEmpty')} description={t('web.users.custodyEmptyBody')} />;
  }
  return (
    <div className="space-y-md">
      <p className="t-body text-text-secondary">
        {t('web.users.custodySummary', {
          total: custody.data.summary.totalMachines,
          inHand: custody.data.summary.inHand,
          withMerchants: custody.data.summary.withMerchants,
        })}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {machines.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-sm px-md py-sm">
            <div>
              <Link href={`/machines/${m.id}`} className="font-medium text-primary hover:underline">
                <SerialText value={m.serial} />
              </Link>
              <p className="t-caption text-text-secondary">{m.model}</p>
            </div>
            <StatusChip
              status={m.status}
              tone={MACHINE_STATUS_TONE[m.status] ?? 'neutral'}
              label={t(`enums.machineStatus.${m.status}` as 'enums.machineStatus.IN_TRANSIT')}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UserDetailPage({ id }: { id: string }) {
  const t = useTranslations();
  const { user: me, permissions } = useSession();
  const detail = useUserDetail(id);
  const branches = useBranchesOptions();
  const activate = useActivateUserMutation(id);
  const [resetOpen, setResetOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  const user = detail.data;
  const isSelf = me?.id === id;
  const branchName = useMemo(() => {
    const branchId = asText(user?.branchId);
    if (!branchId) return null;
    return branches.data?.find((b) => b.id === branchId)?.name ?? branchId;
  }, [branches.data, user?.branchId]);

  if (detail.isLoading) return <DetailSkeleton />;
  if (detail.error || !user) {
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  }

  const lastLogin = asText(user.lastLoginAt);

  return (
    <>
      <DetailPageScaffold
        title={user.fullName}
        subtitle={user.role.displayName}
        status={
          <StatusChip
            status={user.isActive ? 'ACTIVE' : 'INACTIVE'}
            tone={user.isActive ? 'success' : 'neutral'}
            label={user.isActive ? t('web.users.active') : t('web.users.inactive')}
          />
        }
        actions={
          <div className="flex flex-wrap items-center gap-sm">
            <Can perm={P.usersUpdate}>
              <Link
                href={`/users/${id}/edit`}
                className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 t-body hover:bg-surface-alt"
              >
                {t('web.users.edit')}
              </Link>
            </Can>
            <Can perm={P.usersUpdate}>
              <Button type="button" variant="outline" onClick={() => setResetOpen(true)}>
                {t('web.users.resetPassword')}
              </Button>
            </Can>
            <Can perm={P.usersDeactivate}>
              {user.isActive ? (
                <Button type="button" variant="destructive" onClick={() => setDeactivateOpen(true)}>
                  {t('web.users.deactivate')}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={async () => {
                    try {
                      await activate.mutateAsync();
                      toast.success(t('web.users.activated'));
                    } catch (error) {
                      toast.error(error instanceof ApiError ? error.message : t('web.errors.generic'));
                    }
                  }}
                  disabled={activate.isPending}
                >
                  {t('web.users.activate')}
                </Button>
              )}
            </Can>
          </div>
        }
        summary={
          <dl className="space-y-md">
            <div>
              <dt className="t-caption text-text-secondary">{t('web.users.phone')}</dt>
              <dd>
                <PhoneText value={user.phone} />
              </dd>
            </div>
            <div>
              <dt className="t-caption text-text-secondary">{t('web.users.role')}</dt>
              <dd>{user.role.displayName}</dd>
            </div>
            <div>
              <dt className="t-caption text-text-secondary">{t('web.users.branch')}</dt>
              <dd>{branchName ?? '—'}</dd>
            </div>
            <div>
              <dt className="t-caption text-text-secondary">{t('web.users.lastLogin')}</dt>
              <dd>{lastLogin ? <DateText value={lastLogin} /> : '—'}</dd>
            </div>
            <div>
              <dt className="t-caption text-text-secondary">{t('web.users.createdAt')}</dt>
              <dd>
                <DateText value={user.createdAt} />
              </dd>
            </div>
          </dl>
        }
        tabs={[
          {
            id: 'profile',
            label: t('web.users.tabProfile'),
            content: (
              <div className="rounded-md border border-border bg-surface p-md">
                <dl className="grid gap-md sm:grid-cols-2">
                  <div>
                    <dt className="t-caption text-text-secondary">{t('web.users.fullName')}</dt>
                    <dd>{user.fullName}</dd>
                  </div>
                  <div>
                    <dt className="t-caption text-text-secondary">{t('web.users.email')}</dt>
                    <dd>{asText(user.email) ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="t-caption text-text-secondary">{t('web.users.mustChangePassword')}</dt>
                    <dd>{user.mustChangePassword ? t('web.common.yes') : t('web.common.no')}</dd>
                  </div>
                </dl>
              </div>
            ),
          },
          {
            id: 'permissions',
            label: t('web.users.tabPermissions'),
            content: (
              <PermissionOverrideEditor
                userId={id}
                isSelf={isSelf}
                readOnly={!can(permissions, P.rolesManage)}
              />
            ),
          },
          {
            id: 'custody',
            label: t('web.users.tabCustody'),
            content: <CustodyTab userId={id} />,
          },
          {
            id: 'violations',
            label: t('web.users.tabViolations'),
            content: <UserViolationsPanel userId={id} />,
          },
          {
            id: 'audit',
            label: t('web.audit.sectionTitle'),
            content: <AuditSection entityType="user" entityId={id} />,
          },
        ]}
      />

      <ResetPasswordDialog userId={id} open={resetOpen} onOpenChange={setResetOpen} />
      <DeactivateUserDialog user={user} open={deactivateOpen} onOpenChange={setDeactivateOpen} />
    </>
  );
}
