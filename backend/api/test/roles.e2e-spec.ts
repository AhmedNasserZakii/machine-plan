import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { Api, fails, hasFieldError, ok } from './utils/api-client';
import { loginAsDirector, provisionUser, roleIdByCode, uniqueCode } from './utils/fixtures';
import { createTestApp } from './utils/test-app';

interface RoleResponse {
  id: string;
  code: string;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  permissionCount: number;
  translations?: Record<string, { displayName: string; description: string | null }>;
}

interface PermissionGroupResponse {
  group: string;
  label: string;
  permissions: { id: string; code: string; group: string; displayName: string }[];
}

const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

describe('Roles and permissions (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;
  let viewer: Api;

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);
    viewer = (
      await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.VIEWER),
      })
    ).api;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /roles', () => {
    it('lists the seeded system roles with their grants', async () => {
      const roles = await ok<RoleResponse[]>(director.get('/roles'));
      const byCode = new Map(roles.map((role) => [role.code, role]));

      expect([...byCode.keys()]).toEqual(
        expect.arrayContaining([
          SystemRole.DIRECTOR,
          SystemRole.BRANCH_SUPERVISOR,
          SystemRole.REPRESENTATIVE,
          SystemRole.ACCOUNTANT,
          SystemRole.VIEWER,
        ]),
      );

      const directorRole = byCode.get(SystemRole.DIRECTOR) as RoleResponse;
      expect(directorRole.isSystem).toBe(true);
      expect(directorRole.permissionCount).toBe(directorRole.permissions.length);
      expect(directorRole.permissions).toContain('settings.manage');

      const viewerRole = byCode.get(SystemRole.VIEWER) as RoleResponse;
      expect(viewerRole.permissions).toContain('machines.read');
      expect(viewerRole.permissions).not.toContain('machines.create');
    });

    it('localizes the display name', async () => {
      const arabic = await ok<RoleResponse[]>(director.withLocale('ar').get('/roles'));
      const english = await ok<RoleResponse[]>(director.withLocale('en').get('/roles'));

      const pick = (roles: RoleResponse[]): string | undefined =>
        roles.find((role) => role.code === SystemRole.BRANCH_SUPERVISOR)?.displayName;

      expect(pick(arabic)).toBe('مشرف فرع');
      expect(pick(english)).toBe('Branch supervisor');
    });

    it('omits raw translations unless they are asked for', async () => {
      const [plain] = await ok<RoleResponse[]>(director.get('/roles'));
      expect(plain.translations).toBeUndefined();

      const [raw] = await ok<RoleResponse[]>(director.get('/roles?raw_translations=true'));
      expect(raw.translations?.ar.displayName).toBeTruthy();
      expect(raw.translations?.en.displayName).toBeTruthy();
    });
  });

  describe('GET /roles/:id', () => {
    it('returns one role', async () => {
      const id = await roleIdByCode(director, SystemRole.ACCOUNTANT);
      const role = await ok<RoleResponse>(director.get(`/roles/${id}`));

      expect(role.code).toBe(SystemRole.ACCOUNTANT);
      expect(role.permissions).toContain('finance.read');
    });

    it('404s for an unknown id and 400s for a malformed one', async () => {
      await fails(director.get(`/roles/${UNKNOWN_UUID}`), 404, 'NOT_FOUND');
      await fails(director.get('/roles/not-a-uuid'), 400, 'VALIDATION_FAILED');
    });
  });

  describe('GET /permissions', () => {
    it('returns the catalogue grouped and localized', async () => {
      const groups = await ok<PermissionGroupResponse[]>(
        director.withLocale('en').get('/permissions'),
      );

      expect(groups.length).toBeGreaterThan(1);
      const codes = groups.flatMap((group) => group.permissions.map((p) => p.code));
      expect(codes).toContain('machines.read');
      expect(codes).toContain('finance.read');
      expect(new Set(codes).size).toBe(codes.length);

      for (const group of groups) {
        expect(group.label).toBeTruthy();
        expect(group.permissions.every((permission) => permission.group === group.group)).toBe(
          true,
        );
      }
    });

    it('is closed to callers without roles.manage', async () => {
      await fails(viewer.get('/permissions'), 403, 'INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('POST /roles', () => {
    it('creates a custom role with both locales', async () => {
      const code = uniqueCode('ROLE');

      const created = await ok<RoleResponse>(
        director.post('/roles', {
          code,
          translations: {
            ar: { displayName: 'دور مخصص', description: 'للاختبار' },
            en: { displayName: 'Custom role', description: 'For testing' },
          },
          permissions: ['machines.read', 'transfers.read'],
        }),
        201,
      );

      expect(created).toMatchObject({ code, isSystem: false, permissionCount: 2 });
      expect(created.permissions.sort()).toEqual(['machines.read', 'transfers.read']);

      const english = await ok<RoleResponse>(director.withLocale('en').get(`/roles/${created.id}`));
      expect(english.displayName).toBe('Custom role');
    });

    it('requires the default locale', async () => {
      const error = await fails(
        director.post('/roles', {
          code: uniqueCode('ROLE'),
          translations: { en: { displayName: 'English only' } },
        }),
        400,
        'VALIDATION_FAILED',
      );

      expect(hasFieldError(error, 'translations.ar')).toBe(true);
    });

    it('rejects an unsupported locale key', async () => {
      const error = await fails(
        director.post('/roles', {
          code: uniqueCode('ROLE'),
          translations: {
            ar: { displayName: 'عربي' },
            fr: { displayName: 'Français' },
          },
        }),
        400,
        'VALIDATION_FAILED',
      );

      expect(hasFieldError(error, 'translations.fr')).toBe(true);
    });

    it('rejects a malformed code and a duplicate one', async () => {
      const malformed = await fails(
        director.post('/roles', {
          code: 'lower_case',
          translations: { ar: { displayName: 'عربي' } },
        }),
        400,
        'VALIDATION_FAILED',
      );
      expect(hasFieldError(malformed, 'code')).toBe(true);

      const code = uniqueCode('ROLE');
      const body = { code, translations: { ar: { displayName: 'مكرر' } } };

      await ok(director.post('/roles', body), 201);
      await fails(director.post('/roles', body), 409, 'CODE_EXISTS');
    });

    it('rejects an unknown permission code loudly', async () => {
      const error = await fails(
        director.post('/roles', {
          code: uniqueCode('ROLE'),
          translations: { ar: { displayName: 'عربي' } },
          permissions: ['machines.read', 'does.not.exist'],
        }),
        400,
        'VALIDATION_FAILED',
      );

      expect(hasFieldError(error, 'permissions')).toBe(true);
      expect(error.details?.some((detail) => detail.value === 'does.not.exist')).toBe(true);
    });

    it('is closed to callers without roles.manage', async () => {
      await fails(
        viewer.post('/roles', {
          code: uniqueCode('ROLE'),
          translations: { ar: { displayName: 'عربي' } },
        }),
        403,
        'INSUFFICIENT_PERMISSIONS',
      );
    });
  });

  describe('PATCH /roles/:id', () => {
    it('updates translations in place', async () => {
      const created = await ok<RoleResponse>(
        director.post('/roles', {
          code: uniqueCode('ROLE'),
          translations: { ar: { displayName: 'قبل' } },
        }),
        201,
      );

      await ok(
        director.patch(`/roles/${created.id}`, {
          translations: {
            ar: { displayName: 'بعد' },
            en: { displayName: 'After' },
          },
        }),
      );

      const arabic = await ok<RoleResponse>(director.withLocale('ar').get(`/roles/${created.id}`));
      const english = await ok<RoleResponse>(director.withLocale('en').get(`/roles/${created.id}`));

      expect(arabic.displayName).toBe('بعد');
      expect(english.displayName).toBe('After');
    });
  });

  describe('PUT /roles/:id/permissions', () => {
    it('replaces the grant set and takes effect for its holders immediately', async () => {
      const role = await ok<RoleResponse>(
        director.post('/roles', {
          code: uniqueCode('ROLE'),
          translations: { ar: { displayName: 'محاسب مخصص' } },
          permissions: ['finance.read'],
        }),
        201,
      );

      const holder = await provisionUser(server, director, { roleId: role.id });

      // finance.read is what /payment-methods requires.
      await ok(holder.api.get('/payment-methods'));

      const updated = await ok<RoleResponse>(
        director.put(`/roles/${role.id}/permissions`, { permissions: ['machines.read'] }),
      );
      expect(updated.permissions).toEqual(['machines.read']);

      // The permission cache is flushed on write, so the next request already reflects it.
      await fails(holder.api.get('/payment-methods'), 403, 'INSUFFICIENT_PERMISSIONS');
    });

    it('rejects unknown codes', async () => {
      const id = await roleIdByCode(director, SystemRole.VIEWER);

      const error = await fails(
        director.put(`/roles/${id}/permissions`, { permissions: ['nope.nope'] }),
        400,
        'VALIDATION_FAILED',
      );
      expect(hasFieldError(error, 'permissions')).toBe(true);
    });
  });
});
