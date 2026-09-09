import { randomUUID } from 'node:crypto';
import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { SyncOperationType } from 'src/common/enums/sync.enum';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { Api, ok } from './utils/api-client';
import {
  createBranch,
  loginAsDirector,
  provisionUser,
  roleIdByCode,
  uniquePhone,
} from './utils/fixtures';
import { createTestApp } from './utils/test-app';

/**
 * `4.2`: proves `AppThrottlerGuard` actually rejects once a ceiling is crossed, with the
 * canonical error envelope and a correct `Retry-After` header — not just that wiring it in
 * left the rest of the suite green (`app.config.ts`'s `throttleEnabled` keeps every other
 * e2e spec exempt from it).
 *
 * `THROTTLE_ENABLED` has to be set before `AppModule` is compiled — `registerAs` factories
 * run once, at DI instantiation inside `createTestApp()`'s `compile()` — so it is set in
 * `beforeAll` right before that call, and restored in `afterAll` since Jest reuses this
 * worker's process (and therefore its `process.env`) for whichever e2e file runs next.
 */
describe('Rate limiting (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;
  const previousThrottleEnabled = process.env.THROTTLE_ENABLED;

  beforeAll(async () => {
    process.env.THROTTLE_ENABLED = 'true';
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);
  });

  afterAll(async () => {
    await app.close();
    if (previousThrottleEnabled === undefined) delete process.env.THROTTLE_ENABLED;
    else process.env.THROTTLE_ENABLED = previousThrottleEnabled;
  });

  /** A structurally-valid, cheap operation — what is throttled is the request, not its content. */
  function merchantOp(): Record<string, unknown> {
    return {
      clientUuid: randomUUID(),
      type: SyncOperationType.CREATE_MERCHANT,
      payload: {
        name: 'تاجر الاختبار',
        phone: uniquePhone(),
        shopName: 'محل الاختبار',
        address: 'شارع الاختبار، القاهرة',
      },
    };
  }

  it('throttles POST /sync/batch at 20/minute/user with a canonical 429 and Retry-After', async () => {
    // The 20th call still fits the window; only the 21st is over the ceiling.
    for (let i = 0; i < 20; i += 1) {
      await ok(director.post('/sync/batch', { operations: [merchantOp()] }));
    }

    const response = await director.post('/sync/batch', { operations: [merchantOp()] });

    expect(response.status).toBe(429);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('RATE_LIMITED');

    const retryAfter = response.headers['retry-after'];
    expect(retryAfter).toBeDefined();
    expect(retryAfter).toMatch(/^\d+$/);
    expect(Number(retryAfter)).toBeGreaterThan(0);
    expect(Number(retryAfter)).toBeLessThanOrEqual(60);
  });

  it('tracks by user, not IP: a second user is unaffected by the first one being throttled', async () => {
    const branch = await createBranch(director);
    const representative = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
      branchId: branch.id,
    });

    for (let i = 0; i < 21; i += 1) {
      await director.post('/sync/batch', { operations: [merchantOp()] });
    }

    await ok(representative.api.post('/sync/batch', { operations: [merchantOp()] }));
  });
});
