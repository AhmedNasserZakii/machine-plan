import { NextRequest, NextResponse } from 'next/server';

import { writeSessionCookies } from '@/lib/auth/cookies';
import {
  callUpstream,
  localeFromRequest,
  originRejected,
  requestOriginAllowed,
  upstreamHeaders,
} from '@/lib/auth/upstream';

export async function POST(request: NextRequest) {
  if (!requestOriginAllowed(request)) return originRejected();

  const payload = await request.text();
  const upstream = await callUpstream('auth/login', {
    method: 'POST',
    headers: upstreamHeaders(request),
    body: payload,
  });
  const body = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return NextResponse.json(body, { status: upstream.status });
  }

  const tokens = body?.data as { accessToken: string; refreshToken: string } | undefined;
  if (!tokens?.accessToken || !tokens.refreshToken) {
    return NextResponse.json(
      { success: false, error: { code: 'UNEXPECTED_RESPONSE', message: 'Missing tokens' } },
      { status: 502 },
    );
  }

  const me = await callUpstream('auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Accept-Language': localeFromRequest(request),
      'X-Client-Version': process.env.NEXT_PUBLIC_CLIENT_VERSION ?? '1.0.0',
    },
  });
  const meBody = await me.json().catch(() => null);
  if (!me.ok) {
    return NextResponse.json(meBody, { status: me.status });
  }
  const response = NextResponse.json(meBody);
  writeSessionCookies(response, tokens);
  return response;
}
