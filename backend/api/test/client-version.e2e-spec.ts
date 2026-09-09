import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { Api, fails, ok } from './utils/api-client';
import { loginAsDirector } from './utils/fixtures';
import { createTestApp } from './utils/test-app';

/**
 * `4.3`: forced client upgrades (plan `22`). `MIN_CLIENT_VERSION` has to be set before
 * `AppModule` is compiled — `registerAs` factories run once, at DI instantiation inside
 * `createTestApp()`'s `compile()` — so it is set in `beforeAll` right before that call, and
 * restored in `afterAll` since Jest reuses this worker's process for whichever e2e file runs
 * next (the committed `.env` ships `MIN_CLIENT_VERSION=` empty, i.e. the feature off, for every
 * other spec).
 */
describe('Forced client upgrades (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;
  const previousMinVersion = process.env.MIN_CLIENT_VERSION;

  beforeAll(async () => {
    process.env.MIN_CLIENT_VERSION = '2.1.0';
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);
  });

  afterAll(async () => {
    await app.close();
    if (previousMinVersion === undefined) delete process.env.MIN_CLIENT_VERSION;
    else process.env.MIN_CLIENT_VERSION = previousMinVersion;
  });

  it('refuses an ordinary authenticated route below the minimum version', async () => {
    const error = await fails(
      director.get('/sync/status').set('X-Client-Version', '2.0.9'),
      426,
      'CLIENT_UPGRADE_REQUIRED',
    );

    expect((error as unknown as { minVersion: string }).minVersion).toBe('2.1.0');
  });

  it('allows a request exactly at the minimum version', async () => {
    await ok(director.get('/sync/status').set('X-Client-Version', '2.1.0'));
  });

  it('allows a request above the minimum version', async () => {
    await ok(director.get('/sync/status').set('X-Client-Version', '2.1.1'));
  });

  it('allows a request that omits the header — it is recommended, not required', async () => {
    await ok(director.get('/sync/status'));
  });

  it('allows a request with a header that does not parse as a version', async () => {
    await ok(director.get('/sync/status').set('X-Client-Version', 'not-a-version'));
  });

  it('blocks an unauthenticated route too — the app must see it before it can even log in', async () => {
    await fails(
      director.as(null).post('/auth/login', {}).set('X-Client-Version', '1.0.0'),
      426,
      'CLIENT_UPGRADE_REQUIRED',
    );
  });

  it('never blocks health checks, which cannot send the header at all', async () => {
    const response = await director.as(null).get('/health').set('X-Client-Version', '0.0.1');
    expect(response.status).toBe(200);
  });
});
