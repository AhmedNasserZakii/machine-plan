import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { Api, fails, hasFieldError, ok, okPage } from './utils/api-client';
import {
  createBranch,
  loginAsDirector,
  provisionUser,
  roleIdByCode,
  uniqueCode,
} from './utils/fixtures';
import { createTestApp } from './utils/test-app';

interface MachineTypeResponse {
  id: string;
  code: string;
  requiresSim: boolean;
}

interface MachineModelResponse {
  id: string;
  code: string;
  machineType: { id: string; code: string; requiresSim: boolean };
}

interface MachineResponse {
  id: string;
  serial: string;
  simSerial: string | null;
  boxSerial: string | null;
  status: MachineStatus;
  hasBox: boolean;
  notes: string | null;
  type: { id: string; name: string; requiresSim: boolean };
  model: { id: string; name: string; manufacturer: string | null };
  battery: { id: string; serial: string } | null;
  branch: { id: string; name: string } | null;
  holder: { type: string; id: string | null } | null;
  warranty: { start: string | null; end: string | null; isActive: boolean; daysRemaining: number };
  purchase: { price: number | null; date: string | null; invoiceNo: string | null };
  maintenance: { repairCount: number; totalRepairCost: number; costVsPricePercent: number | null };
}

interface LookupResponse {
  matchedOn: 'MACHINE' | 'BATTERY' | 'SIM' | 'BOX';
  machine: MachineResponse;
}

interface BulkResponse {
  created: number;
  machines: MachineResponse[];
}

const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

