'use client';

import { useTranslations } from 'next-intl';

import { Can } from '@/components/common/can';
import { PageHeader } from '@/components/feedback/page-header';
import { Link } from '@/i18n/navigation';
import { P } from '@/lib/auth/permissions';

const LINKS = [
  { href: '/organization/branches', labelKey: 'web.organization.branches', perm: P.branchesManage },
  { href: '/organization/warehouses', labelKey: 'web.organization.warehouses', perm: P.branchesManage },
  { href: '/organization/lookups', labelKey: 'web.organization.lookups', perm: P.settingsManage },
  { href: '/organization/sync', labelKey: 'web.organization.sync', perm: P.settingsManage },
] as const;

export function OrganizationHubPage() {
  const t = useTranslations();
  return (
    <div className="space-y-md">
      <PageHeader title={t('web.organization.title')} subtitle={t('web.organization.subtitle')} />
      <ul className="grid gap-md sm:grid-cols-2">
        {LINKS.map((item) => (
          <li key={item.href}>
            <Can perm={item.perm}>
              <Link
                href={item.href}
                className="block rounded-md border border-border bg-surface p-md hover:bg-surface-alt"
              >
                <span className="t-h3">{t(item.labelKey)}</span>
              </Link>
            </Can>
          </li>
        ))}
      </ul>
    </div>
  );
}
