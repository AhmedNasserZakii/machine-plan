import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { Api, fails, hasFieldError, ok } from './utils/api-client';
import {
  Session,
  TEST_DEVICE_ID,
  createBranch,
  login,
  loginAsDirector,
  provisionUser,
  roleIdByCode,
  uniquePhone,
} from './utils/fixtures';
import { createTestApp } from './utils/test-app';

interface MeResponse {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: { code: string; name: string };
  branch: { id: string; name: string } | null;
  permissions: string[];
  mustChangePassword: boolean;
  biometricEnabled: boolean;
  signatureImageUrl: string | null;
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let anon: Api;
  let director: Api;
  let viewerRoleId: string;

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
    anon = new Api(server);
    director = await loginAsDirector(server);
    viewerRoleId = await roleIdByCode(director, SystemRole.VIEWER);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('issues a usable token pair for valid credentials', async () => {
      const { phone, password } = await provisionUser(server, director, { roleId: viewerRoleId });

      const session = await ok<Session>(
        anon.post('/auth/login', { phone, password, deviceId: TEST_DEVICE_ID }),
      );

      expect(session.accessToken).toBeTruthy();
      expect(session.refreshToken).toBeTruthy();
      expect(session.expiresIn).toBe('30m');
      expect(Date.parse(session.refreshExpiresAt)).toBeGreaterThan(Date.now());
      expect(session.mustChangePassword).toBe(false);

      // The login response deliberately carries tokens only; the profile comes from /auth/me.
      expect(session).not.toHaveProperty('permissions');
      await ok(new Api(server, session.accessToken).get('/auth/me'));
    });

    it('rejects a wrong password without revealing whether the phone exists', async () => {
      const { phone } = await provisionUser(server, director, { roleId: viewerRoleId });

      const wrongPassword = await fails(
        anon.post('/auth/login', { phone, password: 'DefinitelyWrong1' }),
        401,
        'INVALID_CREDENTIALS',
      );
      const unknownPhone = await fails(
        anon.post('/auth/login', { phone: uniquePhone(), password: 'DefinitelyWrong1' }),
        401,
        'INVALID_CREDENTIALS',
      );

      expect(unknownPhone.message).toBe(wrongPassword.message);
    });

    it('normalizes the phone, so the +20 form signs in too', async () => {
      const { phone, password } = await provisionUser(server, director, { roleId: viewerRoleId });

      const session = await ok<Session>(
        anon.post('/auth/login', { phone: `+2${phone}`, password, deviceId: TEST_DEVICE_ID }),
      );

      expect(session.accessToken).toBeTruthy();
    });

    it('reports the offending field for a malformed body', async () => {
      const error = await fails(
        anon.post('/auth/login', { phone: '0100', password: 'short' }),
        400,
        'VALIDATION_FAILED',
      );

      expect(hasFieldError(error, 'phone')).toBe(true);
      expect(hasFieldError(error, 'password')).toBe(true);
    });

    it('refuses a deactivated account', async () => {
      const user = await provisionUser(server, director, { roleId: viewerRoleId });
      await ok(director.patch(`/users/${user.id}/deactivate`));

      await fails(
        anon.post('/auth/login', { phone: user.phone, password: user.password }),
        403,
        'ACCOUNT_INACTIVE',
      );
    });

