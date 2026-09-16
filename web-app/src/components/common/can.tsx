'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { can, canAll, canAny } from '@/lib/auth/can';
import { useSession } from '@/lib/auth/use-session';

type CanProps = {
  perm?: string;
  anyOf?: readonly string[];
  allOf?: readonly string[];
  fallback?: ReactNode;
  children: ReactNode;
};

export function Can({ perm, anyOf, allOf, fallback = null, children }: CanProps) {
  const { permissions } = useSession();
  const allowed =
    (perm ? can(permissions, perm) : true) &&
    (anyOf ? canAny(permissions, anyOf) : true) &&
    (allOf ? canAll(permissions, allOf) : true);
  return allowed ? children : fallback;
}

export function useT() {
  return useTranslations();
}
