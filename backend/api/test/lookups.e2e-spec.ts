import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { Api, fails, hasFieldError, ok } from './utils/api-client';
import { loginAsDirector, provisionUser, roleIdByCode, uniqueCode } from './utils/fixtures';
import { createTestApp } from './utils/test-app';

interface LookupResponse {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  translations?: Record<string, { name: string; description: string | null }>;
}

interface MachineTypeResponse extends LookupResponse {
  requiresSim: boolean;
}

interface MachineModelResponse extends LookupResponse {
  manufacturer: string | null;
  machineType: { id: string; code: string; name: string; requiresSim: boolean };
}

interface ViolationTypeResponse extends LookupResponse {
  defaultSeverity: 'LOW' | 'MEDIUM' | 'HIGH';
}

describe('Lookups and localization (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;
  let viewer: Api;
  let accountant: Api;

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);
    viewer = (
      await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.VIEWER),
      })
    ).api;
    accountant = (
      await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.ACCOUNTANT),
      })
    ).api;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('machine types', () => {
    it('serves the seeded catalogue with the SIM requirement per type', async () => {
      const types = await ok<MachineTypeResponse[]>(director.get('/machine-types'));
      const byCode = new Map(types.map((type) => [type.code, type]));

      expect(byCode.get('POS_TERMINAL')?.requiresSim).toBe(true);
      expect(byCode.get('MOBILE_POS')?.requiresSim).toBe(true);
      expect(byCode.get('SMART_POS')?.requiresSim).toBe(true);
      // A pin pad has no SIM of its own, so the machine form must not demand one.
      expect(byCode.get('PIN_PAD')?.requiresSim).toBe(false);
    });

    it('returns rows in sortOrder', async () => {
      const types = await ok<MachineTypeResponse[]>(director.get('/machine-types'));
      const orders = types.map((type) => type.sortOrder);

      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    });

    it('creates a type with requiresSim and reads it back', async () => {
      const code = uniqueCode('MT');

      const created = await ok<MachineTypeResponse>(
        director.post('/machine-types', {
          code,
          translations: {
            ar: { name: 'نوع بدون شريحة' },
            en: { name: 'SIM-less type' },
          },
          requiresSim: false,
          sortOrder: 99,
        }),
        201,
      );

      expect(created).toMatchObject({ code, requiresSim: false, isActive: true, sortOrder: 99 });

      const english = await ok<MachineTypeResponse[]>(
        director.withLocale('en').get('/machine-types'),
      );
      expect(english.find((type) => type.code === code)?.name).toBe('SIM-less type');
    });

    it('defaults requiresSim to true when omitted', async () => {
      const created = await ok<MachineTypeResponse>(
        director.post('/machine-types', {
          code: uniqueCode('MT'),
          translations: { ar: { name: 'نوع افتراضي' } },
        }),
        201,
      );

      expect(created.requiresSim).toBe(true);
    });

    it('toggles requiresSim on update', async () => {
      const created = await ok<MachineTypeResponse>(
        director.post('/machine-types', {
          code: uniqueCode('MT'),
          translations: { ar: { name: 'نوع للتعديل' } },
          requiresSim: true,
        }),
        201,
      );

      const updated = await ok<MachineTypeResponse>(
        director.patch(`/machine-types/${created.id}`, { requiresSim: false }),
      );

      expect(updated.requiresSim).toBe(false);
    });

    it('rejects a duplicate code', async () => {
      const code = uniqueCode('MT');
      const body = { code, translations: { ar: { name: 'مكرر' } } };

      await ok(director.post('/machine-types', body), 201);
      await fails(director.post('/machine-types', body), 409, 'CODE_EXISTS');
    });

    it('requires the default locale and rejects unsupported ones', async () => {
      const missingArabic = await fails(
        director.post('/machine-types', {
          code: uniqueCode('MT'),
          translations: { en: { name: 'English only' } },
        }),
        400,
        'VALIDATION_FAILED',
      );
      expect(hasFieldError(missingArabic, 'translations.ar')).toBe(true);

      const unsupported = await fails(
        director.post('/machine-types', {
          code: uniqueCode('MT'),
          translations: { ar: { name: 'عربي' }, de: { name: 'Deutsch' } },
        }),
        400,
        'VALIDATION_FAILED',
      );
      expect(hasFieldError(unsupported, 'translations.de')).toBe(true);
    });

    it('hides deactivated rows unless asked for', async () => {
      const created = await ok<MachineTypeResponse>(
        director.post('/machine-types', {
          code: uniqueCode('MT'),
          translations: { ar: { name: 'نوع موقوف' } },
          isActive: false,
        }),
        201,
      );

      const active = await ok<MachineTypeResponse[]>(director.get('/machine-types'));
      expect(active.map((type) => type.id)).not.toContain(created.id);

      const all = await ok<MachineTypeResponse[]>(
        director.get('/machine-types?includeInactive=true'),
      );
      expect(all.map((type) => type.id)).toContain(created.id);
    });

    it('is readable by any authenticated user but writable only with settings.manage', async () => {
      await ok(viewer.get('/machine-types'));

      await fails(
        viewer.post('/machine-types', {
          code: uniqueCode('MT'),
          translations: { ar: { name: 'غير مسموح' } },
        }),
        403,
        'INSUFFICIENT_PERMISSIONS',
      );
    });
  });

  describe('machine models', () => {
    it('carries the parent type and its SIM requirement', async () => {
      const models = await ok<MachineModelResponse[]>(director.get('/machine-models'));
      const smart = models.find((model) => model.code === 'PAX_A920');

      expect(smart?.machineType.code).toBe('SMART_POS');
      expect(smart?.machineType.requiresSim).toBe(true);
      expect(smart?.manufacturer).toBeTruthy();
    });

    it('filters by machineTypeId', async () => {
      const types = await ok<MachineTypeResponse[]>(director.get('/machine-types'));
      const pinPad = types.find((type) => type.code === 'PIN_PAD') as MachineTypeResponse;

      const filtered = await ok<MachineModelResponse[]>(
        director.get(`/machine-models?machineTypeId=${pinPad.id}`),
      );

      expect(filtered.every((model) => model.machineType.id === pinPad.id)).toBe(true);
    });

    it('creates a model under a type', async () => {
      const types = await ok<MachineTypeResponse[]>(director.get('/machine-types'));
      const target = types.find((type) => type.code === 'SMART_POS') as MachineTypeResponse;
      const code = uniqueCode('MM');

      const created = await ok<MachineModelResponse>(
        director.post('/machine-models', {
          code,
          machineTypeId: target.id,
          manufacturer: 'Ingenico',
          translations: { ar: { name: 'موديل جديد' }, en: { name: 'New model' } },
        }),
        201,
      );

      expect(created).toMatchObject({
        code,
        manufacturer: 'Ingenico',
        machineType: { id: target.id, requiresSim: true },
      });
    });

    it('requires a valid machineTypeId', async () => {
      const error = await fails(
        director.post('/machine-models', {
          code: uniqueCode('MM'),
          translations: { ar: { name: 'بلا نوع' } },
        }),
        400,
        'VALIDATION_FAILED',
      );

      expect(hasFieldError(error, 'machineTypeId')).toBe(true);
    });
  });

  describe('payment methods', () => {
    it('needs finance.read', async () => {
      const methods = await ok<LookupResponse[]>(accountant.get('/payment-methods'));
      expect(methods.map((method) => method.code)).toContain('CASH');

      await fails(viewer.get('/payment-methods'), 403, 'INSUFFICIENT_PERMISSIONS');
    });

    it('creates one with settings.manage only', async () => {
      const code = uniqueCode('PM');

      await ok(
        director.post('/payment-methods', {
          code,
          translations: { ar: { name: 'طريقة جديدة' }, en: { name: 'New method' } },
        }),
        201,
      );

      await fails(
        accountant.post('/payment-methods', {
          code: uniqueCode('PM'),
          translations: { ar: { name: 'غير مسموح' } },
        }),
        403,
        'INSUFFICIENT_PERMISSIONS',
      );
    });
  });

  describe('violation types', () => {
    it('exposes the default severity', async () => {
      const types = await ok<ViolationTypeResponse[]>(director.get('/violation-types'));
      const byCode = new Map(types.map((type) => [type.code, type]));

      expect(byCode.get('BATTERY_MISMATCH')?.defaultSeverity).toBe('HIGH');
      expect(byCode.get('MISSING_CHARGER')?.defaultSeverity).toBe('LOW');
      expect(byCode.get('LATE_RETURN')?.defaultSeverity).toBe('MEDIUM');
    });

    it('validates the severity enum on create', async () => {
      await fails(
        director.post('/violation-types', {
          code: uniqueCode('VT'),
          translations: { ar: { name: 'شدة غلط' } },
          defaultSeverity: 'CRITICAL',
        }),
        400,
        'VALIDATION_FAILED',
      );
    });
  });

  describe('maintenance locations and decommission reasons', () => {
    it('serves both catalogues', async () => {
      const locations = await ok<LookupResponse[]>(director.get('/maintenance-locations'));
      expect(locations.map((row) => row.code)).toContain('INTERNAL_WORKSHOP');

      const reasons = await ok<LookupResponse[]>(director.get('/decommission-reasons'));
      expect(reasons.map((row) => row.code)).toContain('BEYOND_REPAIR');
    });

    it('creates a decommission reason in both locales', async () => {
      const code = uniqueCode('DR');

      const created = await ok<LookupResponse>(
        director.post('/decommission-reasons', {
          code,
          translations: { ar: { name: 'سبب جديد' }, en: { name: 'New reason' } },
        }),
        201,
      );

      expect(created).toMatchObject({ code, name: 'سبب جديد' });

      const english = await ok<LookupResponse[]>(
        director.withLocale('en').get('/decommission-reasons'),
      );
      expect(english.find((row) => row.id === created.id)?.name).toBe('New reason');
    });

    it('rejects a description on a name-only lookup instead of dropping it', async () => {
      // decommission_reason_translations has no description column, so accepting the field
      // would silently discard whatever the client sent.
      await fails(
        director.post('/decommission-reasons', {
          code: uniqueCode('DR'),
          translations: { ar: { name: 'سبب', description: 'شرح' } },
        }),
        400,
        'VALIDATION_FAILED',
      );

      // Violation types do have one, and keep it.
      const violation = await ok<LookupResponse>(
        director.post('/violation-types', {
          code: uniqueCode('VT'),
          translations: { ar: { name: 'مخالفة', description: 'شرح المخالفة' } },
          defaultSeverity: 'LOW',
        }),
        201,
      );
      expect(violation.description).toBe('شرح المخالفة');
    });
  });

  describe('locale resolution', () => {
    it('defaults to Arabic', async () => {
      const types = await ok<MachineTypeResponse[]>(director.get('/machine-types'));
      const posTerminal = types.find((type) => type.code === 'POS_TERMINAL');

      expect(posTerminal?.name).toBe('ماكينة نقاط بيع');
    });

    it('honours Accept-Language', async () => {
      const types = await ok<MachineTypeResponse[]>(
        director.withLocale('en-US,en;q=0.9').get('/machine-types'),
      );

      expect(types.find((type) => type.code === 'POS_TERMINAL')?.name).toBe('POS Terminal');
    });

    it('lets ?locale override the header', async () => {
      const types = await ok<MachineTypeResponse[]>(
        director.withLocale('ar').get('/machine-types?locale=en'),
      );

      expect(types.find((type) => type.code === 'POS_TERMINAL')?.name).toBe('POS Terminal');
    });

    it('falls back to Arabic for an unsupported language', async () => {
      const types = await ok<MachineTypeResponse[]>(
        director.withLocale('fr-FR').get('/machine-types'),
      );

      expect(types.find((type) => type.code === 'POS_TERMINAL')?.name).toBe('ماكينة نقاط بيع');
    });
  });

  describe('rawTranslations', () => {
    it('returns every locale for an admin', async () => {
      const types = await ok<MachineTypeResponse[]>(
        director.get('/machine-types?rawTranslations=true'),
      );
      const posTerminal = types.find((type) => type.code === 'POS_TERMINAL');

      expect(posTerminal?.translations?.ar.name).toBe('ماكينة نقاط بيع');
      expect(posTerminal?.translations?.en.name).toBe('POS Terminal');
    });

    it('is refused without settings.manage', async () => {
      await fails(
        viewer.get('/machine-types?rawTranslations=true'),
        403,
        'INSUFFICIENT_PERMISSIONS',
      );

      // The same caller can still read the localized list.
      await ok(viewer.get('/machine-types'));
    });
  });
});
