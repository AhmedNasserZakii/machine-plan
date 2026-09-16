import { NextRequest, NextResponse } from 'next/server';

import { writeSessionCookies } from '@/lib/auth/cookies';
import { callUpstream, localeFromRequest } from '@/lib/auth/upstream';

const inflight = new Map<string, Promise<{ accessToken: string; refreshToken: string } | null>>();

export async function rotateRefreshToken(
  request: NextRequest,
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const existing = inflight.get(refreshToken);
  if (existing) return existing;

  const task = (async () => {
    const response = await callUpstream('auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': localeFromRequest(request),
        'X-Client-Version': process.env.NEXT_PUBLIC_CLIENT_VERSION ?? '1.0.0',
      },
      body: JSON.stringify({ refreshToken }),
    });
    const body = (await response.json().catch(() => null)) as
      | { success?: boolean; data?: { accessToken: string; refreshToken: string } }
      | null;
    if (!response.ok || !body?.data?.accessToken) return null;
    return body.data;
  })().finally(() => {
    inflight.delete(refreshToken);
  });

  inflight.set(refreshToken, task);
  return task;
}

export function attachRotatedCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken: string },
): NextResponse {
  writeSessionCookies(response, tokens);
  return response;
}
