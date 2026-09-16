import type { NextResponse } from 'next/server';

export const ACCESS_COOKIE = 'mch_at';
export const REFRESH_COOKIE = 'mch_rt';
export const SESSION_FLAG_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'mch_session';

const ACCESS_MAX_AGE = 30 * 60;
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

function secure(): boolean {
  return process.env.SESSION_COOKIE_SECURE === 'true';
}

export function writeSessionCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken: string },
): void {
  const isSecure = secure();
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_MAX_AGE,
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/api/bff',
    maxAge: REFRESH_MAX_AGE,
  });
  response.cookies.set(SESSION_FLAG_COOKIE, '1', {
    httpOnly: false,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_MAX_AGE,
  });
}

export function clearSessionCookies(response: NextResponse): void {
  const isSecure = secure();
  response.cookies.set(ACCESS_COOKIE, '', {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set(REFRESH_COOKIE, '', {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/api/bff',
    maxAge: 0,
  });
  response.cookies.set(SESSION_FLAG_COOKIE, '', {
    httpOnly: false,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
