import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { REFRESH_COOKIE, writeSessionCookies } from '@/lib/auth/cookies';
import { rotateRefreshToken } from '@/lib/auth/refresh-lock';
import { originRejected, requestOriginAllowed } from '@/lib/auth/upstream';

export async function POST(request: NextRequest) {
  if (!requestOriginAllowed(request)) return originRejected();
  const store = await cookies();
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (!refresh) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHENTICATED', message: 'No session' } },
      { status: 401 },
    );
  }
  const rotated = await rotateRefreshToken(request, refresh);
  if (!rotated) {
    return NextResponse.json(
      { success: false, error: { code: 'TOKEN_REVOKED', message: 'Refresh failed' } },
      { status: 401 },
    );
  }
  const response = NextResponse.json({ success: true, data: { ok: true } });
  writeSessionCookies(response, rotated);
  return response;
}
