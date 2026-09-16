'use client';

import { useLocale, useTranslations } from 'next-intl';

import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

type MoneyProps = {
  value: number | null | undefined;
  currency?: string;
  className?: string;
};

export function Money({ value, currency = 'EGP', className }: MoneyProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { permissions } = useSession();

  if (!can(permissions, P.financeRead)) {
    return (
      <span className={cn('t-mono text-text-secondary', className)} aria-label={t('web.common.moneyHidden')}>
        {t('web.common.moneyHidden')}
      </span>
    );
  }

  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className={cn('t-mono text-text-secondary', className)}>—</span>;
  }

  return (
    <span
      dir="ltr"
      className={cn('t-mono', value < 0 && 'text-danger', className)}
    >
      {formatMoney(value, locale, currency)}
    </span>
  );
}
