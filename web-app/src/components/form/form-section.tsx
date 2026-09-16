'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={cn('space-y-md rounded-md border border-border bg-surface p-md', className)}>
      <header className="space-y-xs">
        <h2 className="t-h3">{title}</h2>
        {description ? <p className="t-body text-text-secondary">{description}</p> : null}
      </header>
      <div className="grid gap-md md:grid-cols-2">{children}</div>
    </section>
  );
}
