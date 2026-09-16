'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { usePathname, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import type { Schema } from '@/lib/api/types';
import { canAny } from '@/lib/auth/can';
import { READ_ALL } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';

type Branch = Schema<'BranchResponse'>;

export function BranchSwitcher() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { permissions } = useSession();
  const allowed = canAny(permissions, READ_ALL);

  const branches = useQuery({
    queryKey: ['branches', 'switcher'] as const,
    enabled: allowed,
    queryFn: async () => {
      const result = await api.get<Branch[]>(endpoints.branches.list, { limit: 100 });
      return result.data ?? [];
    },
  });

  if (!allowed) return null;

  const current = searchParams.get('branchId') ?? '';

  const onChange = (branchId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (branchId) {
      params.set('branchId', branchId);
    } else {
      params.delete('branchId');
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <label className="flex items-center gap-sm">
      <span className="sr-only">{t('web.shell.branch')}</span>
      <select
        className="h-8 max-w-48 rounded-md border border-border bg-background px-sm t-caption text-text-primary"
        value={current}
        onChange={(event) => onChange(event.target.value)}
        aria-label={t('web.shell.branch')}
      >
        <option value="">{t('web.shell.allBranches')}</option>
        {(branches.data ?? []).map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </label>
  );
}