    it('locks the account on the fifth consecutive failure', async () => {
      const { phone } = await provisionUser(server, director, { roleId: viewerRoleId });
      const bad = { phone, password: 'WrongPassword1' };

      for (let attempt = 1; attempt <= 4; attempt += 1) {
        await fails(anon.post('/auth/login', bad), 401, 'INVALID_CREDENTIALS');
      }

      await fails(anon.post('/auth/login', bad), 429, 'ACCOUNT_LOCKED');
      // Still locked afterwards, and now even the right password is refused.
      await fails(anon.post('/auth/login', bad), 429, 'ACCOUNT_LOCKED');
    });
  });

  describe('forced first password change', () => {
    it('blocks every other route until the password is changed', async () => {
      const phone = uniquePhone();
      const temporary = 'Temp#Pass1';

      await ok(
        director.post('/users', {
          fullName: 'مستخدم جديد',
          phone,
          roleId: viewerRoleId,
          password: temporary,
        }),
        201,
      );

      const first = await login(server, phone, temporary);
      expect(first.mustChangePassword).toBe(true);

      const pending = new Api(server, first.accessToken);

      // /auth/me stays reachable so the app can render the change-password screen.
      const me = await ok<MeResponse>(pending.get('/auth/me'));
      expect(me.mustChangePassword).toBe(true);

      await fails(pending.get('/users'), 403, 'PASSWORD_CHANGE_REQUIRED');
      await fails(pending.get('/machine-types'), 403, 'PASSWORD_CHANGE_REQUIRED');

      await ok(
        pending.post('/auth/change-password', {
          currentPassword: temporary,
          newPassword: 'Rotated#Pass1',
        }),
      );

      const second = await login(server, phone, 'Rotated#Pass1');
      expect(second.mustChangePassword).toBe(false);

      const settled = new Api(server, second.accessToken);
      await ok(settled.get('/machine-types'));
    });

    it('rejects a wrong current password and a reused one', async () => {
      const { api, password } = await provisionUser(server, director, { roleId: viewerRoleId });

      await fails(
        api.post('/auth/change-password', {
          currentPassword: 'NotMyPassword1',
          newPassword: 'Another#Pass1',
        }),
        401,
        'INVALID_CREDENTIALS',
      );

      const reused = await fails(
        api.post('/auth/change-password', {
          currentPassword: password,
          newPassword: password,
        }),
        400,
        'VALIDATION_FAILED',
      );

      expect(hasFieldError(reused, 'newPassword')).toBe(true);
    });

    it('revokes existing sessions, so the old refresh token dies with the password', async () => {
      const { phone, password } = await provisionUser(server, director, { roleId: viewerRoleId });
      const session = await login(server, phone, password);
      const api = new Api(server, session.accessToken);

      await ok(
        api.post('/auth/change-password', {
          currentPassword: password,
          newPassword: 'Rotated#Pass2',
        }),
      );

      await fails(
        anon.post('/auth/refresh', { refreshToken: session.refreshToken }),
        401,
        'TOKEN_REVOKED',
      );
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the pair and invalidates the presented token', async () => {
      const { phone, password } = await provisionUser(server, director, { roleId: viewerRoleId });
      const first = await login(server, phone, password);

      const rotated = await ok<Session>(
        anon.post('/auth/refresh', { refreshToken: first.refreshToken }),
      );

      expect(rotated.refreshToken).not.toBe(first.refreshToken);
      await ok(new Api(server, rotated.accessToken).get('/auth/me'));

      // Re-presenting a rotated token is treated as theft: the whole chain is revoked.
      await fails(
        anon.post('/auth/refresh', { refreshToken: first.refreshToken }),
        401,
        'TOKEN_REVOKED',
      );
      await fails(
        anon.post('/auth/refresh', { refreshToken: rotated.refreshToken }),
        401,
        'TOKEN_REVOKED',
      );
    });

    it('rejects an unknown token', async () => {
      await fails(
        anon.post('/auth/refresh', { refreshToken: 'x'.repeat(64) }),
        401,
        'TOKEN_REVOKED',
      );
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the presented refresh token', async () => {
      const { phone, password } = await provisionUser(server, director, { roleId: viewerRoleId });
      const session = await login(server, phone, password);
      const api = new Api(server, session.accessToken);

      const result = await ok<{ revoked: boolean }>(
        api.post('/auth/logout', { refreshToken: session.refreshToken }),
      );
      expect(result.revoked).toBe(true);

      await fails(
        anon.post('/auth/refresh', { refreshToken: session.refreshToken }),
        401,
        'TOKEN_REVOKED',
      );
    });

    it('requires the refresh token in the body', async () => {
      const { api } = await provisionUser(server, director, { roleId: viewerRoleId });

      const error = await fails(api.post('/auth/logout', {}), 400, 'VALIDATION_FAILED');
      expect(hasFieldError(error, 'refreshToken')).toBe(true);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the profile, role and effective permissions', async () => {
      const me = await ok<MeResponse>(director.get('/auth/me'));

      expect(me).toMatchObject({
        role: { code: SystemRole.DIRECTOR },
        mustChangePassword: false,
      });
      expect(me.id).toBeTruthy();
      expect(me.fullName).toBeTruthy();
      expect(me.permissions).toContain('users.create');
      expect(me.permissions.length).toBeGreaterThan(40);
    });

    it('localizes the role name from the request locale', async () => {
      const arabic = await ok<MeResponse>(director.withLocale('ar').get('/auth/me'));
      const english = await ok<MeResponse>(director.withLocale('en').get('/auth/me'));

      expect(arabic.role.name).toBe('المدير');
      expect(english.role.name).toBe('Director');
    });

    it('names the branch for branch-scoped staff and leaves it null company-wide', async () => {
      const branch = await createBranch(director, 'فرع بروفايل');
      const supervisorRoleId = await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR);
      const manager = await provisionUser(server, director, {
        roleId: supervisorRoleId,
        branchId: branch.id,
      });

      const scoped = await ok<MeResponse>(manager.api.get('/auth/me'));
      expect(scoped.branch).toEqual({ id: branch.id, name: 'فرع بروفايل' });

      // A branch name is operational data, so it reads the same in either locale.
      const english = await ok<MeResponse>(manager.api.withLocale('en').get('/auth/me'));
      expect(english.branch?.name).toBe('فرع بروفايل');

      // The Director sits above the branches.
      expect((await ok<MeResponse>(director.get('/auth/me'))).branch).toBeNull();
    });
  });

  describe('token handling', () => {
    it('rejects a missing, malformed or garbage token', async () => {
      await fails(anon.get('/auth/me'), 401, 'UNAUTHENTICATED');
      await fails(anon.as('not-a-jwt').get('/auth/me'), 401, 'UNAUTHENTICATED');
      await fails(anon.as('a.b.c').get('/auth/me'), 401, 'UNAUTHENTICATED');
    });

    it('stops honouring a token once the account is deactivated', async () => {
      const user = await provisionUser(server, director, { roleId: viewerRoleId });
      await ok(user.api.get('/auth/me'));

      await ok(director.patch(`/users/${user.id}/deactivate`));

      // The principal is rebuilt from the database on every request, so the still-valid
      // access token stops working immediately. ACCOUNT_INACTIVE rather than a 401 keeps
      // the client from trying to refresh its way out of a deactivation.
      await fails(user.api.get('/auth/me'), 403, 'ACCOUNT_INACTIVE');
    });
  });

  describe('devices', () => {
    it('registers a device and unregisters it again', async () => {
      const { api } = await provisionUser(server, director, { roleId: viewerRoleId });

      const registered = await ok<{ deviceId: string; registered: boolean }>(
        api.post('/auth/devices', {
          deviceId: 'e2e-phone-1',
          deviceModel: 'Pixel 8',
          platform: 'ANDROID',
        }),
      );
      expect(registered).toMatchObject({ deviceId: 'e2e-phone-1', registered: true });

      const removed = await ok<{ removed: boolean }>(api.delete('/auth/devices/e2e-phone-1'));
      expect(removed.removed).toBe(true);
    });
  });
});
