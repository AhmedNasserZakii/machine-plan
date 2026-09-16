'use client';

import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Circle,
  Eye,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { DateText } from '@/components/common/date-text';
import { Money } from '@/components/common/money';
import { SerialText } from '@/components/common/serial-text';
import { StatusChip } from '@/components/common/status-chip';
import { UserChip } from '@/components/common/user-chip';
import { DetailPageScaffold } from '@/components/detail/detail-page-scaffold';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { DetailSkeleton } from '@/components/feedback/skeletons';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/client';
import { can, canAll } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { SEVERITY_TONE, VIOLATION_STATUS_TONE } from '@/lib/theme/status-tone';

import { useAcknowledgeViolationMutation, useViolationDetail } from '../hooks/use-violations';
import {
  asNumber,
  asText,
  canAcknowledgeViolation,
  canChargeViolation,
  canWaiveViolation,
  isViolationSettled,
  type Violation,
  type ViolationSeverity,
  type ViolationStatus,
} from '../model/types';
import { ViolationChargeDialog } from './violation-charge-dialog';
import { ViolationEditDialog } from './violation-edit-dialog';
import { ViolationWaiveDialog } from './violation-waive-dialog';

const STATUS_ICON: Record<ViolationStatus, LucideIcon> = {
  OPEN: AlertCircle,
  ACKNOWLEDGED: Eye,
  WAIVED: Ban,
  CHARGED: Wallet,
  CLOSED: CheckCircle2,
};

const SEVERITY_ICON: Record<ViolationSeverity, LucideIcon> = {
  LOW: Circle,
  MEDIUM: AlertCircle,
  HIGH: AlertCircle,
};

