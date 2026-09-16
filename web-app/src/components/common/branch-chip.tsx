'use client';

import { Building2 } from 'lucide-react';

import { cn } from '@/lib/utils';

type BranchChipProps = {
  branch: { name?: string | null; code?: string | null };
  className?: string;
};

export function BranchChip({ branch, className }: BranchChipProps) {
  const label = branch.name ?? branch.code ?? '—';
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-xs rounded-pill bg-surface-alt px-sm py-xs t-caption text-text-primary',
        className,
      )}
    >
      <Building2 className="size-3.5 shrink-0 text-text-secondary" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
