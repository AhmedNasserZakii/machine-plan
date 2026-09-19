import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FinanceKind } from 'src/common/enums/finance.enum';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { PartyType, TransferType } from 'src/common/enums/transfer.enum';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { Api, fails, ok } from './utils/api-client';
import { assertCursorPaging, assertOffsetPaging } from './utils/pagination-assert';
import {
  createBranch,
  createMerchant,
  loginAsDirector,
  provisionUser,
  roleIdByCode,
  uniqueCode,
} from './utils/fixtures';
import { createTestApp } from './utils/test-app';

/**
 * Full pagination cycle: seed well above one page for every list the Flutter
 * client pages (or fetchAll-walks), then walk pages and reject oversized limits.
 *
 * Counts stay modest so the suite stays fast, but every former bare-array path
 * is forced past `limit` so a silent truncation fails the run.
 */
describe('Pagination stress cycle (e2e)', () => {
  const TOTAL = 12;
  const LIMIT = 5;

  let app: INestApplication;
  let server: App;
  let director: Api;
  let dataSource: DataSource;

  let branchId: string;
  let representativeApi: Api;
  let posModelId: string;
  let machineTypeId: string;
  let merchantId: string;
  let custodyUserId: string;
  let historyMachineId: string;

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);
    dataSource = app.get(DataSource);

    const branch = await createBranch(director, 'فرع الصفحات');
    branchId = branch.id;

    const representative = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
      branchId,
      fullName: 'مندوب الصفحات',
    });
    representativeApi = representative.api;

    const models = await ok<{ id: string; machineType: { id: string; requiresSim: boolean } }[]>(
      director.get('/machine-models?limit=100'),
    );
    const pos = models.find((model) => model.machineType.requiresSim)!;
    posModelId = pos.id;
    machineTypeId = pos.machineType.id;

    await seedOffsetLists();
    await seedNestedAndKeyset();
  }, 240_000);

  afterAll(async () => {
    await app?.close();
  });

  async function createMachine(prefix: string): Promise<{ id: string }> {
    const tag = uniqueCode(prefix);
    return ok<{ id: string }>(
      director.post('/machines', {
        serial: tag,
        machineModelId: posModelId,
        simSerial: `SIM-${tag}`,
        boxSerial: `BX-${tag}`,
        battery: { serial: `BT-${tag}` },
        hasBox: true,
      }),
      201,
    );
  }

  async function seedOffsetLists(): Promise<void> {
    for (let index = 0; index < TOTAL; index += 1) {
      await ok(
        director.post('/branches', {
          code: uniqueCode(`PG${index}`),
          name: `فرع صفحة ${index}`,
        }),
        201,
      );
    }

    for (let index = 0; index < TOTAL; index += 1) {
      await ok(
        director.post('/suppliers', {
          name: `مورد صفحة ${index} ${uniqueCode('SUP')}`,
          phone: `022${String(1000000 + index).slice(0, 7)}`,
        }),
        201,
      );
    }

    for (let index = 0; index < TOTAL; index += 1) {
      await ok(
        director.post('/machine-models', {
          code: uniqueCode(`MDL${index}`),
          machineTypeId,
          translations: {
            ar: { name: `موديل صفحة ${index}` },
            en: { name: `Page model ${index}` },
          },
        }),
        201,
      );
    }

    const machineBatch = Array.from({ length: TOTAL }, () => {
      const tag = uniqueCode('SN');
      return {
        serial: tag,
        machineModelId: posModelId,
        simSerial: `SIM-${tag}`,
        boxSerial: `BX-${tag}`,
        battery: { serial: `BT-${tag}` },
        hasBox: true,
      };
    });
    await ok(director.post('/machines/bulk', { machines: machineBatch }), 201);

    for (let index = 0; index < TOTAL; index += 1) {
      await createMerchant(representativeApi, `تاجر صفحة ${index}`);
    }

    const supervisorRole = await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR);
    for (let index = 0; index < TOTAL; index += 1) {
      await provisionUser(server, director, {
        roleId: supervisorRole,
        branchId,
        fullName: `مشرف صفحة ${index}`,
      });
    }

    for (let index = 0; index < TOTAL; index += 1) {
      const category = await ok<{ id: string }>(
        director.post('/finance/categories', {
          kind: FinanceKind.EXPENSE,
          translations: {
            ar: { name: `ميزانية صفحة ${index} ${uniqueCode('CAT')}` },
            en: { name: `Page budget ${index} ${uniqueCode('CAT')}` },
          },
        }),
        201,
      );

      await ok(
        director.post('/finance/budgets', {
          categoryId: category.id,
          periodType: 'MONTHLY',
          periodStart: '2026-01-01',
          periodEnd: '2026-01-31',
          amount: 1000 + index,
        }),
        201,
      );
    }
  }

  async function seedNestedAndKeyset(): Promise<void> {
    const merchant = await createMerchant(representativeApi, 'تاجر العهدة الصفحية');
    merchantId = merchant.id;

    const custodyUser = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
      branchId,
      fullName: 'مندوب عهدة الصفحات',
    });
    custodyUserId = custodyUser.id;

    const merchantBatch = Array.from({ length: TOTAL }, () => {
      const tag = uniqueCode('MM');
      return {
        serial: tag,
        machineModelId: posModelId,
        simSerial: `SIM-${tag}`,
        boxSerial: `BX-${tag}`,
        battery: { serial: `BT-${tag}` },
        hasBox: true,
      };
    });
    const merchantCreated = await ok<{ created: number; machines: { id: string }[] }>(
      director.post('/machines/bulk', { machines: merchantBatch }),
      201,
    );
    const merchantMachines = merchantCreated.machines;

    await dataSource.getRepository(Machine).update(
      merchantMachines.map((row) => row.id),
      {
        currentHolderType: PartyType.MERCHANT,
        currentHolderId: merchantId,
        currentBranchId: branchId,
        status: MachineStatus.WITH_MERCHANT,
      },
    );

    for (let index = 0; index < TOTAL; index += 1) {
      await ok(
        director.post(`/merchants/${merchantId}/subscriptions`, {
          machineId: merchantMachines[index].id,
          planType: 'MONTHLY',
          amount: 100 + index,
          startDate: '2026-01-01',
        }),
        201,
      );
    }

    const heldBatch = Array.from({ length: TOTAL }, () => {
      const tag = uniqueCode('CU');
      return {
        serial: tag,
        machineModelId: posModelId,
        simSerial: `SIM-${tag}`,
        boxSerial: `BX-${tag}`,
        battery: { serial: `BT-${tag}` },
        hasBox: true,
      };
    });
    const heldCreated = await ok<{ machines: { id: string }[] }>(
      director.post('/machines/bulk', { machines: heldBatch }),
      201,
    );
    await dataSource.getRepository(Machine).update(
      heldCreated.machines.map((row) => row.id),
      {
        currentHolderType: PartyType.REPRESENTATIVE,
        currentHolderId: custodyUserId,
        currentBranchId: branchId,
      },
    );

    const historyMachine = await createMachine('HIST');
    historyMachineId = historyMachine.id;

    const locations = await ok<{ id: string; code: string }[]>(
      director.get('/maintenance-locations'),
    );
    const workshopId = locations.find((row) => row.code === 'INTERNAL_WORKSHOP')!.id;

    for (let index = 0; index < TOTAL; index += 1) {
      const order = await ok<{ id: string }>(
        director.post('/maintenance-orders', {
          machineId: historyMachineId,
          locationId: workshopId,
          reportedFault: `عطل صفحة ${index}`,
          sentAt: `2026-01-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
        }),
        201,
      );
      await ok(
        director.post(`/maintenance-orders/${order.id}/cancel`, {
          reason: `إلغاء صفحة ${index}`,
        }),
      );
    }
  }

  describe('offset lists', () => {
    it('pages /branches across multiple pages', async () => {
      await assertOffsetPaging(director, '/branches', {
        limit: LIMIT,
        minTotal: TOTAL,
      });
    });

    it('pages /warehouses across multiple pages', async () => {
      await assertOffsetPaging(director, '/warehouses', {
        limit: LIMIT,
        minTotal: TOTAL,
      });
    });

    it('pages /suppliers across multiple pages', async () => {
      await assertOffsetPaging(director, '/suppliers', {
        limit: LIMIT,
        minTotal: TOTAL,
      });
    });

    it('pages /machine-models across multiple pages', async () => {
      await assertOffsetPaging(director, '/machine-models', {
        limit: LIMIT,
        minTotal: TOTAL,
      });
    });

    it('pages /machines across multiple pages', async () => {
      await assertOffsetPaging(director, '/machines', {
        limit: LIMIT,
        minTotal: TOTAL,
      });
    });

    it('pages /merchants across multiple pages', async () => {
      await assertOffsetPaging(director, '/merchants', {
        limit: LIMIT,
        minTotal: TOTAL,
      });
    });

    it('pages /merchants/pickable across multiple pages', async () => {
      await assertOffsetPaging(representativeApi, '/merchants/pickable', {
        limit: LIMIT,
        minTotal: TOTAL,
      });
    });

    it('pages /users across multiple pages', async () => {
      await assertOffsetPaging(director, '/users', {
        limit: LIMIT,
        minTotal: TOTAL,
      });
    });

    it('pages /finance/categories across multiple pages', async () => {
      await assertOffsetPaging(director, '/finance/categories?kind=EXPENSE', {
        limit: LIMIT,
        minTotal: TOTAL,
      });
    });

    it('pages /finance/budgets across multiple pages', async () => {
      await assertOffsetPaging(director, '/finance/budgets', {
        limit: LIMIT,
        minTotal: TOTAL,
      });
    });

    it('pages /finance/budgets/status as an array with asOf on each row', async () => {
      const { pages } = await assertOffsetPaging<{ id: string; asOf: string }>(
        director,
        '/finance/budgets/status?asOf=2026-01-15',
        { limit: LIMIT, minTotal: TOTAL },
      );
      expect(pages.flat().every((row) => row.asOf === '2026-01-15')).toBe(true);
    });

    it('pages /transfers/recipients for a user receiver type', async () => {
      await assertOffsetPaging(
        representativeApi,
        `/transfers/recipients?type=${TransferType.REPRESENTATIVE_TO_BRANCH}`,
        { limit: LIMIT, minTotal: TOTAL },
      );
    });
  });

  describe('nested envelopes', () => {
    it('pages merchant machines', async () => {
      await assertOffsetPaging(director, `/merchants/${merchantId}/machines`, {
        limit: LIMIT,
        minTotal: TOTAL,
      });
    });

    it('pages merchant subscriptions', async () => {
      await assertOffsetPaging(director, `/merchants/${merchantId}/subscriptions`, {
        limit: LIMIT,
        minTotal: TOTAL,
      });
    });

    it('pages user custody machinesMeta without shrinking summary', async () => {
      const full = await ok<{
        summary: { totalMachines: number };
        machines: { id: string }[];
        machinesMeta: { total: number; limit: number; hasNext: boolean };
      }>(director.get(`/users/${custodyUserId}/custody`));

      expect(full.summary.totalMachines).toBeGreaterThan(LIMIT);
      expect(full.machinesMeta.total).toBe(full.summary.totalMachines);

      const page1 = await ok<typeof full>(
        director.get(`/users/${custodyUserId}/custody?page=1&limit=${LIMIT}`),
      );
      expect(page1.machines).toHaveLength(LIMIT);
      expect(page1.summary.totalMachines).toBe(full.summary.totalMachines);
      expect(page1.machinesMeta).toMatchObject({
        total: full.summary.totalMachines,
        limit: LIMIT,
        hasNext: true,
      });

      const page2 = await ok<typeof full>(
        director.get(`/users/${custodyUserId}/custody?page=2&limit=${LIMIT}`),
      );
      expect(page2.machines.length).toBeGreaterThan(0);
      expect(page2.summary.totalMachines).toBe(full.summary.totalMachines);
      expect(
        page2.machines.some((row) => page1.machines.some((first) => first.id === row.id)),
      ).toBe(false);

      await fails(
        director.get(`/users/${custodyUserId}/custody?limit=1000`),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('pages maintenance-history ordersMeta without shrinking totals', async () => {
      const full = await ok<{
        totals: { orders: number };
        orders: { id: string }[];
        ordersMeta: { total: number; limit: number; hasNext: boolean };
      }>(director.get(`/machines/${historyMachineId}/maintenance-history`));

      expect(full.totals.orders).toBe(TOTAL);
      expect(full.ordersMeta.total).toBe(TOTAL);

      const page1 = await ok<typeof full>(
        director.get(`/machines/${historyMachineId}/maintenance-history?page=1&limit=${LIMIT}`),
      );
      expect(page1.orders).toHaveLength(LIMIT);
      expect(page1.totals.orders).toBe(TOTAL);
      expect(page1.ordersMeta).toMatchObject({
        total: TOTAL,
        limit: LIMIT,
        hasNext: true,
      });

      const page2 = await ok<typeof full>(
        director.get(`/machines/${historyMachineId}/maintenance-history?page=2&limit=${LIMIT}`),
      );
      expect(page2.orders.length).toBeGreaterThan(0);
      expect(page2.totals.orders).toBe(TOTAL);

      await fails(
        director.get(`/machines/${historyMachineId}/maintenance-history?limit=1000`),
        400,
        'VALIDATION_FAILED',
      );
    });
  });

  describe('keyset timelines', () => {
    it('pages the merchant timeline with a cursor', async () => {
      const count = await assertCursorPaging(director, `/merchants/${merchantId}/timeline`, {
        limit: 2,
        expectMultiplePages: true,
      });
      expect(count).toBeGreaterThan(LIMIT);
    });
  });

  describe('sync delta chunking', () => {
    it('sets hasMore when limited and clears it when the window fits', async () => {
      const status = await ok<{ serverTime: string }>(director.get('/sync/status'));
      const since = new Date(Date.parse(status.serverTime) - 60_000).toISOString();

      for (let index = 0; index < 3; index += 1) {
        await createMachine(`DL${index}`);
      }

      const capped = await ok<{ hasMore: boolean; nextSince: string }>(
        representativeApi.get(`/sync/delta?since=${encodeURIComponent(since)}&limit=1`),
      );
      expect(capped.hasMore).toBe(true);
      expect(capped.nextSince).toBeTruthy();

      let cursor = since;
      let safety = 0;
      let lastHasMore = true;
      while (lastHasMore && safety < 25) {
        const chunk = await ok<{ hasMore: boolean; nextSince: string }>(
          representativeApi.get(`/sync/delta?since=${encodeURIComponent(cursor)}&limit=50`),
        );
        lastHasMore = chunk.hasMore;
        cursor = chunk.nextSince;
        safety += 1;
      }
      expect(lastHasMore).toBe(false);
    });
  });

  describe('seeded lookups stay unpaged', () => {
    it('returns a bare array for payment-methods and refuses page/limit', async () => {
      const methods = await ok<unknown[]>(director.get('/payment-methods'));
      expect(Array.isArray(methods)).toBe(true);
      expect(methods.length).toBeGreaterThan(0);

      await fails(director.get('/payment-methods?page=1&limit=20'), 400, 'VALIDATION_FAILED');
    });
  });
});
