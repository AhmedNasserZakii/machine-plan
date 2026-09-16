import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { requestOriginAllowed, upstreamHeaders } from './upstream';

describe('BFF origin check', () => {
  it('allows GET without origin and rejects cross-origin mutations', () => {
    const get = new NextRequest('http://localhost:3001/api/bff/x', { method: 'GET' });
    expect(requestOriginAllowed(get)).toBe(true);

    const ok = new NextRequest('http://localhost:3001/api/bff/x', {
      method: 'POST',
      headers: { origin: 'http://localhost:3001' },
    });
    expect(requestOriginAllowed(ok)).toBe(true);

    const evil = new NextRequest('http://localhost:3001/api/bff/x', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
    });
    expect(requestOriginAllowed(evil)).toBe(false);

    const missing = new NextRequest('http://localhost:3001/api/bff/x', { method: 'POST' });
    expect(requestOriginAllowed(missing)).toBe(false);
  });

  it('forwards the original Idempotency-Key', () => {
    const request = new NextRequest('http://localhost:3001/api/bff/transfers', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'intent-1', origin: 'http://localhost:3001' },
    });
    expect(upstreamHeaders(request).get('Idempotency-Key')).toBe('intent-1');
  });
});
