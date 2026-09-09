import type { App } from 'supertest/types';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Api } from './utils/api-client';
import { loginAsDirector } from './utils/fixtures';
import { createTestApp } from './utils/test-app';

/**
 * `4.4`: `GET /metrics` in Prometheus text format, plus its own bearer-token protection
 * (separate from the normal user JWT — a Prometheus scraper has neither). The committed `.env`
 * leaves `METRICS_TOKEN` unset for the rest of the suite (open, dev-mode behaviour); this file
 * covers both that default and the protected case with its own isolated app instances, the same
 * pattern `test/rate-limiting.e2e-spec.ts`/`test/client-version.e2e-spec.ts` use for env-gated
 * features — `registerAs('app', ...)` factories run lazily at `compile()`, so setting the env
 * var in `beforeAll` right before `createTestApp()` is early enough.
 */
describe('Metrics (e2e)', () => {
  describe('open by default (no METRICS_TOKEN configured)', () => {
    let app: INestApplication;
    let server: App;
    let director: Api;

    beforeAll(async () => {
      ({ app, server } = await createTestApp());
      director = await loginAsDirector(server);
    });

    afterAll(async () => {
      await app.close();
    });

    it('exposes Prometheus text format with no Authorization header', async () => {
      // Generates at least one real HTTP request for the histogram/counter below to have
      // recorded before the scrape.
      await director.get('/sync/status');

      const response = await request(server).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^text\/plain/);
      expect(response.text).toContain('machinery_api_http_requests_total');
      expect(response.text).toContain('machinery_api_http_request_duration_seconds');
      // A default `prom-client` process metric — proves `collectDefaultMetrics` is wired in,
      // independent of any request this suite made.
      expect(response.text).toMatch(/machinery_api_process_cpu_user_seconds_total/);
    });
  });

  describe('protected when METRICS_TOKEN is configured', () => {
    let app: INestApplication;
    let server: App;
    const token = 'a-real-metrics-token-value';
    const previousToken = process.env.METRICS_TOKEN;

    beforeAll(async () => {
      process.env.METRICS_TOKEN = token;
      ({ app, server } = await createTestApp());
    });

    afterAll(async () => {
      await app.close();
      if (previousToken === undefined) delete process.env.METRICS_TOKEN;
      else process.env.METRICS_TOKEN = previousToken;
    });

    it('refuses a scrape with no Authorization header', async () => {
      const response = await request(server).get('/metrics');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('refuses a scrape with the wrong token', async () => {
      const response = await request(server)
        .get('/metrics')
        .set('Authorization', 'Bearer not-the-right-token');
      expect(response.status).toBe(401);
    });

    it('allows a scrape with the correct bearer token', async () => {
      const response = await request(server)
        .get('/metrics')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.text).toContain('machinery_api_http_requests_total');
    });
  });
});
