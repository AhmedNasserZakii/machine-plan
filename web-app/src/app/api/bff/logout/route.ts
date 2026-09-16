import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { ACCESS_COOKIE, clearSessionCookies } from '@/lib/auth/cookies';
import { callUpstream, originRejected, requestOriginAllowed, upstreamHeaders } from '@/lib/auth/upstream';

export async function POST(request: NextRequest) {
  if (!requestOriginAllowed(request)) return originRejected();

  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  try {
    if (access) {
      await callUpstream('auth/logout', {
        method: 'POST',
        headers: upstreamHeaders(request, access),
      });
    }
  } catch {
    // still clear cookies
  }
  const response = new NextResponse(null, { status: 204 });
  clearSessionCookies(response);
  return response;
}
