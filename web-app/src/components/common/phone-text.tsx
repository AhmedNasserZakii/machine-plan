'use client';

import { useTranslations } from 'next-intl';

import { formatPhone } from '@/lib/format';
import { cn } from '@/lib/utils';

type PhoneTextProps = {
  value: string;
  className?: string;
};

export function PhoneText({ value, className }: PhoneTextProps) {
  const t = useTranslations();
  const normalized = formatPhone(value);

  return (
    <a
      href={`tel:${normalized}`}
      aria-label={`${t('web.common.phone')} ${normalized}`}
      className={cn('inline-flex hover:underline', className)}
    >
      <bdi dir="ltr" className="t-mono">
        {normalized}
      </bdi>
    </a>
  );
}