function StatusHistory({ violation }: { violation: Violation }) {
  const t = useTranslations();
  const events = [
    {
      id: 'created',
      label: t('web.violations.timelineRaised'),
      at: violation.createdAt,
    },
    asText(violation.acknowledgedAt)
      ? {
          id: 'acked',
          label: t('web.violations.timelineAcknowledged'),
          at: asText(violation.acknowledgedAt)!,
        }
      : null,
    asText(violation.chargedAt)
      ? {
          id: 'charged',
          label: t('web.violations.timelineCharged'),
          at: asText(violation.chargedAt)!,
        }
      : null,
    asText(violation.resolvedAt) && violation.status === 'WAIVED'
      ? {
          id: 'waived',
          label: t('web.violations.timelineWaived'),
          at: asText(violation.resolvedAt)!,
          detail: asText(violation.waiverReason),
        }
      : null,
    asText(violation.resolvedAt) && violation.status === 'CLOSED'
      ? {
          id: 'closed',
          label: t('web.violations.timelineClosed'),
          at: asText(violation.resolvedAt)!,
        }
      : null,
  ].filter(Boolean) as Array<{ id: string; label: string; at: string; detail?: string | null }>;

  return (
    <ol className="space-y-md">
      {events.map((event) => (
        <li key={event.id} className="border-s-2 border-primary ps-md">
          <p className="t-label">{event.label}</p>
          <DateText value={event.at} format="datetime" className="t-caption text-text-secondary" />
          {event.detail ? <p className="t-caption text-text-secondary">{event.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function ViolationDetailPage({ id }: { id: string }) {
  const t = useTranslations();
  const { user, permissions } = useSession();
  const query = useViolationDetail(id);
  const acknowledge = useAcknowledgeViolationMutation(id);

  const [ackOpen, setAckOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [waiveOpen, setWaiveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [banner, setBanner] = useState<'alreadyCharged' | 'immutable' | null>(null);

  const violation = query.data;

  const showAck = useMemo(
    () => (violation ? canAcknowledgeViolation(violation, user?.id) : false),
    [user?.id, violation],
  );

  const showCharge = useMemo(() => {
    if (!violation) return false;
    return (
      canChargeViolation(violation.status) &&
      canAll(permissions, [P.violationsResolve, P.financeCreate])
    );
  }, [permissions, violation]);

  const showWaive = useMemo(() => {
    if (!violation) return false;
    return canWaiveViolation(violation.status) && can(permissions, P.violationsWaive);
  }, [permissions, violation]);

  const showEdit = useMemo(() => {
    if (!violation) return false;
    return violation.isEditable && !isViolationSettled(violation.status) && can(permissions, P.violationsResolve);
  }, [permissions, violation]);

  if (query.isLoading) return <DetailSkeleton />;
  if (query.error) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (!violation) {
    return (
      <EmptyState title={t('web.shell.notFoundTitle')} description={t('web.shell.notFoundBody')} />
    );
  }

  const onAlreadyCharged = async () => {
    setBanner('alreadyCharged');
    setChargeOpen(false);
    setWaiveOpen(false);
    toast.message(t('errors.ALREADY_CHARGED'));
    await query.refetch();
  };

  const onImmutable = async () => {
    setBanner('immutable');
    setEditOpen(false);
    toast.message(t('errors.AUTO_VIOLATION_IMMUTABLE'));
    await query.refetch();
  };

  return (
    <>
      <DetailPageScaffold
        title={violation.type.name}
        breadcrumbs={
          <nav aria-label={t('web.common.breadcrumbs')} className="t-caption text-text-secondary">
            <Link href="/violations" className="hover:underline">
              {t('shared.violations_title')}
            </Link>
            <span className="mx-xs">/</span>
            <span className="truncate">{violation.type.name}</span>
          </nav>
        }
        status={
          <div className="flex flex-wrap gap-sm">
            <StatusChip
              status={violation.severity}
              tone={SEVERITY_TONE[violation.severity] ?? 'neutral'}
              icon={SEVERITY_ICON[violation.severity] ?? Circle}
              label={t(`enums.severity.${violation.severity}` as 'enums.severity.UNKNOWN')}
            />
            <StatusChip
              status={violation.status}
              tone={VIOLATION_STATUS_TONE[violation.status] ?? 'neutral'}
              icon={STATUS_ICON[violation.status] ?? Circle}
              label={t(
                `enums.violationStatus.${violation.status}` as 'enums.violationStatus.UNKNOWN',
              )}
            />
            {violation.autoGenerated ? (
              <StatusChip
                tone="info"
                icon={AlertCircle}
                label={t('shared.violation_auto_badge')}
              />
            ) : null}
          </div>
        }
        subtitle={<UserChip user={violation.user} />}
        actions={
          <div className="flex flex-wrap gap-sm">
            {showAck ? (
              <Button type="button" variant="outline" onClick={() => setAckOpen(true)}>
                {t('shared.violation_acknowledge')}
              </Button>
            ) : null}
            {showEdit ? (
              <Can perm={P.violationsResolve}>
                <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                  {t('shared.violation_edit')}
                </Button>
              </Can>
            ) : null}
            {showCharge ? (
              <Button type="button" onClick={() => setChargeOpen(true)}>
                {t('shared.violation_charge')}
              </Button>
            ) : null}
            {showWaive ? (
              <Can perm={P.violationsWaive}>
                <Button type="button" variant="outline" onClick={() => setWaiveOpen(true)}>
                  {t('shared.violation_waive')}
                </Button>
              </Can>
            ) : null}
          </div>
        }
        summary={
          <div className="space-y-md">
            <div>
              <p className="t-caption text-text-secondary">{t('shared.violation_against')}</p>
              <UserChip user={violation.user} />
            </div>
            <div>
              <p className="t-caption text-text-secondary">{t('shared.violation_machine')}</p>
              {violation.machine ? (
                <Link href={`/machines/${violation.machine.id}`} className="hover:underline">
                  <SerialText value={violation.machine.serial} />
                </Link>
              ) : (
                <span className="text-text-secondary">—</span>
              )}
            </div>
            <div>
              <p className="t-caption text-text-secondary">{t('shared.violation_charged_amount')}</p>
              <Money value={asNumber(violation.chargedAmount)} />
            </div>
            <div>
              <p className="t-caption text-text-secondary">{t('shared.violation_raised_on')}</p>
              <DateText value={violation.createdAt} format="datetime" />
            </div>
            {asText(violation.chargedAt) ? (
              <div>
                <p className="t-caption text-text-secondary">{t('shared.violation_charged_on')}</p>
                <DateText value={asText(violation.chargedAt)} format="datetime" />
                <p className="mt-xs t-caption text-text-secondary">
                  {t('web.violations.chargeRecordHint')}
                </p>
              </div>
            ) : null}
            {asText(violation.transferId) ? (
              <div>
                <p className="t-caption text-text-secondary">{t('shared.violation_transfer')}</p>
                <Link
                  href={`/transfers/${asText(violation.transferId)}`}
                  className="t-body text-primary hover:underline"
                >
                  {t('shared.violation_view_transfer')}
                </Link>
              </div>
            ) : null}
            {violation.autoGenerated ? (
              <p className="t-caption text-text-secondary">{t('shared.violation_auto_locked')}</p>
            ) : null}
          </div>
        }
        tabs={[
          {
            id: 'details',
            label: t('web.violations.detailsTab'),
            content: (
              <div className="space-y-md">
                {banner === 'alreadyCharged' ? (
                  <p className="rounded-md border border-warning bg-warning-surface p-md t-body" role="status">
                    {t('errors.ALREADY_CHARGED')}
                  </p>
                ) : null}
                {banner === 'immutable' ? (
                  <p className="rounded-md border border-warning bg-warning-surface p-md t-body" role="status">
                    {t('errors.AUTO_VIOLATION_IMMUTABLE')}
                  </p>
                ) : null}
                <div>
                  <p className="t-caption text-text-secondary">{t('shared.violation_description')}</p>
                  <p className="t-body whitespace-pre-wrap">{asText(violation.description) ?? '—'}</p>
                </div>
                {asText(violation.waiverReason) ? (
                  <div>
                    <p className="t-caption text-text-secondary">
                      {t('shared.violation_waiver_reason')}
                    </p>
                    <p className="t-body whitespace-pre-wrap">{asText(violation.waiverReason)}</p>
                  </div>
                ) : null}
                {showAck ? (
                  <p className="t-caption text-text-secondary">
                    {t('shared.violation_acknowledge_hint')}
                  </p>
                ) : null}
              </div>
            ),
          },
          {
            id: 'history',
            label: t('web.violations.historyTab'),
            content: <StatusHistory violation={violation} />,
          },
        ]}
      />

      <ConfirmDialog
        open={ackOpen}
        onOpenChange={setAckOpen}
        title={t('shared.violation_acknowledge')}
        description={t('shared.violation_acknowledge_hint')}
        confirmLabel={t('shared.violation_acknowledge')}
        pending={acknowledge.isPending}
        onConfirm={async () => {
          try {
            await acknowledge.mutateAsync({});
            toast.success(t('shared.violation_acknowledged_toast'));
            setAckOpen(false);
          } catch (err) {
            if (err instanceof ApiError) {
              toast.error(t(`errors.${err.code}` as 'errors.INTERNAL_ERROR'));
              return;
            }
            toast.error(t('web.errors.generic'));
          }
        }}
      />

      <ViolationChargeDialog
        violation={violation}
        open={chargeOpen}
        onOpenChange={setChargeOpen}
        onAlreadyCharged={() => void onAlreadyCharged()}
      />
      <ViolationWaiveDialog
        violationId={violation.id}
        open={waiveOpen}
        onOpenChange={setWaiveOpen}
        onAlreadyCharged={() => void onAlreadyCharged()}
      />
      <ViolationEditDialog
        violation={violation}
        open={editOpen}
        onOpenChange={setEditOpen}
        onImmutable={() => void onImmutable()}
      />
    </>
  );
}
