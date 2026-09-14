import { randomUUID } from 'node:crypto';
import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import {
  MaintenanceResult,
  ResponsibleParty,
  WarehouseType,
} from 'src/common/enums/operations.enum';
import { SignatureMethod, TransferType } from 'src/common/enums/transfer.enum';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { SettingKey } from 'src/modules/settings/settings.catalogue';
import { Api, fails, ok, okPage } from './utils/api-client';
import {
  createBranch,
  createMerchant,
  loginAsDirector,
  provisionUser,
  ProvisionedUser,
  roleIdByCode,
  uniqueCode,
} from './utils/fixtures';
import { createTestApp } from './utils/test-app';

interface MachineResponse {
  id: string;
  serial: string;
  status: MachineStatus;
  hasBox: boolean;
  purchase: { price: number | null; date: string | null };
  maintenance: { repairCount: number; totalRepairCost: number };
  holder: { type: string; id: string | null } | null;
  decommissionedAt: string | null;
}

interface DecommissionResponse {
  id: string;
  machine: { id: string; serial: string; status: string };
  reasonCode: string;
  reasonName: string;
  notes: string;
  decommissionedAt: string;
  decommissionedByUserId: string;
  snapshot: {
    purchasePrice: number | null;
    cumulativeRepairCost: number;
    repairCount: number;
    costToValueRatio: number | null;
    chainLength: number;
  };
  transferId: string | null;
  revertedAt: string | null;
  revertReason: string | null;
}

interface CandidateResponse {
  id: string;
  serial: string;
  purchasePrice: number | null;
  cumulativeRepairCost: number;
  costRatio: number | null;
  repairCount: number;
  isInChain: boolean;
  chainLength: number;
  recommendation: string;
  lastMaintenanceAt: string | null;
}

interface SettingResponse {
  key: string;
  value: number;
  default: number;
  kind: string;
  min: number;
  max: number;
  isOverridden: boolean;
}

interface MaintenanceOrderResponse {
  id: string;
  referenceNo: string;
  cost: number | null;
}

interface CostSummaryResponse {
  totalRepairCost: number;
  repairCount: number;
  costToValueRatio: number | null;
  recommendation: string;
}

interface TimelineEventResponse {
  type: string;
  refId: string;
  details: Record<string, unknown>;
}

interface LookupResponse {
  id: string;
  code: string;
}

interface WarehouseResponse {
  id: string;
  type: WarehouseType;
}

interface MachineModelResponse {
  id: string;
  machineType: { requiresSim: boolean };
}

interface TransferResponse {
  id: string;
  payloadHash: string;
}

const DRAWN = { method: SignatureMethod.DRAWN_SIGNATURE, deviceModel: 'e2e' };

const SENT_AT = '2026-02-14T08:30:00.000Z';
const RETURNED_AT = '2026-03-02T14:00:00.000Z';
const SCRAPPED_AT = '2026-09-01T09:00:00.000Z';

