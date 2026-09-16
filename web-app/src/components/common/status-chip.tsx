'use client';

import type { LucideIcon } from 'lucide-react';
import { Circle } from 'lucide-react';

import { type Tone, toneColorVar, toneSurfaceVar } from '@/lib/theme/status-tone';
import { cn } from '@/lib/utils';

type StatusChipProps = {
  status?: string;
  tone: Tone;
  icon?: LucideIcon;
  label: string;
  className?: string;
};

export function StatusChip({ status, tone, icon: Icon = Circle, label, className }: StatusChipProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-xs rounded-pill px-sm py-xs t-caption font-medium',
        className,
      )}
      style={{
        color: toneColorVar(tone, status),
        backgroundColor: toneSurfaceVar(tone, status),
      }}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
