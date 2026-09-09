import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PartyType } from 'src/common/enums/transfer.enum';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { Api, fails, hasFieldError, ok, okPage } from './utils/api-client';
import {
  BranchFixture,
  createBranch,
  createMerchant,
  login,
  loginAsDirector,
  provisionUser,
  rolesByCode,
  uniqueCode,
  uniquePhone,
} from './utils/fixtures';
import { createTestApp } from './utils/test-app';

interface UserResponse {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: { id: string; code: string; displayName: string };
  branchId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

interface UserPermissionsResponse {
  userId: string;
  rolePermissions: string[];
  overrides: { code: string; effect: 'ALLOW' | 'DENY' }[];
  effectivePermissions: string[];
}

interface UserCustodyResponse {
  user: { id: string; fullName: string; role: string };
  summary: { totalMachines: number; withMerchants: number; inHand: number; openViolations: number };
  machines: Array<{
    id: string;
    serial: string;
    model: string;
    status: string;
    merchant: { id: string; shopName: string } | null;
    heldSince: string;
  }>;
}

const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;
  let roles: Map<string, { id: string; code: string }>;
  let branch: BranchFixture;
  let dataSource: DataSource;
  let machineModelId: string;

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);
    dataSource = app.get(DataSource);
    roles = await rolesByCode(director);
    branch = await createBranch(director, 'فرع المستخدمين');
    const models = await ok<Array<{ id: string; machineType: { requiresSim: boolean } }>>(
      director.get('/machine-models'),
    );
    machineModelId = models.find((model) => model.machineType.requiresSim)!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const roleId = (code: string): string => {
    const role = roles.get(code);
    if (!role) throw new Error(`role ${code} missing`);
    return role.id;
  };

  async function createMachine(): Promise<{ id: string; serial: string }> {
    const serial = uniqueCode('CUSTODY_SN');
    return ok(
      director.post('/machines', {
        serial,
        machineModelId,
        battery: { serial: `BT_${serial}` },
        simSerial: `SIM_${serial}`,
        hasBox: true,
      }),
      201,
    );
  }

  describe('POST /users', () => {
    it('creates a user who must change the password on first login', async () => {
      const phone = uniquePhone();

      const created = await ok<UserResponse>(
        director.post('/users', {
          fullName: 'أحمد المندوب',
          phone,
          email: `${uniqueCode('mail').toLowerCase()}@example.com`,
          roleId: roleId(SystemRole.REPRESENTATIVE),
          branchId: branch.id,
          password: 'Temp#Pass1',
        }),
        201,
      );

      expect(created).toMatchObject({
        fullName: 'أحمد المندوب',
        phone,
        branchId: branch.id,
        isActive: true,
        mustChangePassword: true,
        role: { code: SystemRole.REPRESENTATIVE },
      });
    });

    it('requires a branch for branch-scoped roles', async () => {
      const error = await fails(
        director.post('/users', {
          fullName: 'مندوب بلا فرع',
          phone: uniquePhone(),
          roleId: roleId(SystemRole.REPRESENTATIVE),
          password: 'Temp#Pass1',
        }),
        400,
        'BRANCH_REQUIRED_FOR_ROLE',
      );

      expect(hasFieldError(error, 'branchId')).toBe(true);
    });

    it('allows company-level roles without a branch', async () => {
      const created = await ok<UserResponse>(
        director.post('/users', {
          fullName: 'محاسب الشركة',
          phone: uniquePhone(),
          roleId: roleId(SystemRole.ACCOUNTANT),
          password: 'Temp#Pass1',
        }),
        201,
      );

      expect(created.branchId).toBeNull();
    });

    it('rejects a duplicate phone and a duplicate email', async () => {
      const phone = uniquePhone();
      const email = `${uniqueCode('mail').toLowerCase()}@example.com`;

      await ok(
        director.post('/users', {
          fullName: 'الأول',
          phone,
          email,
          roleId: roleId(SystemRole.VIEWER),
          password: 'Temp#Pass1',
        }),
        201,
      );

      await fails(
        director.post('/users', {
          fullName: 'الثاني',
          phone,
          roleId: roleId(SystemRole.VIEWER),
          password: 'Temp#Pass1',
        }),
        409,
        'PHONE_EXISTS',
      );

      await fails(
        director.post('/users', {
          fullName: 'الثالث',
          phone: uniquePhone(),
          email,
          roleId: roleId(SystemRole.VIEWER),
          password: 'Temp#Pass1',
        }),
        409,
        'EMAIL_EXISTS',
      );
    });

    it('validates the phone format and the password length', async () => {
      const error = await fails(
        director.post('/users', {
          fullName: 'x',
          phone: '0501234567',
          roleId: roleId(SystemRole.VIEWER),
          password: 'short',
        }),
        400,
        'VALIDATION_FAILED',
      );

      expect(hasFieldError(error, 'phone')).toBe(true);
      expect(hasFieldError(error, 'password')).toBe(true);
      expect(hasFieldError(error, 'fullName')).toBe(true);
    });

    it('replays a mutation with the same idempotency key and rejects a changed payload', async () => {
      const phone = uniquePhone();
      const key = uniqueCode('IDEMPOTENCY');
      const body = {
        fullName: 'مستخدم آمن من التكرار',
        phone,
        roleId: roleId(SystemRole.VIEWER),
        password: 'Temp#Pass1',
      };

      const first = await ok<UserResponse>(
        director.post('/users', body).set('Idempotency-Key', key),
        201,
      );
      const replay = await ok<UserResponse>(
        director.post('/users', body).set('Idempotency-Key', key),
        201,
      );

      expect(replay.id).toBe(first.id);
      await fails(
        director.post('/users', { ...body, fullName: 'حمولة مختلفة' }).set('Idempotency-Key', key),
        409,
        'IDEMPOTENCY_KEY_REUSED',
      );
    });

    it('allows only one effect when identical mutation requests race', async () => {
      const phone = uniquePhone();
      const key = uniqueCode('IDEMPOTENCY_RACE');
      const body = {
        fullName: 'مستخدم سباق التكرار',
        phone,
        roleId: roleId(SystemRole.VIEWER),
        password: 'Temp#Pass1',
      };

      const responses = await Promise.all([
        director.post('/users', body).set('Idempotency-Key', key),
        director.post('/users', body).set('Idempotency-Key', key),
      ]);

      expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
      expect(
        responses.every(
          (response) =>
            response.status === 201 ||
            (response.status === 409 &&
              response.body?.error?.code === 'IDEMPOTENT_REQUEST_IN_PROGRESS'),
        ),
      ).toBe(true);

      const { items } = await okPage<UserResponse>(director.get(`/users?search=${phone}`));
      expect(items).toHaveLength(1);

      const replay = await ok<UserResponse>(
        director.post('/users', body).set('Idempotency-Key', key),
        201,
      );
      expect(replay.id).toBe(items[0].id);
    });

    it('rejects an unknown role and an unknown branch', async () => {
      const unknownRole = await fails(
        director.post('/users', {
          fullName: 'دور مجهول',
          phone: uniquePhone(),
          roleId: UNKNOWN_UUID,
          password: 'Temp#Pass1',
        }),
        400,
        'VALIDATION_FAILED',
      );
      expect(hasFieldError(unknownRole, 'roleId')).toBe(true);

      const unknownBranch = await fails(
        director.post('/users', {
          fullName: 'فرع مجهول',
          phone: uniquePhone(),
          roleId: roleId(SystemRole.REPRESENTATIVE),
          branchId: UNKNOWN_UUID,
          password: 'Temp#Pass1',
        }),
        400,
        'VALIDATION_FAILED',
      );
      expect(hasFieldError(unknownBranch, 'branchId')).toBe(true);
    });
  });

  describe('GET /users', () => {
    it('paginates with a meta block', async () => {
      const { items, meta } = await okPage<UserResponse>(director.get('/users?page=1&limit=2'));

      expect(items.length).toBeLessThanOrEqual(2);
      expect(meta).toMatchObject({ page: 1, limit: 2 });
      expect(meta.total).toBeGreaterThan(0);
      expect(meta.totalPages).toBe(Math.ceil(meta.total / 2));
      expect(meta.hasNext).toBe(meta.totalPages > 1);
    });

    it('filters by role, branch, active flag and free-text search', async () => {
      const phone = uniquePhone();
      await ok(
        director.post('/users', {
          fullName: 'قابل للبحث فريد',
          phone,
          roleId: roleId(SystemRole.VIEWER),
          password: 'Temp#Pass1',
        }),
        201,
      );

      const byRole = await okPage<UserResponse>(
        director.get(`/users?roleId=${roleId(SystemRole.VIEWER)}&limit=100`),
      );
      expect(byRole.items.every((user) => user.role.code === SystemRole.VIEWER)).toBe(true);

      const byBranch = await okPage<UserResponse>(
        director.get(`/users?branchId=${branch.id}&limit=100`),
      );
      expect(byBranch.items.every((user) => user.branchId === branch.id)).toBe(true);

      const bySearch = await okPage<UserResponse>(director.get(`/users?search=${phone}`));
      expect(bySearch.items).toHaveLength(1);
      expect(bySearch.items[0].phone).toBe(phone);

      const active = await okPage<UserResponse>(director.get('/users?isActive=true&limit=100'));
      expect(active.items.every((user) => user.isActive)).toBe(true);
    });

    it('rejects an unknown query parameter and an unsupported sort field', async () => {
      await fails(director.get('/users?nope=1'), 400, 'VALIDATION_FAILED');
      await fails(director.get('/users?sortBy=passwordHash'), 400, 'VALIDATION_FAILED');
      await fails(director.get('/users?limit=1000'), 400, 'VALIDATION_FAILED');
    });
  });

  describe('GET /users/:id', () => {
    it('returns one user, 404s an unknown id and 400s a malformed one', async () => {
      const user = await provisionUser(server, director, { roleId: roleId(SystemRole.VIEWER) });

      const found = await ok<UserResponse>(director.get(`/users/${user.id}`));
      expect(found.id).toBe(user.id);

      await fails(director.get(`/users/${UNKNOWN_UUID}`), 404, 'NOT_FOUND');
      await fails(director.get('/users/nope'), 400, 'VALIDATION_FAILED');
    });
  });

  describe('PATCH /users/:id', () => {
    it('updates the profile', async () => {
      const user = await provisionUser(server, director, { roleId: roleId(SystemRole.VIEWER) });

      const updated = await ok<UserResponse>(
        director.patch(`/users/${user.id}`, { fullName: 'الاسم بعد التعديل' }),
      );

      expect(updated.fullName).toBe('الاسم بعد التعديل');
    });

    it('refuses to let a caller change their own role', async () => {
      const me = await ok<{ id: string }>(director.get('/auth/me'));

      await fails(
        director.patch(`/users/${me.id}`, { roleId: roleId(SystemRole.VIEWER) }),
        403,
        'CANNOT_EDIT_OWN_PERMISSIONS',
      );
    });

    it('refuses to move a branch-scoped user off their branch', async () => {
      const user = await provisionUser(server, director, {
        roleId: roleId(SystemRole.REPRESENTATIVE),
        branchId: branch.id,
      });

      await fails(
        director.patch(`/users/${user.id}`, { branchId: null }),
        400,
        'BRANCH_REQUIRED_FOR_ROLE',
      );
    });
  });

  describe('deactivate / activate', () => {
    it('deactivates, revokes the sessions, then reactivates', async () => {
      const user = await provisionUser(server, director, { roleId: roleId(SystemRole.VIEWER) });

      const deactivated = await ok<UserResponse>(director.patch(`/users/${user.id}/deactivate`));
      expect(deactivated.isActive).toBe(false);

      await fails(
        new Api(server).post('/auth/login', { phone: user.phone, password: user.password }),
        403,
        'ACCOUNT_INACTIVE',
      );

      const reactivated = await ok<UserResponse>(director.patch(`/users/${user.id}/activate`));
      expect(reactivated.isActive).toBe(true);

      // The account works again after reactivation.
      await login(server, user.phone, user.password);
    });

    it('is idempotent', async () => {
      const user = await provisionUser(server, director, { roleId: roleId(SystemRole.VIEWER) });

      await ok(director.patch(`/users/${user.id}/deactivate`));
      const again = await ok<UserResponse>(director.patch(`/users/${user.id}/deactivate`));

      expect(again.isActive).toBe(false);
    });

    it('refuses to deactivate a user accountable for machine custody', async () => {
      const representative = await provisionUser(server, director, {
        roleId: roleId(SystemRole.REPRESENTATIVE),
        branchId: branch.id,
      });
      const directMachine = await createMachine();
      const merchantMachine = await createMachine();
      const merchant = await createMerchant(representative.api, 'تاجر عهدة المستخدم');

      await dataSource.getRepository(Machine).update(directMachine.id, {
        currentHolderType: PartyType.REPRESENTATIVE,
        currentHolderId: representative.id,
        currentBranchId: branch.id,
      });
      await dataSource.getRepository(Machine).update(merchantMachine.id, {
        currentHolderType: PartyType.MERCHANT,
        currentHolderId: merchant.id,
        currentBranchId: branch.id,
      });

      const custody = await ok<UserCustodyResponse>(
        director.get(`/users/${representative.id}/custody`),
      );
      expect(custody.user).toMatchObject({
        id: representative.id,
        role: SystemRole.REPRESENTATIVE,
      });
      expect(custody.summary).toMatchObject({
        totalMachines: 2,
        withMerchants: 1,
        inHand: 1,
      });
      expect(
        custody.machines.find((machine) => machine.id === merchantMachine.id)?.merchant,
      ).toEqual({ id: merchant.id, shopName: merchant.shopName });

      await fails(
        director.patch(`/users/${representative.id}/deactivate`),
        409,
        'USER_HAS_CUSTODY',
      );
    });

    it('refuses self-deactivation', async () => {
      const me = await ok<{ id: string }>(director.get('/auth/me'));

      await fails(director.patch(`/users/${me.id}/deactivate`), 403, 'CANNOT_EDIT_OWN_PERMISSIONS');
    });

    it('never leaves the system without an active Director', async () => {
      // A custom role is needed here: only a non-Director holding users.deactivate can
      // reach the rule, since a Director would be stopped by the self-edit guard first.
      const adminRole = await ok<{ id: string }>(
        director.post('/roles', {
          code: uniqueCode('ROLE'),
          translations: { ar: { displayName: 'مسؤول مستخدمين' } },
          permissions: ['users.read', 'users.deactivate', 'machines.read.all'],
        }),
        201,
      );

      const admin = await provisionUser(server, director, { roleId: adminRole.id });
      const me = await ok<{ id: string }>(director.get('/auth/me'));

      await fails(admin.api.patch(`/users/${me.id}/deactivate`), 422, 'LAST_DIRECTOR');

      // The Director is untouched.
      const stillActive = await ok<UserResponse>(director.get(`/users/${me.id}`));
      expect(stillActive.isActive).toBe(true);
    });
  });

  describe('GET /users/:id/custody', () => {
    it('returns an empty summary for a user holding nothing', async () => {
      const user = await provisionUser(server, director, { roleId: roleId(SystemRole.VIEWER) });

      const custody = await ok<UserCustodyResponse>(director.get(`/users/${user.id}/custody`));

      expect(custody.summary).toEqual({
        totalMachines: 0,
        withMerchants: 0,
        inHand: 0,
        openViolations: 0,
      });
      expect(custody.machines).toEqual([]);
    });

    it('reports a single machine held directly by the user', async () => {
      const representative = await provisionUser(server, director, {
        roleId: roleId(SystemRole.REPRESENTATIVE),
        branchId: branch.id,
      });
      const machine = await createMachine();
      await dataSource.getRepository(Machine).update(machine.id, {
        currentHolderType: PartyType.REPRESENTATIVE,
        currentHolderId: representative.id,
        currentBranchId: branch.id,
      });

      const custody = await ok<UserCustodyResponse>(
        director.get(`/users/${representative.id}/custody`),
      );

      expect(custody.summary).toMatchObject({ totalMachines: 1, withMerchants: 0, inHand: 1 });
      expect(custody.machines).toHaveLength(1);
      expect(custody.machines[0]).toMatchObject({ id: machine.id, merchant: null });
    });

    it('refuses a caller without machines.read', async () => {
      const scopelessRole = await ok<{ id: string }>(
        director.post('/roles', {
          code: uniqueCode('ROLE'),
          translations: { ar: { displayName: 'بلا صلاحية عهدة' } },
          permissions: ['users.read'],
        }),
        201,
      );
      const caller = await provisionUser(server, director, { roleId: scopelessRole.id });
      const target = await provisionUser(server, director, { roleId: roleId(SystemRole.VIEWER) });

      await fails(caller.api.get(`/users/${target.id}/custody`), 403, 'INSUFFICIENT_PERMISSIONS');
    });

    it('hides a user outside the caller branch scope', async () => {
      const other = await createBranch(director, 'فرع عهدة آخر');
      const supervisor = await provisionUser(server, director, {
        roleId: roleId(SystemRole.BRANCH_SUPERVISOR),
        branchId: branch.id,
      });
      const outsider = await provisionUser(server, director, {
        roleId: roleId(SystemRole.REPRESENTATIVE),
        branchId: other.id,
      });

      await fails(supervisor.api.get(`/users/${outsider.id}/custody`), 404, 'NOT_FOUND');
    });
  });

  describe('GET /users/:id/violations', () => {
    it('returns a scoped paginated list for the requested user', async () => {
      const representative = await provisionUser(server, director, {
        roleId: roleId(SystemRole.REPRESENTATIVE),
        branchId: branch.id,
      });

      const { items, meta } = await okPage(
        director.get(`/users/${representative.id}/violations?page=1&limit=10`),
      );

      expect(items).toEqual([]);
      expect(meta).toMatchObject({ page: 1, limit: 10, total: 0 });
    });

    it('refuses a caller without violations.read', async () => {
      const scopelessRole = await ok<{ id: string }>(
        director.post('/roles', {
          code: uniqueCode('ROLE'),
          translations: { ar: { displayName: 'بلا صلاحية مخالفات' } },
          permissions: ['users.read'],
        }),
        201,
      );
      const caller = await provisionUser(server, director, { roleId: scopelessRole.id });
      const target = await provisionUser(server, director, { roleId: roleId(SystemRole.VIEWER) });

      await fails(
        caller.api.get(`/users/${target.id}/violations`),
        403,
        'INSUFFICIENT_PERMISSIONS',
      );
    });

    it('never returns another branch violation for a scoped caller', async () => {
      // Unlike `/custody`, this route filters violations by their own `branchId` rather than
      // rejecting an out-of-scope subject outright, so a cross-branch query answers 200 with an
      // empty page instead of 404 — this pins that behaviour rather than asserting a 404 that
      // the route does not actually produce.
      const other = await createBranch(director, 'فرع مخالفات آخر');
      const supervisor = await provisionUser(server, director, {
        roleId: roleId(SystemRole.BRANCH_SUPERVISOR),
        branchId: branch.id,
      });
      const outsider = await provisionUser(server, director, {
        roleId: roleId(SystemRole.REPRESENTATIVE),
        branchId: other.id,
      });

      const page = await okPage(supervisor.api.get(`/users/${outsider.id}/violations`));
      expect(page.items).toEqual([]);
    });
  });

  describe('POST /users/:id/reset-password', () => {
    it('issues a temporary password that forces a change', async () => {
      const user = await provisionUser(server, director, { roleId: roleId(SystemRole.VIEWER) });

      const reset = await ok<{ userId: string; temporaryPassword: string | null }>(
        director.post(`/users/${user.id}/reset-password`, {}),
      );

      expect(reset.userId).toBe(user.id);
      expect(reset.temporaryPassword).toBeTruthy();

      const session = await login(server, user.phone, reset.temporaryPassword as string);
      expect(session.mustChangePassword).toBe(true);

      // The old password no longer works.
      await fails(
        new Api(server).post('/auth/login', { phone: user.phone, password: user.password }),
        401,
        'INVALID_CREDENTIALS',
      );
    });

    it('accepts an explicit password and returns no temporary one', async () => {
      const user = await provisionUser(server, director, { roleId: roleId(SystemRole.VIEWER) });

      const reset = await ok<{ temporaryPassword: string | null }>(
        director.post(`/users/${user.id}/reset-password`, { newPassword: 'Chosen#Pass1' }),
      );

      expect(reset.temporaryPassword).toBeNull();
      await login(server, user.phone, 'Chosen#Pass1');
    });
  });

  describe('per-user permission overrides', () => {
    it('reports role permissions, overrides and the effective set', async () => {
      const user = await provisionUser(server, director, { roleId: roleId(SystemRole.VIEWER) });

      const before = await ok<UserPermissionsResponse>(
        director.get(`/users/${user.id}/permissions`),
      );
      expect(before.overrides).toEqual([]);
      expect(before.effectivePermissions).toEqual(before.rolePermissions);
      expect(before.rolePermissions).not.toContain('finance.read');
    });

    it('grants a permission the role does not have', async () => {
      const user = await provisionUser(server, director, { roleId: roleId(SystemRole.VIEWER) });

      await fails(user.api.get('/payment-methods'), 403, 'INSUFFICIENT_PERMISSIONS');

      await ok(director.put(`/users/${user.id}/permissions`, { allow: ['finance.read'] }), 200);

      const after = await ok<UserPermissionsResponse>(
        director.get(`/users/${user.id}/permissions`),
      );
      expect(after.overrides).toEqual([{ code: 'finance.read', effect: 'ALLOW' }]);
      expect(after.effectivePermissions).toContain('finance.read');

      await ok(user.api.get('/payment-methods'));
    });

    it('revokes a permission the role does have', async () => {
      const user = await provisionUser(server, director, { roleId: roleId(SystemRole.VIEWER) });

      await ok(user.api.get('/violation-types'));

      await ok(director.put(`/users/${user.id}/permissions`, { deny: ['machines.read'] }));

      const after = await ok<UserPermissionsResponse>(
        director.get(`/users/${user.id}/permissions`),
      );
      expect(after.effectivePermissions).not.toContain('machines.read');
      expect(after.rolePermissions).toContain('machines.read');
    });

    it('replaces the whole override set on each call', async () => {
      const user = await provisionUser(server, director, { roleId: roleId(SystemRole.VIEWER) });

      await ok(director.put(`/users/${user.id}/permissions`, { allow: ['finance.read'] }));
      await ok(director.put(`/users/${user.id}/permissions`, { allow: ['reports.export'] }));

      const after = await ok<UserPermissionsResponse>(
        director.get(`/users/${user.id}/permissions`),
      );
      expect(after.overrides).toEqual([{ code: 'reports.export', effect: 'ALLOW' }]);
    });

    it('rejects a code that is both allowed and denied', async () => {
      const user = await provisionUser(server, director, { roleId: roleId(SystemRole.VIEWER) });

      const error = await fails(
        director.put(`/users/${user.id}/permissions`, {
          allow: ['finance.read'],
          deny: ['finance.read'],
        }),
        400,
        'VALIDATION_FAILED',
      );

      expect(error.details?.some((detail) => detail.value === 'finance.read')).toBe(true);
    });

    it('rejects an unknown code and self-editing', async () => {
      const user = await provisionUser(server, director, { roleId: roleId(SystemRole.VIEWER) });
      const me = await ok<{ id: string }>(director.get('/auth/me'));

      await fails(
        director.put(`/users/${user.id}/permissions`, { allow: ['nope.nope'] }),
        400,
        'VALIDATION_FAILED',
      );

      await fails(
        director.put(`/users/${me.id}/permissions`, { deny: ['finance.read'] }),
        403,
        'CANNOT_EDIT_OWN_PERMISSIONS',
      );
    });
  });

  describe('branch scoping', () => {
    it('pins a supervisor to their own branch', async () => {
      const other = await createBranch(director, 'فرع آخر');

      const supervisor = await provisionUser(server, director, {
        roleId: roleId(SystemRole.BRANCH_SUPERVISOR),
        branchId: branch.id,
      });
      const insider = await provisionUser(server, director, {
        roleId: roleId(SystemRole.REPRESENTATIVE),
        branchId: branch.id,
      });
      const outsider = await provisionUser(server, director, {
        roleId: roleId(SystemRole.REPRESENTATIVE),
        branchId: other.id,
      });

      const visible = await okPage<UserResponse>(supervisor.api.get('/users?limit=100'));
      const ids = visible.items.map((user) => user.id);

      expect(ids).toContain(insider.id);
      expect(ids).not.toContain(outsider.id);
      expect(visible.items.every((user) => user.branchId === branch.id)).toBe(true);

      // Asking for another branch is refused rather than silently narrowed.
      await fails(supervisor.api.get(`/users?branchId=${other.id}`), 403, 'BRANCH_SCOPE_VIOLATION');

      // A user outside the scope is reported as absent, not forbidden.
      await fails(supervisor.api.get(`/users/${outsider.id}`), 404, 'NOT_FOUND');
    });

    it('refuses a company-level caller who has neither a branch nor read-all', async () => {
      // A purpose-built role rather than VIEWER: this asserts what the guard does when there is
      // no branch to narrow to, so it must not also depend on which grants VIEWER happens to
      // carry. VIEWER holds the read-all variants precisely so it is *not* in this position.
      const scopelessRole = await ok<{ id: string }>(
        director.post('/roles', {
          code: uniqueCode('ROLE'),
          translations: { ar: { displayName: 'قارئ بلا نطاق' } },
          permissions: ['users.read'],
        }),
        201,
      );

      const caller = await provisionUser(server, director, { roleId: scopelessRole.id });

      await fails(caller.api.get('/users'), 403, 'INSUFFICIENT_PERMISSIONS');
    });

    it('lets a director with read-all see every branch', async () => {
      const all = await okPage<UserResponse>(director.get('/users?limit=100'));
      const branchIds = new Set(all.items.map((user) => user.branchId));

      expect(branchIds.size).toBeGreaterThan(1);
    });
  });

  describe('RBAC', () => {
    it('closes the write endpoints to callers without the permission', async () => {
      const viewer = await provisionUser(server, director, {
        roleId: roleId(SystemRole.VIEWER),
      });

      await fails(
        viewer.api.post('/users', {
          fullName: 'غير مسموح',
          phone: uniquePhone(),
          roleId: roleId(SystemRole.VIEWER),
          password: 'Temp#Pass1',
        }),
        403,
        'INSUFFICIENT_PERMISSIONS',
      );

      await fails(
        viewer.api.patch(`/users/${viewer.id}`, { fullName: 'x y z' }),
        403,
        'INSUFFICIENT_PERMISSIONS',
      );
    });
  });
});
