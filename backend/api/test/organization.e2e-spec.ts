import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { Severity, WarehouseType } from 'src/common/enums/operations.enum';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { Api, fails, hasFieldError, ok } from './utils/api-client';
import {
  createBranch,
  loginAsDirector,
  provisionUser,
  roleIdByCode,
  uniqueCode,
  uniquePhone,
} from './utils/fixtures';
import { createTestApp } from './utils/test-app';

interface BranchResponse {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  warehouse: { id: string; type: string; name: string; branchId: string | null } | null;
}

interface BranchSummaryResponse {
  branch: { id: string; code: string; name: string };
  machines: { total: number; byStatus: Record<string, number> };
  staff: { supervisors: number; representatives: number };
  openViolations: number;
  finance?: { monthExpenses: number; monthIncome: number };
}

interface WarehouseResponse {
  id: string;
  type: string;
  name: string;
  branchId: string | null;
  isActive: boolean;
}

const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

describe('Branches and warehouses (e2e)', () => {
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

  describe('POST /branches', () => {
    it('creates the branch and its warehouse in one call', async () => {
      const code = uniqueCode('BR');

      const branch = await ok<BranchResponse>(
        director.post('/branches', {
          code,
          name: 'فرع المنصورة',
          address: 'شارع الجيش',
          phone: '0502234567',
        }),
        201,
      );

      expect(branch).toMatchObject({ code, name: 'فرع المنصورة', isActive: true });
      expect(branch.warehouse).toMatchObject({
        type: WarehouseType.BRANCH,
        branchId: branch.id,
      });

      // The warehouse is discoverable through the warehouses endpoint too.
      const warehouses = await ok<WarehouseResponse[]>(
        director.get(`/warehouses?branchId=${branch.id}`),
      );
      expect(warehouses).toHaveLength(1);
      expect(warehouses[0].type).toBe(WarehouseType.BRANCH);
    });

    it('accepts a custom warehouse name', async () => {
      const branch = await ok<BranchResponse>(
        director.post('/branches', {
          code: uniqueCode('BR'),
          name: 'فرع طنطا',
          warehouseName: 'مخزن طنطا الرئيسي',
        }),
        201,
      );

      expect(branch.warehouse?.name).toBe('مخزن طنطا الرئيسي');
    });

    it('rejects a duplicate code', async () => {
      const code = uniqueCode('BR');
      await ok(director.post('/branches', { code, name: 'الأول' }), 201);

      await fails(director.post('/branches', { code, name: 'الثاني' }), 409, 'BRANCH_CODE_EXISTS');
    });

    it('validates the code shape and the name length', async () => {
      const error = await fails(
        director.post('/branches', { code: 'lower', name: 'x' }),
        400,
        'VALIDATION_FAILED',
      );

      expect(hasFieldError(error, 'code')).toBe(true);
      expect(hasFieldError(error, 'name')).toBe(true);
    });

    it('is closed to callers without branches.manage', async () => {
      await fails(
        viewer.post('/branches', { code: uniqueCode('BR'), name: 'غير مسموح' }),
        403,
        'INSUFFICIENT_PERMISSIONS',
      );
    });
  });

  describe('GET /branches', () => {
    it('lists active branches and can include the inactive ones', async () => {
      const branch = await createBranch(director, 'فرع للإخفاء');
      await ok(director.patch(`/branches/${branch.id}/deactivate`));

      const active = await ok<BranchResponse[]>(director.get('/branches'));
      expect(active.map((row) => row.id)).not.toContain(branch.id);
      expect(active.every((row) => row.isActive)).toBe(true);

      const all = await ok<BranchResponse[]>(director.get('/branches?includeInactive=true'));
      expect(all.map((row) => row.id)).toContain(branch.id);
    });

    it('searches by code and name', async () => {
      const branch = await createBranch(director, 'فرع البحث الفريد');

      const byCode = await ok<BranchResponse[]>(director.get(`/branches?search=${branch.code}`));
      expect(byCode).toHaveLength(1);
      expect(byCode[0].id).toBe(branch.id);

      const byName = await ok<BranchResponse[]>(director.get('/branches?search=البحث الفريد'));
      expect(byName.map((row) => row.id)).toContain(branch.id);
    });

    it('is readable by any authenticated user', async () => {
      await ok(viewer.get('/branches'));
    });

    it('rejects an unknown query parameter', async () => {
      await fails(director.get('/branches?nope=1'), 400, 'VALIDATION_FAILED');
    });
  });

  describe('GET /branches/:id', () => {
    it('returns one branch and 404s an unknown id', async () => {
      const branch = await createBranch(director);

      const found = await ok<BranchResponse>(director.get(`/branches/${branch.id}`));
      expect(found.id).toBe(branch.id);

      await fails(director.get(`/branches/${UNKNOWN_UUID}`), 404, 'NOT_FOUND');
      await fails(director.get('/branches/nope'), 400, 'VALIDATION_FAILED');
    });
  });

  describe('GET /branches/:id/summary', () => {
    it('counts staff by role and includes finance for a permitted caller', async () => {
      const branch = await createBranch(director, 'فرع الملخص');

      await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
        branchId: branch.id,
      });
      await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
        branchId: branch.id,
      });

      const summary = await ok<BranchSummaryResponse>(
        director.get(`/branches/${branch.id}/summary`),
      );

      expect(summary.branch).toMatchObject({ id: branch.id, code: branch.code });
      expect(summary.staff).toEqual({ supervisors: 1, representatives: 1 });
      // A brand-new branch genuinely holds nothing; finance stays stubbed until Phase 7.
      expect(summary.machines.total).toBe(0);
      expect(summary.openViolations).toBe(0);
      expect(summary.finance).toEqual({ monthExpenses: 0, monthIncome: 0 });
    });

    it('counts unresolved violations, and stops counting them once they are settled', async () => {
      const branch = await createBranch(director, 'فرع المخالفات');

      const offender = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
        branchId: branch.id,
      });

      const types = await ok<{ id: string }[]>(director.get('/violation-types'));
      const violationTypeId = types[0].id;

      const raise = async (): Promise<string> => {
        const created = await ok<{ id: string }>(
          director.post('/violations', {
            userId: offender.id,
            violationTypeId,
            severity: Severity.MEDIUM,
            description: 'تأخير في تسليم الماكينة',
          }),
          201,
        );

        return created.id;
      };

      await raise();
      const acknowledgedId = await raise();
      const waivedId = await raise();

      // Only the subject may acknowledge — a colleague saying "he has seen it" would be
      // worthless as a record — so this goes through the offender's own session.
      await ok(offender.api.post(`/violations/${acknowledgedId}/acknowledge`));
      await ok(director.post(`/violations/${waivedId}/waive`, { reason: 'خطأ في التسجيل' }));

      const summary = await ok<BranchSummaryResponse>(
        director.get(`/branches/${branch.id}/summary`),
      );

      // Acknowledging records that the offender has seen it, not that anyone has settled it, so
      // it still counts. Waiving settles it, so it drops out. Otherwise a branch could bury its
      // backlog by acknowledging everything.
      expect(summary.openViolations).toBe(2);
    });

    it('omits the finance block entirely for a caller without finance.read', async () => {
      const branch = await createBranch(director, 'فرع بلا مالية');

      // VIEWER has machines.read but not finance.read.
      const summary = await ok<BranchSummaryResponse>(viewer.get(`/branches/${branch.id}/summary`));

      expect(summary.branch.id).toBe(branch.id);
      expect(summary).not.toHaveProperty('finance');
    });
  });

  describe('PATCH /branches/:id', () => {
    it('updates the editable fields but not the code', async () => {
      const branch = await createBranch(director);

      const updated = await ok<BranchResponse>(
        director.patch(`/branches/${branch.id}`, {
          name: 'الاسم الجديد',
          address: 'العنوان الجديد',
        }),
      );

      expect(updated).toMatchObject({
        code: branch.code,
        name: 'الاسم الجديد',
        address: 'العنوان الجديد',
      });

      await fails(
        director.patch(`/branches/${branch.id}`, { code: uniqueCode('BR') }),
        400,
        'VALIDATION_FAILED',
      );
    });
  });

  describe('deactivate / activate', () => {
    it('refuses to deactivate a branch that still has active staff', async () => {
      const branch = await createBranch(director, 'فرع بموظفين');
      await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
        branchId: branch.id,
      });

      await fails(
        director.patch(`/branches/${branch.id}/deactivate`),
        409,
        'BRANCH_HAS_ACTIVE_STAFF',
      );
    });

    it('deactivates an empty branch and brings it back', async () => {
      const branch = await createBranch(director, 'فرع فارغ');

      const off = await ok<BranchResponse>(director.patch(`/branches/${branch.id}/deactivate`));
      expect(off.isActive).toBe(false);

      const on = await ok<BranchResponse>(director.patch(`/branches/${branch.id}/activate`));
      expect(on.isActive).toBe(true);
    });

    it('will not park a new user on a deactivated branch', async () => {
      const branch = await createBranch(director, 'فرع مغلق');
      await ok(director.patch(`/branches/${branch.id}/deactivate`));

      const error = await fails(
        director.post('/users', {
          fullName: 'مندوب فرع مغلق',
          phone: uniquePhone(),
          roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
          branchId: branch.id,
          password: 'Temp#Pass1',
        }),
        400,
        'VALIDATION_FAILED',
      );

      expect(hasFieldError(error, 'branchId')).toBe(true);
    });
  });

  describe('warehouses', () => {
    it('exposes the two seeded company warehouses', async () => {
      const warehouses = await ok<WarehouseResponse[]>(director.get('/warehouses'));
      const byType = new Map(warehouses.map((row) => [row.type, row]));

      expect(byType.get(WarehouseType.COMPANY_MAIN)?.branchId).toBeNull();
      expect(byType.get(WarehouseType.SCRAP)?.branchId).toBeNull();
    });

    it('filters by type', async () => {
      const scrap = await ok<WarehouseResponse[]>(
        director.get(`/warehouses?type=${WarehouseType.SCRAP}`),
      );

      expect(scrap).toHaveLength(1);
      expect(scrap[0].type).toBe(WarehouseType.SCRAP);
    });

    it('rejects a second company-level warehouse of the same type', async () => {
      await fails(
        director.post('/warehouses', {
          type: WarehouseType.COMPANY_MAIN,
          name: 'مخزن رئيسي ثانٍ',
        }),
        409,
        'WAREHOUSE_TYPE_CONFLICT',
      );

      await fails(
        director.post('/warehouses', { type: WarehouseType.SCRAP, name: 'توالف ثانية' }),
        409,
        'WAREHOUSE_TYPE_CONFLICT',
      );
    });

    it('rejects a second warehouse for a branch that already has one', async () => {
      const branch = await createBranch(director, 'فرع بمخزن');

      await fails(
        director.post('/warehouses', {
          type: WarehouseType.BRANCH,
          name: 'مخزن إضافي',
          branchId: branch.id,
        }),
        409,
        'WAREHOUSE_TYPE_CONFLICT',
      );
    });

    it('enforces the branch pairing rules per type', async () => {
      const branch = await createBranch(director, 'فرع الاقتران');

      const missingBranch = await fails(
        director.post('/warehouses', { type: WarehouseType.BRANCH, name: 'بلا فرع' }),
        400,
        'VALIDATION_FAILED',
      );
      expect(hasFieldError(missingBranch, 'branchId')).toBe(true);

      const branchOnCompanyType = await fails(
        director.post('/warehouses', {
          type: WarehouseType.SCRAP,
          name: 'توالف بفرع',
          branchId: branch.id,
        }),
        400,
        'VALIDATION_FAILED',
      );
      expect(hasFieldError(branchOnCompanyType, 'branchId')).toBe(true);
    });

    it('allows several maintenance warehouses', async () => {
      const first = await ok<WarehouseResponse>(
        director.post('/warehouses', {
          type: WarehouseType.MAINTENANCE,
          name: `ورشة ${uniqueCode('W')}`,
        }),
        201,
      );
      const second = await ok<WarehouseResponse>(
        director.post('/warehouses', {
          type: WarehouseType.MAINTENANCE,
          name: `ورشة ${uniqueCode('W')}`,
        }),
        201,
      );

      expect(first.id).not.toBe(second.id);
    });

    it('is closed to callers without branches.manage', async () => {
      await fails(
        viewer.post('/warehouses', { type: WarehouseType.MAINTENANCE, name: 'ورشة' }),
        403,
        'INSUFFICIENT_PERMISSIONS',
      );
    });
  });
});
