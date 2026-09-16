'use client';

import { useEffect } from 'react';

import { usePathname } from '@/i18n/navigation';

/** Move focus to the page h1 inside main#content after client navigations. */
export function FocusToHeading() {
  const pathname = usePathname();

  useEffect(() => {
    const main = document.getElementById('content');
    const heading = main?.querySelector('h1');
    if (!(heading instanceof HTMLElement)) return;
    if (!heading.hasAttribute('tabindex')) {
      heading.tabIndex = -1;
    }
    heading.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}
