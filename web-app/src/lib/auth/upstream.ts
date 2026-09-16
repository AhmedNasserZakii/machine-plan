import { NextRequest, NextResponse } from 'next/server';

export function clientVersion(): string {
  return process.env.NEXT_PUBLIC_CLIENT_VERSION ?? '1.0.0';
}

export function apiBaseUrl(): string {
  const url = process.env.API_BASE_URL;
  if (!url) {
    throw new Error('API_BASE_URL is not set');
  }
  return url.replace(/\/$/, '');
}

export function requestOriginAllowed(request: NextRequest): boolean {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return true;
  }
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const host = request.headers.get('host') ?? request.nextUrl.host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function originRejected(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHENTICATED', message: 'Invalid origin' } },
    { status: 403 },
  );
}

export function localeFromRequest(request: NextRequest): string {
  return request.cookies.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'ar';
}

export function upstreamHeaders(
  request: NextRequest,
  accessToken?: string,
): Headers {
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  headers.set('Accept', request.headers.get('accept') ?? 'application/json');
  headers.set('Accept-Language', localeFromRequest(request));
  headers.set('X-Client-Version', clientVersion());
  const idempotency = request.headers.get('Idempotency-Key') ?? request.headers.get('idempotency-key');
  if (idempotency) headers.set('Idempotency-Key', idempotency);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return headers;
}

export async function callUpstream(
  path: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(`${apiBaseUrl()}/${path.replace(/^\//, '')}`, init);
}
