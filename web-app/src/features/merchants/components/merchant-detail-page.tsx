'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { Can } from '@/components/common/can';
import { DateText } from '@/components/common/date-text';
import { Money } from '@/components/common/money';
import { PhoneText } from '@/components/common/phone-text';
import { SerialText } from '@/components/common/serial-text';
import { StatusChip } from '@/components/common/status-chip';
import { DetailPageScaffold } from '@/components/detail/detail-page-scaffold';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { DetailSkeleton } from '@/components/feedback/skeletons';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { MACHINE_STATUS_TONE } from '@/lib/theme/status-tone';

import {
  useMerchantDetail,
  useMerchantMachines,
  useMerchantSubscriptions,
  useMerchantTimeline,
  useUpdateSubscriptionMutation,
} from '../hooks';
import { asNumber, asText } from '../lib/value';
import type { Subscription } from '../model';
import { AddSubscriptionDialog } from './add-subscription-dialog';
import { CollectSubscriptionDialog } from './collect-subscription-dialog';
import { DeactivateMerchantDialog } from './deactivate-merchant-dialog';

export function MerchantDetailPage({ id }: { id: string }) {
  const t = useTranslations();
  const { permissions } = useSession();
  const detail = useMerchantDetail(id);
  const [collectSub, setCollectSub] = useState<Subscription | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  const merchant = detail.data;
  const canSeeMoney = can(permissions, P.financeRead);

  const profile = useMemo(() => {
    if (!merchant) return null;
    return (
      <div className="space-y-md rounded-md border border-border bg-surface p-md">
        <dl className="grid gap-md sm:grid-cols-2">
          <div>
            <dt className="t-caption text-text-secondary">{t('web.merchants.name')}</dt>
            <dd>{merchant.name}</dd>
          </div>
          <div>
            <dt className="t-caption text-text-secondary">{t('web.merchants.shopName')}</dt>
            <dd>{merchant.shopName}</dd>
          </div>
          <div>
            <dt className="t-caption text-text-secondary">{t('web.merchants.phone')}</dt>
            <dd>
              <PhoneText value={merchant.phone} />
            </dd>
          </div>
          <div>
            <dt className="t-caption text-text-secondary">{t('web.merchants.nationalId')}</dt>
            <dd>
              {asText(merchant.nationalId) ? (
                <bdi dir="ltr" className="t-mono">
                  {asText(merchant.nationalId)}
                </bdi>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="t-caption text-text-secondary">{t('web.merchants.address')}</dt>
            <dd className="whitespace-pre-wrap">{asText(merchant.address) ?? '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="t-caption text-text-secondary">{t('web.merchants.notes')}</dt>
            <dd className="whitespace-pre-wrap">{asText(merchant.notes) ?? '—'}</dd>
          </div>
          <div>
            <dt className="t-caption text-text-secondary">{t('web.merchants.createdAt')}</dt>
            <dd>
              <DateText value={merchant.createdAt} />
            </dd>
          </div>
          <div>
            <dt className="t-caption text-text-secondary">{t('web.merchants.registeredBy')}</dt>
            <dd>{merchant.registeredBy?.fullName ?? '—'}</dd>
          </div>
        </dl>
      </div>
    );
  }, [merchant, t]);

  if (detail.isLoading) return <DetailSkeleton />;
  if (detail.error || !merchant) {
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  }

  return (
    <>
      <DetailPageScaffold
        title={merchant.name}
        subtitle={merchant.shopName}
        status={
          <StatusChip
            status={merchant.isActive ? 'ACTIVE' : 'INACTIVE'}
            tone={merchant.isActive ? 'success' : 'neutral'}
            label={merchant.isActive ? t('web.merchants.active') : t('web.merchants.inactive')}
          />
        }
        actions={
          <div className="flex flex-wrap items-center gap-sm">
            <Can perm={P.merchantsUpdate}>
              <Link
                href={`/merchants/${merchant.id}/edit`}
                className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-2.5 t-body hover:bg-surface-alt"
              >
                {t('web.merchants.edit')}
              </Link>
            </Can>
            <Can perm={P.transfersCreate}>
              <Link
                href={`/transfers/new?type=REPRESENTATIVE_TO_MERCHANT&merchantId=${merchant.id}`}
                className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-2.5 t-body hover:bg-surface-alt"
              >
                {t('web.merchants.placeMachine')}
              </Link>
            </Can>
            <Can perm={P.transfersCreate}>
              <Link
                href={`/transfers/new?type=MERCHANT_TO_REPRESENTATIVE&merchantId=${merchant.id}`}
                className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-2.5 t-body hover:bg-surface-alt"
              >
                {t('web.merchants.collectMachine')}
              </Link>
            </Can>
            <Can perm={P.merchantsUpdate}>
              <Button type="button" variant="outline" onClick={() => setAddOpen(true)}>
                {t('shared.subscription_add')}
              </Button>
            </Can>
            {merchant.isActive ? (
              <Can perm={P.merchantsDelete}>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeactivateOpen(true)}
                >
                  {t('web.merchants.deactivate')}
                </Button>
              </Can>
            ) : null}
          </div>
        }
        summary={
          <dl className="space-y-md">
            <div>
              <dt className="t-caption text-text-secondary">{t('web.merchants.phone')}</dt>
              <dd>
                <PhoneText value={merchant.phone} />
              </dd>
            </div>
            <div>
              <dt className="t-caption text-text-secondary">{t('web.merchants.branch')}</dt>
              <dd>{merchant.branch?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="t-caption text-text-secondary">{t('web.merchants.registeredBy')}</dt>
              <dd>{merchant.registeredBy?.fullName ?? '—'}</dd>
            </div>
            <div>
              <dt className="t-caption text-text-secondary">{t('web.merchants.machinesCount')}</dt>
              <dd>{merchant.machinesCount}</dd>
            </div>
            <div>
              <dt className="t-caption text-text-secondary">{t('web.merchants.activeSubscription')}</dt>
              <dd>
                {merchant.activeSubscription ? (
                  canSeeMoney ? (
                    <Money value={merchant.activeSubscription.amount} />
                  ) : (
                    t('web.common.moneyHidden')
                  )
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="t-caption text-text-secondary">{t('web.merchants.totalPaid')}</dt>
              <dd>
                {canSeeMoney ? <Money value={merchant.totalPaid} /> : t('web.common.moneyHidden')}
              </dd>
            </div>
          </dl>
        }
        defaultTab="profile"
        tabs={[
          { id: 'profile', label: t('web.merchants.tabProfile'), content: profile },
          {
            id: 'machines',
            label: t('web.merchants.tabMachines'),
            content: <MachinesTab id={id} />,
          },
          {
            id: 'subscriptions',
            label: t('web.merchants.tabSubscriptions'),
            content: (
              <SubscriptionsTab
                id={id}
                onCollect={setCollectSub}
                onAdd={() => setAddOpen(true)}
              />
            ),
          },
          {
            id: 'timeline',
            label: t('web.merchants.tabTimeline'),
            content: <TimelineTab id={id} />,
          },
        ]}
      />

      <CollectSubscriptionDialog
        merchantId={id}
        subscription={collectSub}
        open={Boolean(collectSub)}
        onOpenChange={(next) => {
          if (!next) setCollectSub(null);
        }}
      />
      <AddSubscriptionDialog merchantId={id} open={addOpen} onOpenChange={setAddOpen} />
      <DeactivateMerchantDialog
        merchant={merchant}
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
      />
    </>
  );
}

function MachinesTab({ id }: { id: string }) {
  const t = useTranslations();
  const query = useMerchantMachines(id, { page: 1, limit: 50 });

  if (query.isLoading) return <DetailSkeleton />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const rows = query.data?.data ?? [];
  if (!rows.length) {
    return (
      <EmptyState
        title={t('web.merchants.machinesEmptyTitle')}
        description={t('web.merchants.machinesEmptyBody')}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-start">
        <thead>
          <tr className="border-b border-divider t-caption text-text-secondary">
            <th className="px-md py-sm font-medium">{t('web.machines.serial')}</th>
            <th className="px-md py-sm font-medium">{t('web.machines.status')}</th>
            <th className="px-md py-sm font-medium">{t('web.machines.model')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-divider last:border-0">
              <td className="px-md py-sm">
                <Link href={`/machines/${row.id}`} className="text-primary hover:underline">
                  <SerialText value={row.serial} />
                </Link>
              </td>
              <td className="px-md py-sm">
                <StatusChip
                  status={row.status}
                  tone={MACHINE_STATUS_TONE[row.status] ?? 'neutral'}
                  label={t(`enums.machineStatus.${row.status}` as 'enums.machineStatus.UNKNOWN')}
                />
              </td>
              <td className="px-md py-sm">{row.model.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubscriptionsTab({
  id,
  onCollect,
  onAdd,
}: {
  id: string;
  onCollect: (sub: Subscription) => void;
  onAdd: () => void;
}) {
  const t = useTranslations();
  const { permissions } = useSession();
  const canSeeMoney = can(permissions, P.financeRead);
  const query = useMerchantSubscriptions(id);
  const endMutation = useUpdateSubscriptionMutation(id);

  if (query.isLoading) return <DetailSkeleton />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const rows = query.data ?? [];

  return (
    <div className="space-y-md">
      <div className="flex justify-end">
        <Can perm={P.merchantsUpdate}>
          <Button type="button" variant="outline" onClick={onAdd}>
            {t('shared.subscription_add')}
          </Button>
        </Can>
      </div>
      {!rows.length ? (
        <EmptyState
          title={t('web.merchants.subscriptionsEmptyTitle')}
          description={t('web.merchants.subscriptionsEmptyBody')}
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-start">
            <thead>
              <tr className="border-b border-divider t-caption text-text-secondary">
                <th className="px-md py-sm font-medium">{t('shared.subscription_plan')}</th>
                <th className="px-md py-sm font-medium">{t('shared.subscription_amount')}</th>
                <th className="px-md py-sm font-medium">{t('shared.subscription_next_due')}</th>
                <th className="px-md py-sm font-medium">{t('web.merchants.status')}</th>
                <th className="px-md py-sm font-medium">{t('web.common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-divider last:border-0">
                  <td className="px-md py-sm">
                    {t(`web.merchants.planType.${row.planType}` as 'web.merchants.planType.MONTHLY')}
                    {row.isOverdue ? (
                      <span className="ms-sm text-danger">{t('shared.subscription_overdue')}</span>
                    ) : null}
                  </td>
                  <td className="px-md py-sm">
                    {canSeeMoney ? <Money value={row.amount} /> : t('web.common.moneyHidden')}
                  </td>
                  <td className="px-md py-sm">
                    <DateText value={asText(row.nextDueDate)} />
                  </td>
                  <td className="px-md py-sm">
                    {row.isActive ? t('web.merchants.active') : t('web.merchants.inactive')}
                  </td>
                  <td className="px-md py-sm">
                    <div className="flex flex-wrap gap-xs">
                      {row.isActive ? (
                        <Can perm={P.merchantsUpdate}>
                          <Button type="button" size="sm" variant="outline" onClick={() => onCollect(row)}>
                            {t('shared.subscription_collect')}
                          </Button>
                        </Can>
                      ) : null}
                      {row.isActive ? (
                        <Can perm={P.merchantsUpdate}>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={endMutation.isPending}
                            onClick={() =>
                              void endMutation.mutateAsync({
                                id: row.id,
                                body: { isActive: false },
                              })
                            }
                          >
                            {t('web.merchants.endSubscription')}
                          </Button>
                        </Can>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TimelineTab({ id }: { id: string }) {
  const t = useTranslations();
  const { permissions } = useSession();
  const canSeeMoney = can(permissions, P.financeRead);
  const query = useMerchantTimeline(id);
  const events = query.data?.pages.flatMap((p) => p.data ?? []) ?? [];

  if (query.isLoading) return <DetailSkeleton />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!events.length) {
    return (
      <EmptyState
        title={t('web.merchants.timelineEmptyTitle')}
        description={t('web.merchants.timelineEmptyBody')}
      />
    );
  }

  return (
    <div className="space-y-md">
      <ol className="relative space-y-md border-s border-divider ps-md">
        {events.map((event) => (
          <li key={`${event.kind}-${event.refId}-${event.occurredAt}`} className="space-y-xs">
            <p className="t-caption text-text-secondary">
              <DateText value={event.occurredAt} format="datetime" />
            </p>
            <p className="t-body">
              {t(`web.merchants.timeline.${event.code}` as 'web.merchants.timeline.UNKNOWN')}
            </p>
            {asText(event.machineSerial) ? (
              <SerialText value={asText(event.machineSerial)!} />
            ) : null}
            {asNumber(event.amount) !== null && canSeeMoney ? (
              <Money value={asNumber(event.amount)} />
            ) : null}
          </li>
        ))}
      </ol>
      {query.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {t('web.table.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