describe('Decommission (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;

  let branchId: string;
  let supervisor: ProvisionedUser;
  let representative: ProvisionedUser;

  let companyWarehouseId: string;
  let posModelId: string;
  let factoryLocationId: string;
  let beyondRepairId: string;
  let notCostEffectiveId: string;

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);

    branchId = (await createBranch(director, 'فرع الإحلال')).id;

    supervisor = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
      branchId,
      fullName: 'مشرف الإحلال',
    });

    representative = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
      branchId,
      fullName: 'مندوب الإحلال',
    });

    const warehouses = await ok<WarehouseResponse[]>(director.get('/warehouses?limit=100'));
    companyWarehouseId = warehouses.find((row) => row.type === WarehouseType.COMPANY_MAIN)!.id;

    posModelId = (await ok<MachineModelResponse[]>(director.get('/machine-models?limit=100'))).find(
      (model) => model.machineType.requiresSim,
    )!.id;

    // The factory route needs no maintenance store, so this spec never has to open one.
    factoryLocationId = (await ok<LookupResponse[]>(director.get('/maintenance-locations'))).find(
      (row) => row.code === 'FACTORY',
    )!.id;

    const reasons = await ok<LookupResponse[]>(director.get('/decommission-reasons'));
    beyondRepairId = reasons.find((row) => row.code === 'BEYOND_REPAIR')!.id;
    notCostEffectiveId = reasons.find((row) => row.code === 'NOT_COST_EFFECTIVE')!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── fixtures ───────────────────────────────────────────────────────────────

  let serialCounter = 0;

  async function createMachine(purchasePrice: number | null = 4200): Promise<MachineResponse> {
    serialCounter += 1;
    const tag = `${uniqueCode('D')}_${serialCounter}`;

    return ok<MachineResponse>(
      director.post('/machines', {
        serial: `SN-${tag}`,
        machineModelId: posModelId,
        simSerial: `SIM-${tag}`,
        boxSerial: `BX-${tag}`,
        battery: { serial: `BT-${tag}` },
        hasBox: true,
        ...(purchasePrice === null ? {} : { purchasePrice }),
        purchaseDate: '2024-01-15',
      }),
      201,
    );
  }

  /** A closed, company-paid repair, which is what gives a machine a cost history. */
  async function repair(machineId: string, cost: number): Promise<MaintenanceOrderResponse> {
    const order = await ok<MaintenanceOrderResponse>(
      director.post('/maintenance-orders', {
        machineId,
        locationId: factoryLocationId,
        reportedFault: 'عطل يحتاج إصلاحًا',
        sentAt: SENT_AT,
      }),
      201,
    );

    await ok(
      director.post(`/maintenance-orders/${order.id}/send`, {
        occurredAt: SENT_AT,
        signature: DRAWN,
      }),
    );

    await ok(
      director.post(`/maintenance-orders/${order.id}/receive`, {
        occurredAt: RETURNED_AT,
        warehouseId: companyWarehouseId,
        signature: DRAWN,
      }),
    );

    return ok<MaintenanceOrderResponse>(
      director.post(`/maintenance-orders/${order.id}/close`, {
        result: MaintenanceResult.REPAIRED,
        isFreeUnderWarranty: false,
        cost,
        // Borne by the factory so the cost is on the record without an expense that would then
        // make the order's cost immutable — this spec edits it.
        responsibleParty: ResponsibleParty.FACTORY,
        returnedAt: RETURNED_AT,
      }),
    );
  }

  function scrap(
    machineId: string,
    body: Record<string, unknown> = {},
  ): Promise<DecommissionResponse> {
    return ok<DecommissionResponse>(
      director.post(`/machines/${machineId}/decommission`, {
        reasonId: beyondRepairId,
        notes: 'تكلفة الإصلاح تجاوزت قيمة الماكينة',
        decommissionedAt: SCRAPPED_AT,
        signature: DRAWN,
        ...body,
      }),
      201,
    );
  }

  function readMachine(id: string): Promise<MachineResponse> {
    return ok<MachineResponse>(director.get(`/machines/${id}`));
  }

  /** Places the machine with a merchant, which is where it must not be scrapped from. */
  async function placeWithMerchant(machine: MachineResponse): Promise<void> {
    const merchant = await createMerchant(representative.api, `تاجر ${uniqueCode('T')}`);
    const item = { machineId: machine.id, hasCharger: true, hasBox: true, condition: 'GOOD' };

    const toBranch = await ok<TransferResponse>(
      director.post('/transfers', {
        clientUuid: randomUUID(),
        type: TransferType.COMPANY_TO_BRANCH,
        toPartyId: supervisor.id,
        occurredAt: new Date().toISOString(),
        items: [item],
      }),
      201,
    );

    await ok(
      supervisor.api.post(`/transfers/${toBranch.id}/confirm`, {
        signature: DRAWN,
        payloadHash: toBranch.payloadHash,
      }),
    );

    const toRep = await ok<TransferResponse>(
      supervisor.api.post('/transfers', {
        clientUuid: randomUUID(),
        type: TransferType.BRANCH_TO_REPRESENTATIVE,
        toPartyId: representative.id,
        occurredAt: new Date().toISOString(),
        items: [item],
      }),
      201,
    );

    await ok(
      representative.api.post(`/transfers/${toRep.id}/confirm`, {
        signature: DRAWN,
        payloadHash: toRep.payloadHash,
      }),
    );

    await ok(
      representative.api.post('/transfers', {
        clientUuid: randomUUID(),
        type: TransferType.REPRESENTATIVE_TO_MERCHANT,
        toPartyId: merchant.id,
        occurredAt: new Date().toISOString(),
        items: [item],
        senderSignature: DRAWN,
      }),
      201,
    );
  }

  // ── scrapping a machine ────────────────────────────────────────────────────

  describe('the decision', () => {
    it('scraps a machine, moves it to the scrap store and freezes the economics', async () => {
      const machine = await createMachine(4200);
      await repair(machine.id, 1400);
      await repair(machine.id, 2000);

      const scrapped = await scrap(machine.id, { reasonId: notCostEffectiveId });

      expect(scrapped.machine.id).toBe(machine.id);
      expect(scrapped.reasonCode).toBe('NOT_COST_EFFECTIVE');
      expect(scrapped.decommissionedAt).toBe(SCRAPPED_AT);
      expect(scrapped.transferId).not.toBeNull();
      expect(scrapped.snapshot).toMatchObject({
        purchasePrice: 4200,
        cumulativeRepairCost: 3400,
        repairCount: 2,
        costToValueRatio: 0.81,
        chainLength: 1,
      });

      const after = await readMachine(machine.id);
      expect(after.status).toBe(MachineStatus.DECOMMISSIONED);
      expect(after.decommissionedAt).toBe(SCRAPPED_AT);
      expect(after.holder?.type).toBe('WAREHOUSE');
    });

    it('demands a reason on the record', async () => {
      const machine = await createMachine();

      await fails(
        director.post(`/machines/${machine.id}/decommission`, {
          reasonId: beyondRepairId,
          decommissionedAt: SCRAPPED_AT,
          signature: DRAWN,
        }),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('demands a signature, because the scrapyard cannot sign for itself', async () => {
      const machine = await createMachine();

      await fails(
        director.post(`/machines/${machine.id}/decommission`, {
          reasonId: beyondRepairId,
          notes: 'الماكينة غير قابلة للإصلاح',
          decommissionedAt: SCRAPPED_AT,
        }),
        422,
        'SIGNATURE_REQUIRED',
      );
    });

    it('rejects an unknown reason', async () => {
      const machine = await createMachine();

      await fails(
        director.post(`/machines/${machine.id}/decommission`, {
          reasonId: randomUUID(),
          notes: 'سبب غير معروف',
          decommissionedAt: SCRAPPED_AT,
          signature: DRAWN,
        }),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('refuses to scrap the same machine twice', async () => {
      const machine = await createMachine();
      await scrap(machine.id);

      await fails(
        director.post(`/machines/${machine.id}/decommission`, {
          reasonId: beyondRepairId,
          notes: 'محاولة ثانية للإحلال',
          decommissionedAt: SCRAPPED_AT,
          signature: DRAWN,
        }),
        409,
        'ALREADY_DECOMMISSIONED',
      );
    });

    it('refuses to scrap a machine that is still in a merchant’s shop', async () => {
      const machine = await createMachine();
      await placeWithMerchant(machine);

      await fails(
        director.post(`/machines/${machine.id}/decommission`, {
          reasonId: beyondRepairId,
          notes: 'الماكينة ما زالت عند التاجر',
          decommissionedAt: SCRAPPED_AT,
          signature: DRAWN,
        }),
        422,
        'MACHINE_NOT_IN_WAREHOUSE',
      );

      expect((await readMachine(machine.id)).status).toBe(MachineStatus.WITH_MERCHANT);
    });

    it('refuses to scrap a machine with an open maintenance order', async () => {
      const machine = await createMachine();

      await ok(
        director.post('/maintenance-orders', {
          machineId: machine.id,
          locationId: factoryLocationId,
          reportedFault: 'عطل لم يُغلق بعد',
          sentAt: SENT_AT,
        }),
        201,
      );

      await fails(
        director.post(`/machines/${machine.id}/decommission`, {
          reasonId: beyondRepairId,
          notes: 'أمر صيانة ما زال مفتوحًا',
          decommissionedAt: SCRAPPED_AT,
          signature: DRAWN,
        }),
        409,
        'OPEN_MAINTENANCE_ORDER',
      );
    });

    it('refuses to scrap a machine that has already been replaced', async () => {
      const machine = await createMachine();
      const tag = uniqueCode('X');

      await ok(
        director.post(`/machines/${machine.id}/replace`, {
          newSerial: `SN-${tag}`,
          newBattery: { serial: `BT-${tag}` },
          newSimSerial: `SIM-${tag}`,
          hasBox: false,
          reason: 'المصنع سلم وحدة بديلة',
          replacedAt: RETURNED_AT,
        }),
        201,
      );

      await fails(
        director.post(`/machines/${machine.id}/decommission`, {
          reasonId: beyondRepairId,
          notes: 'الماكينة تم استبدالها بالفعل',
          decommissionedAt: SCRAPPED_AT,
          signature: DRAWN,
        }),
        409,
        'MACHINE_ALREADY_REPLACED',
      );
    });
  });

  // ── what a scrapped machine may no longer do ───────────────────────────────

  describe('after it is scrapped', () => {
    it('rejects any new transfer', async () => {
      const machine = await createMachine();
      await scrap(machine.id);

      await fails(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [{ machineId: machine.id, hasCharger: true, hasBox: true, condition: 'GOOD' }],
        }),
        422,
        'MACHINE_RETIRED',
      );
    });

    it('rejects a new maintenance order', async () => {
      const machine = await createMachine();
      await scrap(machine.id);

      await fails(
        director.post('/maintenance-orders', {
          machineId: machine.id,
          locationId: factoryLocationId,
          reportedFault: 'عطل في ماكينة تالفة',
          sentAt: SENT_AT,
        }),
        422,
        'MACHINE_RETIRED',
      );
    });

    it('keeps the machine readable, with its scrapping on the timeline', async () => {
      const machine = await createMachine();
      await repair(machine.id, 500);
      const scrapped = await scrap(machine.id);

      const { items } = await okPage<TimelineEventResponse>(
        director.get(`/machines/${machine.id}/timeline?limit=50`),
      );

      const event = items.find((row) => row.type === 'DECOMMISSIONED')!;
      expect(event.refId).toBe(scrapped.id);
      expect(event.details.reason).toBe('BEYOND_REPAIR');
    });

    it('serves the decommission record for the machine, and 404s for one still in use', async () => {
      const machine = await createMachine();
      const scrapped = await scrap(machine.id);

      const read = await ok<DecommissionResponse>(
        director.get(`/machines/${machine.id}/decommission`),
      );
      expect(read.id).toBe(scrapped.id);
      expect(read.reasonName).not.toBe('');

      await fails(
        director.get(`/machines/${(await createMachine()).id}/decommission`),
        404,
        'DECOMMISSION_NOT_FOUND',
      );
    });

    it('lists what the company has scrapped, filtered by reason', async () => {
      const machine = await createMachine();
      const scrapped = await scrap(machine.id, { reasonId: notCostEffectiveId });

      const { items } = await okPage<DecommissionResponse>(
        director.get(`/decommissions?reasonId=${notCostEffectiveId}&limit=100`),
      );

      expect(items.some((row) => row.id === scrapped.id)).toBe(true);
      expect(items.every((row) => row.reasonCode === 'NOT_COST_EFFECTIVE')).toBe(true);
    });

    /** `13`, step 4: the snapshot is the evidence for the decision, not a live join. */
    it('freezes the cost snapshot even when a maintenance cost is corrected afterwards', async () => {
      const machine = await createMachine(4000);
      const order = await repair(machine.id, 1000);

      const scrapped = await scrap(machine.id);
      expect(scrapped.snapshot.cumulativeRepairCost).toBe(1000);

      const corrected = await ok<MaintenanceOrderResponse>(
        director.patch(`/maintenance-orders/${order.id}`, { cost: 2500 }),
      );
      expect(corrected.cost).toBe(2500);

      const reread = await ok<DecommissionResponse>(
        director.get(`/machines/${machine.id}/decommission`),
      );
      expect(reread.snapshot.cumulativeRepairCost).toBe(1000);
      expect(reread.snapshot.costToValueRatio).toBe(0.25);

      // The live read does move — that is the difference between the two numbers.
      const summary = await ok<CostSummaryResponse>(
        director.get(`/machines/${machine.id}/cost-summary`),
      );
      expect(summary.totalRepairCost).toBe(2500);
    });
  });

  // ── the mistake path ───────────────────────────────────────────────────────

  describe('reverting', () => {
    it('brings a machine back to the company warehouse with a reason on the record', async () => {
      const machine = await createMachine();
      await scrap(machine.id);

      const reverted = await ok<DecommissionResponse>(
        director.post(`/machines/${machine.id}/decommission/revert`, {
          reason: 'تم إحلال الماكينة الخطأ',
        }),
      );

      expect(reverted.revertedAt).not.toBeNull();
      expect(reverted.revertReason).toBe('تم إحلال الماكينة الخطأ');

      const after = await readMachine(machine.id);
      expect(after.status).toBe(MachineStatus.IN_COMPANY_WAREHOUSE);
      expect(after.decommissionedAt).toBeNull();
      expect(after.holder).toMatchObject({ type: 'WAREHOUSE', id: companyWarehouseId });
    });

    it('lets a reverted machine be repaired and then scrapped again', async () => {
      const machine = await createMachine();
      await scrap(machine.id);
      await ok(
        director.post(`/machines/${machine.id}/decommission/revert`, {
          reason: 'قرار خاطئ من الإدارة',
        }),
      );

      await repair(machine.id, 250);
      const second = await scrap(machine.id, { decommissionedAt: '2026-09-05T09:00:00.000Z' });

      expect(second.snapshot.cumulativeRepairCost).toBe(250);
      expect((await readMachine(machine.id)).status).toBe(MachineStatus.DECOMMISSIONED);
    });

    it('404s a revert for a machine that was never scrapped', async () => {
      await fails(
        director.post(`/machines/${(await createMachine()).id}/decommission/revert`, {
          reason: 'لا يوجد سجل إحلال',
        }),
        404,
        'DECOMMISSION_NOT_FOUND',
      );
    });
  });

  // ── the recommendation ─────────────────────────────────────────────────────

  describe('candidates and thresholds', () => {
    it('lists a machine whose repair bill has passed the ratio, with the criteria used', async () => {
      const machine = await createMachine(1000);
      await repair(machine.id, 800);

      const { items, meta } = await okPage<CandidateResponse>(
        director.get('/machines/decommission-candidates?limit=100'),
      );

      const found = items.find((row) => row.id === machine.id)!;
      expect(found.costRatio).toBe(0.8);
      expect(found.recommendation).toBe('CONSIDER_DECOMMISSION');
      expect(found.lastMaintenanceAt).not.toBeNull();

      expect((meta as unknown as { criteria: Record<string, number> }).criteria).toMatchObject({
        minCostRatio: 0.7,
        minRepairCount: 5,
      });
    });

    it('leaves a machine below both thresholds off the list', async () => {
      const machine = await createMachine(10000);
      await repair(machine.id, 100);

      const { items } = await okPage<CandidateResponse>(
        director.get('/machines/decommission-candidates?limit=100'),
      );

      expect(items.some((row) => row.id === machine.id)).toBe(false);

      const summary = await ok<CostSummaryResponse>(
        director.get(`/machines/${machine.id}/cost-summary`),
      );
      expect(summary.recommendation).toBe('KEEP');
    });

    /** `12`, rule 4: the asset is judged on the whole chain, not on the serial in front of you. */
    it('judges a chain on its combined repair bill', async () => {
      const machine = await createMachine(2000);
      await repair(machine.id, 900);

      const tag = uniqueCode('C');
      const swapped = await ok<{ newMachineId: string }>(
        director.post(`/machines/${machine.id}/replace`, {
          newSerial: `SN-${tag}`,
          newBattery: { serial: `BT-${tag}` },
          newSimSerial: `SIM-${tag}`,
          hasBox: true,
          reason: 'المصنع استبدل الوحدة',
          replacedAt: RETURNED_AT,
        }),
        201,
      );

      await repair(swapped.newMachineId, 700);

      const { items } = await okPage<CandidateResponse>(
        director.get('/machines/decommission-candidates?limit=100'),
      );
      const candidate = items.find((row) => row.id === swapped.newMachineId)!;

      // 1600 against the 2000 the first serial cost: neither link reaches the line alone.
      expect(candidate.isInChain).toBe(true);
      expect(candidate.chainLength).toBe(2);
      expect(candidate.cumulativeRepairCost).toBe(1600);
      expect(candidate.costRatio).toBe(0.8);
      expect(candidate.purchasePrice).toBe(2000);
    });

    it('lists a machine repaired too many times whatever the money says', async () => {
      const machine = await createMachine(100000);
      for (let i = 0; i < 5; i += 1) await repair(machine.id, 10);

      const { items } = await okPage<CandidateResponse>(
        director.get('/machines/decommission-candidates?limit=100'),
      );
      const found = items.find((row) => row.id === machine.id)!;

      expect(found.repairCount).toBe(5);
      expect(found.recommendation).toBe('CONSIDER_DECOMMISSION');
    });

    it('narrows the list by an explicit ratio', async () => {
      const machine = await createMachine(1000);
      await repair(machine.id, 450);

      const loose = await okPage<CandidateResponse>(
        director.get('/machines/decommission-candidates?minCostRatio=0.4&limit=100'),
      );
      expect(loose.items.some((row) => row.id === machine.id)).toBe(true);

      const strict = await okPage<CandidateResponse>(
        director.get('/machines/decommission-candidates?minCostRatio=0.9&limit=100'),
      );
      expect(strict.items.some((row) => row.id === machine.id)).toBe(false);
    });

    it('leaves a scrapped machine out of the candidates', async () => {
      const machine = await createMachine(1000);
      await repair(machine.id, 900);
      await scrap(machine.id);

      const { items } = await okPage<CandidateResponse>(
        director.get('/machines/decommission-candidates?limit=100'),
      );

      expect(items.some((row) => row.id === machine.id)).toBe(false);
    });
  });

  // ── the thresholds themselves ──────────────────────────────────────────────

  describe('settings', () => {
    afterEach(async () => {
      // The threshold is global, and every other spec in this file reads the default.
      await ok<SettingResponse>(
        director.put(`/settings/${SettingKey.DECOMMISSION_COST_RATIO_CONSIDER}`, { value: 0.7 }),
      );
    });

    it('serves the catalogue with the defaults', async () => {
      const settings = await ok<SettingResponse[]>(director.get('/settings'));

      expect(settings.map((row) => row.key)).toEqual([
        SettingKey.DECOMMISSION_COST_RATIO_REVIEW,
        SettingKey.DECOMMISSION_COST_RATIO_CONSIDER,
        SettingKey.DECOMMISSION_REPAIR_COUNT_CONSIDER,
      ]);

      const review = settings.find((row) => row.key === SettingKey.DECOMMISSION_COST_RATIO_REVIEW)!;
      expect(review.default).toBe(0.4);
      expect(review.min).toBe(0);
      expect(review.max).toBe(1);
    });

    it('changes the verdict when the threshold moves', async () => {
      const machine = await createMachine(1000);
      await repair(machine.id, 500);

      const before = await ok<CostSummaryResponse>(
        director.get(`/machines/${machine.id}/cost-summary`),
      );
      expect(before.recommendation).toBe('REVIEW');

      const updated = await ok<SettingResponse>(
        director.put(`/settings/${SettingKey.DECOMMISSION_COST_RATIO_CONSIDER}`, { value: 0.5 }),
      );
      expect(updated.value).toBe(0.5);
      expect(updated.isOverridden).toBe(true);

      const after = await ok<CostSummaryResponse>(
        director.get(`/machines/${machine.id}/cost-summary`),
      );
      expect(after.recommendation).toBe('CONSIDER_DECOMMISSION');
    });

    it('range-checks the value against the key', async () => {
      await fails(
        director.put(`/settings/${SettingKey.DECOMMISSION_COST_RATIO_CONSIDER}`, { value: 1.5 }),
        400,
        'VALIDATION_FAILED',
      );

      await fails(
        director.put(`/settings/${SettingKey.DECOMMISSION_REPAIR_COUNT_CONSIDER}`, { value: 3.5 }),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('404s a key that is not in the catalogue', async () => {
      await fails(director.get('/settings/NOT_A_SETTING'), 404, 'SETTING_NOT_FOUND');
      await fails(director.put('/settings/NOT_A_SETTING', { value: 1 }), 404, 'SETTING_NOT_FOUND');
    });
  });

  // ── permissions ────────────────────────────────────────────────────────────

  describe('permissions', () => {
    it('refuses a supervisor the right to scrap a machine', async () => {
      const machine = await createMachine();

      await fails(
        supervisor.api.post(`/machines/${machine.id}/decommission`, {
          reasonId: beyondRepairId,
          notes: 'المشرف يحاول الإحلال',
          decommissionedAt: SCRAPPED_AT,
          signature: DRAWN,
        }),
        403,
        'INSUFFICIENT_PERMISSIONS',
      );
    });

    it('refuses a supervisor the right to change a threshold', async () => {
      await fails(
        supervisor.api.put(`/settings/${SettingKey.DECOMMISSION_COST_RATIO_CONSIDER}`, {
          value: 0.9,
        }),
        403,
        'INSUFFICIENT_PERMISSIONS',
      );
    });

    /**
     * `machines.read` without `machines.read.all` is one branch's worth of fleet. A machine on the
     * company shelf belongs to no branch, so the candidates a Director acts on are not his to see.
     */
    it('holds a supervisor’s candidates list to his own branch', async () => {
      const machine = await createMachine(1000);
      await repair(machine.id, 900);

      const mine = await okPage<CandidateResponse>(
        supervisor.api.get('/machines/decommission-candidates?limit=100'),
      );
      expect(mine.items.some((row) => row.id === machine.id)).toBe(false);

      const all = await okPage<CandidateResponse>(
        director.get('/machines/decommission-candidates?limit=100'),
      );
      expect(all.items.some((row) => row.id === machine.id)).toBe(true);
    });
  });
});
