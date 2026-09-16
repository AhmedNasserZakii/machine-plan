'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

type SerialTextProps = {
  value: string;
  className?: string;
};

export function SerialText({ value, className }: SerialTextProps) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(t('web.common.copied'));
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? t('web.common.copied') : t('web.common.copy')}
      className={cn(
        'inline-flex max-w-full rounded-sm text-start hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className,
      )}
    >
      <bdi dir="ltr" className="t-mono truncate">
        {value}
      </bdi>
    </button>
  );
}
