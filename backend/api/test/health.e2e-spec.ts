import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './utils/test-app';

describe('Foundation (e2e)', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('returns liveness without the response envelope', async () => {
      const response = await request(server).get('/health').expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body).not.toHaveProperty('success');
    });

    it('attaches a request id header', async () => {
      const response = await request(server).get('/health').expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('echoes an inbound request id so a client can correlate its own logs', async () => {
      const response = await request(server)
        .get('/health')
        .set('X-Request-Id', 'client-supplied-id')
        .expect(200);

      expect(response.headers['x-request-id']).toBe('client-supplied-id');
    });
  });

  describe('GET /health/ready', () => {
    it('reports the database as up', async () => {
      const response = await request(server).get('/health/ready').expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.info.database.status).toBe('up');
    });
  });

  describe('locale resolution', () => {
    it('defaults to ar', async () => {
      const response = await request(server).get('/health').expect(200);

      expect(response.headers['content-language']).toBe('ar');
    });

    it('honours the Accept-Language header', async () => {
      const response = await request(server)
        .get('/health')
        .set('Accept-Language', 'en-US,en;q=0.9')
        .expect(200);

      expect(response.headers['content-language']).toBe('en');
    });

    it('lets ?locale override the header', async () => {
      const response = await request(server)
        .get('/health?locale=en')
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(response.headers['content-language']).toBe('en');
    });

    it('falls back to ar for an unsupported language', async () => {
      const response = await request(server)
        .get('/health')
        .set('Accept-Language', 'fr')
        .expect(200);

      expect(response.headers['content-language']).toBe('ar');
    });
  });

  describe('error envelope', () => {
    it('returns the unified shape with a stable code for an unknown route', async () => {
      const response = await request(server).get('/api/v1/nope').expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'NOT_FOUND' },
      });
      expect(response.body.error.requestId).toBeDefined();
      expect(response.body.error.timestamp).toBeDefined();
    });

    it('keeps the framework 404 message for an unrouted path', async () => {
      // Nothing localizes this one: it never reaches a handler, so the client relies on the
      // code rather than the message. Domain 404s are localized — see the branches spec.
      const response = await request(server).get('/api/v1/nope').expect(404);

      expect(response.body.error.message).toContain('/api/v1/nope');
    });

    it('localizes a domain error message', async () => {
      const arabic = await request(server)
        .post('/api/v1/auth/login')
        .send({ phone: '01000000000' })
        .expect(400);
      const english = await request(server)
        .post('/api/v1/auth/login')
        .set('Accept-Language', 'en')
        .send({ phone: '01000000000' })
        .expect(400);

      expect(arabic.body.error.message).not.toBe(english.body.error.message);
      expect(arabic.body.error.message).toBe('البيانات المرسلة غير صحيحة');
    });

    it('reports the offending field path for a nested validation failure', async () => {
      const response = await request(server)
        .post('/api/v1/auth/login')
        .send({ phone: '01000000000' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'password' })]),
      );
    });
  });
});
