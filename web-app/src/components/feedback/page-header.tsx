'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  status,
  className,
}: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn('mb-lg flex flex-col gap-md border-b border-divider pb-md', className)}
    >
      {breadcrumbs}
      <div className="flex flex-wrap items-start justify-between gap-md">
        <div className="min-w-0 space-y-xs">
          <div className="flex flex-wrap items-center gap-sm">
            <h1 className="t-h1 text-text-primary">{title}</h1>
            {status}
          </div>
          {subtitle ? <p className="t-body text-text-secondary">{subtitle}</p> : null}
        </div>
        {actions ? (
          <div data-slot="page-actions" className="flex flex-wrap items-center gap-sm">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
