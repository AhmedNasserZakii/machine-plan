'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type PermissionBadgeProps = {
  code: string;
  /** Localized label from GET /permissions when available. */
  label?: string;
  className?: string;
};

export function PermissionBadge({ code, label, className }: PermissionBadgeProps) {
  return (
    <Badge variant="outline" className={cn('t-mono max-w-full truncate', className)} title={code}>
      {label ?? code}
    </Badge>
  );
}
