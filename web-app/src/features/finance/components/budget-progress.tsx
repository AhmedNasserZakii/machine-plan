'use client';

import { Money } from '@/components/common/money';
import { StatusChip } from '@/components/common/status-chip';
import { BUDGET_TONE } from '@/lib/theme/status-tone';
import { cn } from '@/lib/utils';

import type { BudgetStatus } from '../model';

type BudgetProgressProps = {
  status: BudgetStatus;
  statusLabel: string;
  className?: string;
};

export function BudgetProgress({ status, statusLabel, className }: BudgetProgressProps) {
  const tone = BUDGET_TONE[status.status] ?? 'neutral';
  const pct = Math.min(100, Math.max(0, status.usedPercent));

  return (
    <div className={cn('space-y-xs', className)}>
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <StatusChip status={status.status} tone={tone} label={statusLabel} />
        <span className="t-caption text-text-secondary" dir="ltr">
          {pct.toFixed(1)}%
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-sm bg-neutral-surface"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full transition-[inline-size]',
            tone === 'success' && 'bg-success',
            tone === 'warning' && 'bg-warning',
            tone === 'danger' && 'bg-danger',
            tone === 'neutral' && 'bg-neutral',
          )}
          style={{ inlineSize: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap justify-between gap-sm t-caption">
        <span>
          <Money value={status.spent} />
          <span className="text-text-secondary"> / </span>
          <Money value={status.amount} />
        </span>
        <span className="text-text-secondary">
          <Money value={status.remaining} />
        </span>
      </div>
    </div>
  );
}
