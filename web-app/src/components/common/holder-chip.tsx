'use client';

import {
  Building2,
  Factory,
  type LucideIcon,
  Store,
  User,
  Warehouse,
  Wrench,
} from 'lucide-react';

import { cn } from '@/lib/utils';

const HOLDER_ICONS: Record<string, LucideIcon> = {
  FACTORY: Factory,
  WAREHOUSE: Warehouse,
  SUPERVISOR: User,
  REPRESENTATIVE: User,
  MERCHANT: Store,
  SERVICE_CENTER: Wrench,
  BRANCH: Building2,
};

type HolderChipProps = {
  type: string;
  id?: string;
  name: string;
  className?: string;
};

export function HolderChip({ type, name, className }: HolderChipProps) {
  const Icon = HOLDER_ICONS[type] ?? User;
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-xs rounded-pill bg-info-surface px-sm py-xs t-caption text-info',
        className,
      )}
      title={type}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{name}</span>
    </span>
  );
}
