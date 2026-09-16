import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    formats: {
      number: {
        decimal: { numberingSystem: 'latn' },
        currency: { numberingSystem: 'latn', currency: 'EGP' },
      },
      dateTime: {
        short: {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          numberingSystem: 'latn',
        },
        time: {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          numberingSystem: 'latn',
        },
      },
    },
  };
});
