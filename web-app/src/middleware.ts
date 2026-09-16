import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';
import { SESSION_FLAG_COOKIE } from './lib/auth/cookies';

const intlMiddleware = createMiddleware(routing);

function localeAndRest(pathname: string): { locale: string; rest: string } {
  const match = pathname.match(/^\/(ar|en)(\/.*)?$/);
  if (!match) {
    return { locale: routing.defaultLocale, rest: pathname || '/' };
  }
  return { locale: match[1], rest: match[2] && match[2].length > 0 ? match[2] : '/' };
}

export default function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const { locale, rest } = localeAndRest(pathname);
  const session = request.cookies.get(SESSION_FLAG_COOKIE)?.value;
  const isLogin = rest === '/login';

  if (!session && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = '';
    url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (session && isLogin) {
    const url = request.nextUrl.clone();
    const next = request.nextUrl.searchParams.get('next');
    url.pathname = next?.startsWith(`/${locale}`) ? next.split('?')[0] : `/${locale}`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
