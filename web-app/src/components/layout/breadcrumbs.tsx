'use client';

import { useTranslations } from 'next-intl';
import { Fragment } from 'react';

import { Link, usePathname } from '@/i18n/navigation';
import { navGroups } from '@/lib/nav/nav-items';

type Crumb = { href: string; label: string };

function labelForPath(pathname: string, t: ReturnType<typeof useTranslations>): string | null {
  if (pathname === '/') return t('shared.nav_home');
  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.href === pathname) return t(item.labelKey);
    }
  }
  return null;
}

export function useBreadcrumbs(): Crumb[] {
  const t = useTranslations();
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return [{ href: '/', label: t('shared.nav_home') }];
  }

  const crumbs: Crumb[] = [{ href: '/', label: t('shared.nav_home') }];
  let acc = '';
  for (const segment of segments) {
    acc += `/${segment}`;
    const known = labelForPath(acc, t);
    crumbs.push({
      href: acc,
      label: known ?? decodeURIComponent(segment),
    });
  }
  return crumbs;
}

export function Breadcrumbs() {
  const t = useTranslations();
  const crumbs = useBreadcrumbs();

  if (crumbs.length <= 1) {
    return (
      <nav aria-label={t('web.shell.breadcrumbs')} className="min-w-0">
        <ol className="flex flex-wrap items-center gap-xs t-caption text-text-secondary">
          <li className="text-text-primary">{crumbs[0]?.label}</li>
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label={t('web.shell.breadcrumbs')} className="min-w-0">
      <ol className="flex flex-wrap items-center gap-xs t-caption text-text-secondary">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={crumb.href}>
              {index > 0 ? <li aria-hidden="true">/</li> : null}
              <li className={last ? 'text-text-primary' : undefined}>
                {last ? (
                  <span aria-current="page">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="hover:text-text-primary">
                    {crumb.label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
