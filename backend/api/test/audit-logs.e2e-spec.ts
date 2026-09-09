import type { App } from 'supertest/types';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditAction, AuditEntityType } from 'src/common/enums';
import { Api, fails, ok } from './utils/api-client';
import {
  createBranch,
  loginAsDirector,
  provisionUser,
  rolesByCode,
  uniqueCode,
  uniquePhone,
} from './utils/fixtures';
import { createTestApp } from './utils/test-app';

interface AuditLogResponse {
  id: string;
  createdAt: string;
  userId: string | null;
  action: AuditAction;
  entityType: AuditEntityType | null;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  requestId: string | null;
}

async function okCursor<T>(test: request.Test): Promise<{ items: T[]; nextCursor: string | null }> {
  const response = await test;

  if (response.status !== 200 || response.body?.success !== true) {
    throw new Error(
      `expected 200 success, got ${response.status} ${JSON.stringify(response.body)}`,
    );
  }

  return {
    items: response.body.data as T[],
    nextCursor: (response.body.meta?.nextCursor as string | null) ?? null,
  };
}

describe('Audit logs (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses a caller without audit.read', async () => {
    const scopelessRole = await ok<{ id: string }>(
      director.post('/roles', {
        code: uniqueCode('ROLE'),
        translations: { ar: { displayName: 'بلا صلاحية تدقيق' } },
        permissions: ['users.read'],
      }),
      201,
    );
    const caller = await provisionUser(server, director, { roleId: scopelessRole.id });

    await fails(caller.api.get('/audit-logs'), 403, 'INSUFFICIENT_PERMISSIONS');
  });

  it('records a login and returns it filtered by user and action', async () => {
    const roles = await rolesByCode(director);
    const user = await provisionUser(server, director, { roleId: roles.get('VIEWER')!.id });

    const page = await okCursor<AuditLogResponse>(
      director.get(`/audit-logs?userId=${user.id}&action=${AuditAction.LOGIN_SUCCESS}&limit=10`),
    );

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((row) => row.userId === user.id)).toBe(true);
    expect(page.items.every((row) => row.action === AuditAction.LOGIN_SUCCESS)).toBe(true);
  });

  it('finds the branch-creation event through the entity view', async () => {
    const branch = await createBranch(director, 'فرع للبحث بالكيان');

    const page = await okCursor<AuditLogResponse>(
      director.get(`/audit-logs/entity/${AuditEntityType.BRANCH}/${branch.id}`),
    );

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      action: AuditAction.BRANCH_CREATED,
      entityType: AuditEntityType.BRANCH,
      entityId: branch.id,
    });
    expect(page.items[0].after).toMatchObject({ code: branch.code, name: branch.name });
  });

  it('redacts the national id in a stored merchant diff', async () => {
    const merchant = await ok<{ id: string }>(
      director.post('/merchants', {
        name: 'تاجر التدقيق',
        phone: uniquePhone(),
        shopName: 'محل التدقيق',
        address: 'شارع الاختبار',
        nationalId: '29001010112345',
      }),
      201,
    );

    await ok(director.patch(`/merchants/${merchant.id}`, { nationalId: '29001010199999' }));

    const page = await okCursor<AuditLogResponse>(
      director.get(
        `/audit-logs/entity/${AuditEntityType.MERCHANT}/${merchant.id}?action=${AuditAction.MERCHANT_UPDATED}`,
      ),
    );

    expect(page.items).toHaveLength(1);
    expect(page.items[0].before).toMatchObject({ nationalId: '[REDACTED]' });
    expect(page.items[0].after).toMatchObject({ nationalId: '[REDACTED]' });
  });

  it('paginates with a keyset cursor that never repeats a row', async () => {
    const roles = await rolesByCode(director);
    const user = await provisionUser(server, director, { roleId: roles.get('VIEWER')!.id });
    const userId = user.id;

    // Three more logins for the same user give three fresh LOGIN_SUCCESS rows to page through,
    // on top of the one `provisionUser` itself already produced.
    for (let i = 0; i < 3; i += 1) {
      await ok(new Api(server).post('/auth/login', { phone: user.phone, password: user.password }));
    }

    const first = await okCursor<AuditLogResponse>(
      director.get(`/audit-logs?userId=${userId}&action=${AuditAction.LOGIN_SUCCESS}&limit=2`),
    );
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const second = await okCursor<AuditLogResponse>(
      director.get(
        `/audit-logs?userId=${userId}&action=${AuditAction.LOGIN_SUCCESS}&limit=2&cursor=${encodeURIComponent(first.nextCursor!)}`,
      ),
    );
    expect(second.items.length).toBeGreaterThan(0);

    const firstIds = new Set(first.items.map((row) => row.id));
    expect(second.items.every((row) => !firstIds.has(row.id))).toBe(true);
  });

  it('cannot be updated or deleted by the application database role', async () => {
    // A superuser bypasses every ACL check, so a real UPDATE/DELETE would misleadingly
    // succeed on the local/dev role this suite runs as. Reading the grant back from
    // `pg_class` proves the migration's REVOKE actually landed, independent of that.
    const [grants] = await dataSource.query<
      Array<{ can_update: boolean; can_delete: boolean; can_insert: boolean }>
    >(`
      SELECT
        bool_or(privilege_type = 'UPDATE') AS can_update,
        bool_or(privilege_type = 'DELETE') AS can_delete,
        bool_or(privilege_type = 'INSERT') AS can_insert
      FROM (
        SELECT (aclexplode(relacl)).privilege_type,
               (aclexplode(relacl)).grantee::regrole::text AS grantee
        FROM pg_class
        WHERE relname = 'audit_logs'
      ) acl
      WHERE grantee = current_user
    `);

    expect(grants.can_update).toBe(false);
    expect(grants.can_delete).toBe(false);
    expect(grants.can_insert).toBe(true);
  });
});
