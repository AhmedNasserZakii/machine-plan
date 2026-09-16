'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { TableSkeleton } from '@/components/feedback/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

import {
  usePermissionsCatalogue,
  useSetUserPermissionsMutation,
  useUserPermissions,
} from '../hooks';
import type { OverrideState } from '../model';

type Props = {
  userId: string;
  isSelf: boolean;
  readOnly?: boolean;
};

function overrideFor(code: string, overrides: { code: string; effect: 'ALLOW' | 'DENY' }[]): OverrideState {
  const hit = overrides.find((o) => o.code === code);
  if (!hit) return 'inherit';
  return hit.effect === 'ALLOW' ? 'allow' : 'deny';
}

function effectiveReason(
  code: string,
  roleSet: Set<string>,
  state: OverrideState,
  t: (key: string) => string,
): { effective: boolean; reason: string } {
  if (state === 'deny') return { effective: false, reason: t('web.users.reasonDeniedOverride') };
  if (state === 'allow') return { effective: true, reason: t('web.users.reasonAllowedOverride') };
  if (roleSet.has(code)) return { effective: true, reason: t('web.users.reasonGrantedByRole') };
  return { effective: false, reason: t('web.users.reasonNotGranted') };
}

export function PermissionOverrideEditor({ userId, isSelf, readOnly }: Props) {
  const t = useTranslations();
  const catalogue = usePermissionsCatalogue();
  const perms = useUserPermissions(userId);
  const mutation = useSetUserPermissionsMutation(userId, isSelf);
  const locked = readOnly || isSelf;

  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Record<string, OverrideState>>({});

  useEffect(() => {
    if (!perms.data) return;
    const next: Record<string, OverrideState> = {};
    for (const group of catalogue.data ?? []) {
      for (const p of group.permissions) {
        next[p.code] = overrideFor(p.code, perms.data.overrides);
      }
    }
    setDraft(next);
  }, [catalogue.data, perms.data]);

  const roleSet = useMemo(() => new Set(perms.data?.rolePermissions ?? []), [perms.data]);

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

  if (catalogue.isLoading || perms.isLoading) return <TableSkeleton rows={8} />;
  if (catalogue.error || perms.error || !perms.data) {
    return (
      <ErrorState
        error={catalogue.error ?? perms.error}
        onRetry={() => {
          void catalogue.refetch();
          void perms.refetch();
        }}
      />
    );
  }

  const save = async () => {
    const allow: string[] = [];
    const deny: string[] = [];
    for (const [code, state] of Object.entries(draft)) {
      if (state === 'allow') allow.push(code);
      if (state === 'deny') deny.push(code);
    }
    try {
      await mutation.mutateAsync({ allow, deny });
      toast.success(t('web.users.permissionsSaved'));
      toast.message(t('web.users.permissionsCacheHint'));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('web.errors.generic'));
    }
  };

  if (!groups.length) {
    return <EmptyState title={t('web.filters.emptyTitle')} description={t('web.users.noPermissions')} />;
  }

  return (
    <div className="space-y-md">
      {isSelf ? (
        <p className="rounded-md border border-warning/40 bg-warning-surface p-md t-body text-warning">
          {t('web.users.cannotEditOwn')}
        </p>
      ) : null}
      <p className="t-caption text-text-secondary">{t('web.users.denyBeatsRole')}</p>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('web.users.searchPermissions')}
      />
      <div className="space-y-lg">
        {groups.map((group) => (
          <section key={group.group} className="space-y-sm">
            <h3 className="t-h3">{group.label}</h3>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-start">
                <thead className="bg-surface-alt t-caption text-text-secondary">
                  <tr>
                    <th className="px-md py-sm font-medium">{t('web.users.permission')}</th>
                    <th className="px-md py-sm font-medium">{t('web.users.roleGranted')}</th>
                    <th className="px-md py-sm font-medium">{t('web.users.override')}</th>
                    <th className="px-md py-sm font-medium">{t('web.users.effective')}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.permissions.map((p) => {
                    const state = draft[p.code] ?? 'inherit';
                    const { effective, reason } = effectiveReason(p.code, roleSet, state, t);
                    return (
                      <tr key={p.code} className="border-t border-border">
                        <td className="px-md py-sm">
                          <div className="font-medium">{p.displayName}</div>
                          <div className="t-caption text-text-secondary" dir="ltr">
                            {p.code}
                          </div>
                        </td>
                        <td className="px-md py-sm">{roleSet.has(p.code) ? t('web.common.yes') : t('web.common.no')}</td>
                        <td className="px-md py-sm">
                          <select
                            className="h-8 rounded-md border border-border bg-background px-sm"
                            value={state}
                            disabled={locked || mutation.isPending}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                [p.code]: e.target.value as OverrideState,
                              }))
                            }
                          >
                            <option value="inherit">{t('web.users.inherit')}</option>
                            <option value="allow">{t('web.users.allow')}</option>
                            <option value="deny">{t('web.users.deny')}</option>
                          </select>
                        </td>
                        <td className="px-md py-sm">
                          <span
                            className={cn(
                              'inline-flex rounded-sm px-sm py-xs t-caption',
                              effective ? 'bg-success-surface text-success' : 'bg-danger-surface text-danger',
                              state === 'deny' && roleSet.has(p.code) && 'ring-1 ring-danger',
                            )}
                          >
                            {effective ? t('web.common.yes') : t('web.common.no')} — {reason}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
      {!locked ? (
        <Button type="button" onClick={() => void save()} disabled={mutation.isPending}>
          {t('web.users.saveOverrides')}
        </Button>
      ) : null}
    </div>
  );
}
