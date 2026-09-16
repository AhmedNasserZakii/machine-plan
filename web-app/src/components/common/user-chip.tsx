'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type UserChipProps = {
  user: {
    fullName?: string | null;
    name?: string | null;
    roleName?: string | null;
    role?: string | null;
  };
  className?: string;
};

export function UserChip({ user, className }: UserChipProps) {
  const name = user.fullName ?? user.name ?? '—';
  const role = user.roleName ?? user.role;
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <span className={cn('inline-flex items-center gap-sm', className)}>
      <Avatar size="sm">
        <AvatarFallback>{initial}</AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate t-body">{name}</span>
        {role ? <span className="block truncate t-caption text-text-secondary">{role}</span> : null}
      </span>
    </span>
  );
}
