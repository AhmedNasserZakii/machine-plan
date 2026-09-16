'use client';

import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { usePathname, useRouter } from '@/i18n/navigation';

export function LocaleSwitcher() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const switchTo = (next: 'ar' | 'en') => {
    const qs = searchParams.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { locale: next });
  };

  return (
    <div className="flex gap-xs" role="group" aria-label={t('web.shell.locale')}>
      <Button
        type="button"
        variant={locale === 'ar' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => switchTo('ar')}
      >
        {t('web.shell.arabic')}
      </Button>
      <Button
        type="button"
        variant={locale === 'en' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => switchTo('en')}
      >
        {t('web.shell.english')}
      </Button>
    </div>
  );
}