describe('Machines (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;

  /** A model whose type requires a SIM, and one that forbids it. */
  let posModelId: string;
  let pinPadModelId: string;

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);

    const models = await ok<MachineModelResponse[]>(director.get('/machine-models?limit=100'));
    posModelId = models.find((model) => model.machineType.requiresSim)!.id;

    pinPadModelId = await createPinPadModel();
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * The seed ships PIN_PAD as a type but no model under it, and the "a SIM is not applicable
   * here" rule cannot be exercised without one.
   */
  async function createPinPadModel(): Promise<string> {
    const types = await ok<MachineTypeResponse[]>(director.get('/machine-types'));
    const pinPad = types.find((type) => !type.requiresSim)!;

    const created = await ok<{ id: string }>(
      director.post('/machine-models', {
        code: uniqueCode('MM'),
        machineTypeId: pinPad.id,
        manufacturer: 'Ingenico',
        translations: { ar: { name: 'لوحة إدخال' }, en: { name: 'Pin pad' } },
      }),
      201,
    );

    return created.id;
  }

  function newMachine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const serial = uniqueCode('SN');

    return {
      serial,
      machineModelId: posModelId,
      battery: { serial: `BT_${serial}` },
      simSerial: `SIM_${serial}`,
      hasBox: true,
      ...overrides,
    };
  }

  function createMachine(overrides: Record<string, unknown> = {}): Promise<MachineResponse> {
    return ok<MachineResponse>(director.post('/machines', newMachine(overrides)), 201);
  }

  describe('creation', () => {
    it('registers a machine with its battery and the type behind its model', async () => {
      const machine = await createMachine({
        purchasePrice: 4200,
        purchaseDate: '2025-02-10',
        factoryInvoiceNo: 'F-2231',
        warrantyStart: '2025-02-10',
        warrantyEnd: '2099-02-10',
      });

      expect(machine).toMatchObject({
        status: MachineStatus.IN_COMPANY_WAREHOUSE,
        hasBox: true,
        type: { requiresSim: true },
        purchase: { price: 4200, date: '2025-02-10', invoiceNo: 'F-2231' },
        maintenance: { repairCount: 0, totalRepairCost: 0 },
      });

      expect(machine.battery?.serial).toBe(`BT_${machine.serial}`);
      expect(machine.warranty.isActive).toBe(true);
      // No transfer has happened yet, so nobody holds it and it belongs to no branch.
      expect(machine.holder).toBeNull();
      expect(machine.branch).toBeNull();
    });

    it('rejects a duplicate machine serial', async () => {
      const existing = await createMachine();

      await fails(
        director.post('/machines', newMachine({ serial: existing.serial })),
        409,
        'SERIAL_EXISTS',
      );
    });

    it('rejects a duplicate SIM serial', async () => {
      const existing = await createMachine();

      await fails(
        director.post('/machines', newMachine({ simSerial: existing.simSerial })),
        409,
        'SIM_SERIAL_EXISTS',
      );
    });

    it('rejects a duplicate box serial', async () => {
      const existing = await createMachine({ boxSerial: uniqueCode('BX') });

      await fails(
        director.post('/machines', newMachine({ boxSerial: existing.boxSerial })),
        409,
        'BOX_SERIAL_EXISTS',
      );
    });

    it('rejects a duplicate battery serial', async () => {
      const existing = await createMachine();

      await fails(
        director.post('/machines', newMachine({ battery: { serial: existing.battery!.serial } })),
        409,
        'BATTERY_SERIAL_EXISTS',
      );
    });

    it('requires a SIM when the machine type carries one', async () => {
      const body = newMachine();
      delete body.simSerial;

      const error = await fails(director.post('/machines', body), 400, 'VALIDATION_FAILED');

      // The path names the field on *this* request body, not a bulk array position.
      expect(hasFieldError(error, 'simSerial')).toBe(true);
      expect(error.details?.[0].constraint).toContain('required');
    });

    it('refuses a SIM on a type that has no mobile line', async () => {
      const error = await fails(
        director.post('/machines', newMachine({ machineModelId: pinPadModelId })),
        400,
        'VALIDATION_FAILED',
      );

      expect(error.details?.[0].constraint).toContain('not applicable');
    });

    it('accepts a pin pad with no SIM at all', async () => {
      const body = newMachine({ machineModelId: pinPadModelId, hasBox: false });
      delete body.simSerial;

      const machine = await ok<MachineResponse>(director.post('/machines', body), 201);

      expect(machine.simSerial).toBeNull();
      expect(machine.type.requiresSim).toBe(false);
    });

    it('rejects an unknown model rather than writing a dangling row', async () => {
      const error = await fails(
        director.post('/machines', newMachine({ machineModelId: UNKNOWN_UUID })),
        400,
        'VALIDATION_FAILED',
      );

      expect(hasFieldError(error, 'machineModelId')).toBe(true);
    });
  });

  describe('bulk intake', () => {
    it('commits the whole batch', async () => {
      const batch = [newMachine(), newMachine(), newMachine()];

      const result = await ok<BulkResponse>(
        director.post('/machines/bulk', { machines: batch }),
        201,
      );

      expect(result.created).toBe(3);
      // Returned in the order they were sent, because the operator reads it against their file.
      expect(result.machines.map((machine) => machine.serial)).toEqual(
        batch.map((row) => row.serial),
      );
    });

    it('rejects the whole batch when one row repeats another, naming both positions', async () => {
      const repeated = uniqueCode('SN');

      const error = await fails(
        director.post('/machines/bulk', {
          machines: [newMachine({ serial: repeated }), newMachine({ serial: repeated })],
        }),
        400,
        'VALIDATION_FAILED',
      );

      expect(hasFieldError(error, 'machines[1].serial')).toBe(true);
      expect(error.details?.[0].constraint).toContain('row 0');

      // Nothing was written: the first row must not survive its duplicate.
      await fails(director.get(`/machines/by-serial/${repeated}`), 404, 'MACHINE_NOT_FOUND');
    });

    it('rejects the whole batch when one row collides with a machine already on file', async () => {
      const existing = await createMachine();
      const fresh = newMachine();

      await fails(
        director.post('/machines/bulk', {
          machines: [fresh, newMachine({ serial: existing.serial })],
        }),
        409,
        'SERIAL_EXISTS',
      );

      await fails(
        director.get(`/machines/by-serial/${String(fresh.serial)}`),
        404,
        'MACHINE_NOT_FOUND',
      );
    });

    it('reports a per-row path for a validation problem inside the batch', async () => {
      const missingSim = newMachine();
      delete missingSim.simSerial;

      const error = await fails(
        director.post('/machines/bulk', { machines: [newMachine(), missingSim] }),
        400,
        'VALIDATION_FAILED',
      );

      expect(hasFieldError(error, 'machines[1].simSerial')).toBe(true);
    });
  });

  describe('lookup', () => {
    it('resolves each of the four serials and says which one it read', async () => {
      const machine = await createMachine({ boxSerial: uniqueCode('BX') });

      const cases: [string, LookupResponse['matchedOn']][] = [
        [machine.serial, 'MACHINE'],
        [machine.battery!.serial, 'BATTERY'],
        [machine.simSerial!, 'SIM'],
        [machine.boxSerial!, 'BOX'],
      ];

      for (const [code, matchedOn] of cases) {
        const result = await ok<LookupResponse>(director.get(`/machines/lookup?code=${code}`));

        expect(result.matchedOn).toBe(matchedOn);
        expect(result.machine.id).toBe(machine.id);
      }
    });

    it('prefers the machine serial when a code could match two columns', async () => {
      const shared = uniqueCode('SN');

      const owner = await createMachine({ serial: shared });
      await createMachine({ boxSerial: shared });

      const result = await ok<LookupResponse>(director.get(`/machines/lookup?code=${shared}`));

      expect(result.matchedOn).toBe('MACHINE');
      expect(result.machine.id).toBe(owner.id);
    });

    it('404s on an unknown code instead of returning an empty match', async () => {
      await fails(director.get('/machines/lookup?code=NOT_A_SERIAL'), 404, 'MACHINE_NOT_FOUND');
    });

    it('finds a machine by its printed serial', async () => {
      const machine = await createMachine();

      const found = await ok<MachineResponse>(
        director.get(`/machines/by-serial/${machine.serial}`),
      );

      expect(found.id).toBe(machine.id);
    });
  });

  describe('editing', () => {
    it('updates the fields that are allowed to change', async () => {
      const machine = await createMachine();

      const updated = await ok<MachineResponse>(
        director.patch(`/machines/${machine.id}`, {
          notes: 'وصلت من المصنع',
          purchasePrice: 3900,
          warrantyEnd: '2099-12-31',
        }),
      );

      expect(updated.notes).toBe('وصلت من المصنع');
      expect(updated.purchase.price).toBe(3900);
      expect(updated.warranty.end).toBe('2099-12-31');
    });

    it.each(['serial', 'simSerial', 'boxSerial'])(
      'refuses to edit %s and says which field it refused',
      async (field) => {
        const machine = await createMachine();

        const error = await fails(
          director.patch(`/machines/${machine.id}`, { [field]: 'SN_REWRITTEN' }),
          422,
          'SERIAL_IMMUTABLE',
        );

        expect(hasFieldError(error, field)).toBe(true);
      },
    );

    it('will not move a machine to a model of a different type', async () => {
      const machine = await createMachine();

      const error = await fails(
        director.patch(`/machines/${machine.id}`, { machineModelId: pinPadModelId }),
        400,
        'VALIDATION_FAILED',
      );

      expect(hasFieldError(error, 'machineModelId')).toBe(true);
    });

    it('404s on a machine that does not exist', async () => {
      await fails(
        director.patch(`/machines/${UNKNOWN_UUID}`, { notes: 'x' }),
        404,
        'MACHINE_NOT_FOUND',
      );
    });
  });

  describe('listing', () => {
    it('paginates and carries the total', async () => {
      await createMachine();

      const { items, meta } = await okPage<MachineResponse>(director.get('/machines?limit=2'));

      expect(items.length).toBeLessThanOrEqual(2);
      expect(meta.total).toBeGreaterThan(0);
      expect(meta.limit).toBe(2);
    });

    it('searches across all four serials', async () => {
      const machine = await createMachine({ boxSerial: uniqueCode('BX') });

      for (const code of [
        machine.serial,
        machine.battery!.serial,
        machine.simSerial!,
        machine.boxSerial!,
      ]) {
        const { items } = await okPage<MachineResponse>(director.get(`/machines?search=${code}`));

        expect(items.map((row) => row.id)).toContain(machine.id);
      }
    });

    it('filters by status', async () => {
      await createMachine();

      const { items } = await okPage<MachineResponse>(
        director.get(`/machines?status=${MachineStatus.IN_COMPANY_WAREHOUSE}`),
      );

      expect(items.every((row) => row.status === MachineStatus.IN_COMPANY_WAREHOUSE)).toBe(true);
    });

    it('filters by model', async () => {
      await createMachine();

      const { items } = await okPage<MachineResponse>(
        director.get(`/machines?machineModelId=${posModelId}`),
      );

      expect(items.every((row) => row.model.id === posModelId)).toBe(true);
    });

    it('finds the machines whose warranty runs out before a date', async () => {
      const expiring = await createMachine({
        warrantyStart: '2020-01-01',
        warrantyEnd: '2020-12-31',
      });

      const { items } = await okPage<MachineResponse>(
        director.get('/machines?warrantyExpiringBefore=2021-01-01&limit=100'),
      );

      expect(items.map((row) => row.id)).toContain(expiring.id);
      expect(items.every((row) => row.warranty.isActive)).toBe(false);
    });

    it('rejects a status that is not in the enum', async () => {
      await fails(director.get('/machines?status=NOT_A_STATUS'), 400, 'VALIDATION_FAILED');
    });
  });

  describe('permissions', () => {
    it('lets a branch supervisor read the fleet but not add to it', async () => {
      const branch = await createBranch(director, 'فرع المشرف');

      const supervisor = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
        branchId: branch.id,
      });

      await okPage<MachineResponse>(supervisor.api.get('/machines'));
      await fails(supervisor.api.post('/machines', newMachine()), 403, 'INSUFFICIENT_PERMISSIONS');
    });

    it('refuses a company-level reader who has neither a branch nor read-all', async () => {
      // The accountant holds `machines.read` for the finance screens but no `machines.read.all`,
      // and belongs to no branch — so there is no scope to pin the query to. Same rule the users
      // list applies to a Viewer.
      const accountant = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.ACCOUNTANT),
      });

      await fails(accountant.api.get('/machines'), 403, 'INSUFFICIENT_PERMISSIONS');
    });

    it('scopes a representative to their own branch', async () => {
      const branch = await createBranch(director, 'فرع الماكينات');

      const representative = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
        branchId: branch.id,
      });

      // Every machine created here is company-level, so a branch-scoped caller sees none of them
      // — and asking for another branch outright is refused rather than quietly widened.
      const { items } = await okPage<MachineResponse>(representative.api.get('/machines'));
      expect(items).toHaveLength(0);

      const company = await createMachine();
      await fails(representative.api.get(`/machines/${company.id}`), 404, 'MACHINE_NOT_FOUND');
    });

    it('turns down an anonymous caller', async () => {
      await fails(director.as(null).get('/machines'), 401, 'UNAUTHENTICATED');
    });
  });
});
