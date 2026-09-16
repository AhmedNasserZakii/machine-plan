'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { StatusChip } from '@/components/common/status-chip';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/feedback/page-header';
import { DetailSkeleton, TableSkeleton } from '@/components/feedback/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { visibleNavGroups } from '@/lib/nav/nav-items';

import {
  usePermissionsCatalogue,
  useRoleDetail,
  useRoleUserCount,
  useSetRolePermissionsMutation,
} from '../hooks';

export function RoleDetailPage({ id }: { id: string }) {
  const t = useTranslations();
  const detail = useRoleDetail(id);
  const catalogue = usePermissionsCatalogue();
  const userCount = useRoleUserCount(id, Boolean(detail.data));
  const mutation = useSetRolePermissionsMutation(id);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [baseline, setBaseline] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!detail.data) return;
    const next = new Set(detail.data.permissions);
    setSelected(next);
    setBaseline(new Set(next));
  }, [detail.data]);

  const readOnly = Boolean(detail.data?.isSystem);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (catalogue.data ?? [])
      .map((g) => ({
        ...g,
        permissions: g.permissions.filter(
          (p) =>
            !q ||
            p.code.toLowerCase().includes(q) ||
            p.displayName.toLowerCase().includes(q) ||
            g.label.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.permissions.length > 0);
  }, [catalogue.data, search]);

  const diff = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const code of selected) if (!baseline.has(code)) added += 1;
    for (const code of baseline) if (!selected.has(code)) removed += 1;
    return { added, removed };
  }, [baseline, selected]);

  const previewNav = useMemo(() => visibleNavGroups([...selected]), [selected]);

  if (detail.isLoading || catalogue.isLoading) return <DetailSkeleton />;
  if (detail.error || !detail.data) {
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  }

  const role = detail.data;

  const toggleGroup = (codes: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const code of codes) {
        if (checked) next.add(code);
        else next.delete(code);
      }
      return next;
    });
  };

  const save = async () => {
    try {
      await mutation.mutateAsync({ permissions: [...selected] });
      toast.success(t('web.roles.permissionsSaved'));
      toast.message(t('web.users.permissionsCacheHint'));
      setConfirmOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('web.errors.generic'));
    }
  };

  return (
    <div className="space-y-lg">
      <PageHeader
        title={role.displayName}
        subtitle={role.code}
        status={
          role.isSystem ? (
            <StatusChip status="SYSTEM" tone="info" label={t('web.roles.systemBadge')} />
          ) : undefined
        }
        actions={
          !readOnly ? (
            <Button
              type="button"
              disabled={mutation.isPending || (diff.added === 0 && diff.removed === 0)}
              onClick={() => setConfirmOpen(true)}
            >
              {t('web.roles.saveMatrix')}
            </Button>
          ) : null
        }
      />

      {readOnly ? (
        <p className="rounded-md border border-border bg-surface-alt p-md t-body">
          {t('web.roles.systemReadOnly')}
        </p>
      ) : null}

      <div className="grid gap-lg lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-md">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('web.users.searchPermissions')}
          />
          {(diff.added > 0 || diff.removed > 0) && !readOnly ? (
            <p className="t-body text-warning">
              {t('web.roles.diffSummary', { added: diff.added, removed: diff.removed })}
            </p>
          ) : null}
          {catalogue.isLoading ? (
            <TableSkeleton rows={8} />
          ) : !groups.length ? (
            <EmptyState title={t('web.filters.emptyTitle')} description={t('web.users.noPermissions')} />
          ) : (
            groups.map((group) => {
              const codes = group.permissions.map((p) => p.code);
              const selectedCount = codes.filter((c) => selected.has(c)).length;
              const all = selectedCount === codes.length;
              const some = selectedCount > 0 && !all;
              return (
                <section key={group.group} className="space-y-sm rounded-md border border-border p-md">
                  <div className="flex items-center justify-between gap-sm">
                    <h3 className="t-h3">{group.label}</h3>
                    <label className="flex items-center gap-sm t-caption">
                      <input
                        type="checkbox"
                        checked={all}
                        ref={(el) => {
                          if (el) el.indeterminate = some;
                        }}
                        disabled={readOnly}
                        onChange={(e) => toggleGroup(codes, e.target.checked)}
                      />
                      {t('web.roles.checkAll')}
                    </label>
                  </div>
                  <ul className="space-y-xs">
                    {group.permissions.map((p) => (
                      <li key={p.code}>
                        <label className="flex items-start gap-sm">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={selected.has(p.code)}
                            disabled={readOnly}
                            onChange={(e) => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(p.code);
                                else next.delete(p.code);
                                return next;
                              });
                            }}
                          />
                          <span>
                            <span className="font-medium">{p.displayName}</span>
                            <span className="block t-caption text-text-secondary" dir="ltr">
                              {p.code}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </div>

        <aside className="space-y-md rounded-md border border-border bg-surface p-md">
          <h3 className="t-h3">{t('web.roles.previewTitle')}</h3>
          <p className="t-caption text-text-secondary">{t('web.roles.previewBody')}</p>
          <ul className="space-y-sm">
            {previewNav.map((g) => (
              <li key={g.labelKey}>
                <p className="t-caption text-text-secondary">{t(g.labelKey)}</p>
                <ul className="ms-sm space-y-xs">
                  {g.items.map((item) => (
                    <li key={item.href} className="t-body">
                      {t(item.labelKey)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {!previewNav.length ? (
            <p className="t-caption text-text-secondary">{t('web.roles.previewEmpty')}</p>
          ) : null}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('web.roles.confirmTitle')}
        description={t('web.roles.confirmBody', {
          count: userCount.data ?? 0,
          added: diff.added,
          removed: diff.removed,
        })}
        confirmLabel={t('web.roles.saveMatrix')}
        pending={mutation.isPending}
        onConfirm={save}
      />
    </div>
  );
}
