import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { ACCESS_COOKIE, clearSessionCookies, REFRESH_COOKIE, writeSessionCookies } from '@/lib/auth/cookies';
import { rotateRefreshToken } from '@/lib/auth/refresh-lock';
import {
  callUpstream,
  originRejected,
  requestOriginAllowed,
  upstreamHeaders,
} from '@/lib/auth/upstream';

export const dynamic = 'force-dynamic';

async function proxy(request: NextRequest, path: string[]) {
  if (!requestOriginAllowed(request)) return originRejected();

  const store = await cookies();
  let access = store.get(ACCESS_COOKIE)?.value;
  const refresh = store.get(REFRESH_COOKIE)?.value;
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
  const search = request.nextUrl.search;
  const upstreamPath = `${path.join('/')}${search}`;

  const send = (token?: string) =>
    callUpstream(upstreamPath, {
      method: request.method,
      headers: upstreamHeaders(request, token),
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: 'manual',
    });

  let upstream = await send(access);
  let rotated: { accessToken: string; refreshToken: string } | null = null;
  if (upstream.status === 401 && refresh) {
    rotated = await rotateRefreshToken(request, refresh);
    if (rotated) {
      access = rotated.accessToken;
      upstream = await send(access);
    }
  }

  const headers = new Headers(upstream.headers);
  headers.delete('set-cookie');
  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
  if (rotated) {
    writeSessionCookies(response, rotated);
  } else if (upstream.status === 401) {
    clearSessionCookies(response);
  }
  return response;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await ctx.params).path);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await ctx.params).path);
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await ctx.params).path);
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await ctx.params).path);
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await ctx.params).path);
}
