import { randomUUID } from 'node:crypto';
import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { WarehouseType } from 'src/common/enums/operations.enum';
import {
  ItemCondition,
  SignatureMethod,
  TransferStatus,
  TransferType,
} from 'src/common/enums/transfer.enum';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
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
  battery: { id: string; serial: string } | null;
  branch: { id: string; name: string } | null;
  holder: { type: string; id: string | null } | null;
}

interface TransferItemResponse {
  id: string;
  machine: { id: string; serial: string };
  batteryMatches: boolean | null;
  simMatches: boolean | null;
  boxMatches: boolean | null;
  hasCharger: boolean;
  hasBox: boolean;
  condition: ItemCondition;
}

interface TransferResponse {
  id: string;
  referenceNo: string;
  type: TransferType;
  status: TransferStatus;
  from: { type: string; id: string | null };
  to: { type: string; id: string | null };
  branch: { id: string; name: string } | null;
  itemsCount: number;
  items: TransferItemResponse[];
  signatures: { partyRole: string; method: string; payloadHash: string }[];
  violationsCount: number;
  rejectionReason: string | null;
  payloadHash: string;
}

interface MachineModelResponse {
  id: string;
  machineType: { id: string; requiresSim: boolean };
}

interface WarehouseResponse {
  id: string;
  type: WarehouseType;
  branchId: string | null;
}

interface CreatableTransferTypeResponse {
  type: TransferType;
  receiverKind: string;
  selfAttested: boolean;
  allowedFromStatuses: MachineStatus[];
}

interface TransferRecipientResponse {
  id: string;
  name: string;
  subtitle: string | null;
}

const DRAWN = { method: SignatureMethod.DRAWN_SIGNATURE, deviceModel: 'e2e' };

describe('Transfers (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;

  let branchId: string;
  let supervisor: ProvisionedUser;
  let representative: ProvisionedUser;

  let companyWarehouseId: string;
  let scrapWarehouseId: string;
  let posModelId: string;

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);

    const branch = await createBranch(director, 'فرع التسليمات');
    branchId = branch.id;

    supervisor = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
      branchId,
      fullName: 'مشرف التسليمات',
    });

    representative = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
      branchId,
      fullName: 'مندوب التسليمات',
    });

    const warehouses = await ok<WarehouseResponse[]>(director.get('/warehouses'));
    companyWarehouseId = warehouses.find((w) => w.type === WarehouseType.COMPANY_MAIN)!.id;
    scrapWarehouseId = warehouses.find((w) => w.type === WarehouseType.SCRAP)!.id;

    const models = await ok<MachineModelResponse[]>(director.get('/machine-models'));
    posModelId = models.find((model) => model.machineType.requiresSim)!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── fixtures ───────────────────────────────────────────────────────────────

  let serialCounter = 0;

  async function createMachine(): Promise<MachineResponse> {
    serialCounter += 1;
    const tag = `${uniqueCode('T')}_${serialCounter}`;

    return ok<MachineResponse>(
      director.post('/machines', {
        serial: `SN-${tag}`,
        machineModelId: posModelId,
        simSerial: `SIM-${tag}`,
        boxSerial: `BX-${tag}`,
        battery: { serial: `BT-${tag}` },
        hasBox: true,
      }),
      201,
    );
  }

  function itemFor(
    machine: MachineResponse,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      machineId: machine.id,
      batterySerialScanned: machine.battery!.serial,
      hasCharger: true,
      hasBox: true,
      condition: ItemCondition.GOOD,
      ...overrides,
    };
  }

  /** Company warehouse → the branch supervisor, signed for. The first leg of every journey. */
  async function deliverToSupervisor(machine: MachineResponse): Promise<TransferResponse> {
    const created = await ok<TransferResponse>(
      director.post('/transfers', {
        clientUuid: randomUUID(),
        type: TransferType.COMPANY_TO_BRANCH,
        toPartyId: supervisor.id,
        occurredAt: new Date().toISOString(),
        items: [itemFor(machine)],
      }),
      201,
    );

    return ok<TransferResponse>(
      supervisor.api.post(`/transfers/${created.id}/confirm`, {
        signature: DRAWN,
        payloadHash: created.payloadHash,
      }),
    );
  }

  /** …and on to the representative, so the rep-side rules have something to act on. */
  async function deliverToRepresentative(machine: MachineResponse): Promise<TransferResponse> {
    await deliverToSupervisor(machine);

    const created = await ok<TransferResponse>(
      supervisor.api.post('/transfers', {
        clientUuid: randomUUID(),
        type: TransferType.BRANCH_TO_REPRESENTATIVE,
        toPartyId: representative.id,
        occurredAt: new Date().toISOString(),
        items: [itemFor(machine)],
      }),
      201,
    );

    return ok<TransferResponse>(
      representative.api.post(`/transfers/${created.id}/confirm`, {
        signature: DRAWN,
        payloadHash: created.payloadHash,
      }),
    );
  }

  function readMachine(machineId: string): Promise<MachineResponse> {
    return ok<MachineResponse>(director.get(`/machines/${machineId}`));
  }

  // ── the happy path ─────────────────────────────────────────────────────────

  describe('the full journey', () => {
    /**
     * The acceptance criterion from the plan: a machine travels company → branch → rep → merchant
     * → rep → branch → company with a signature at every step, and lands back where it started.
     */
    it('carries a machine all the way out and all the way home', async () => {
      const machine = await createMachine();
      // Registered by the representative himself: the merchant carries his branch, and the
      // transfer engine refuses to hand a machine to a shop that is not on the books.
      const merchantId = (await createMerchant(representative.api)).id;

      await deliverToRepresentative(machine);
      expect((await readMachine(machine.id)).status).toBe(MachineStatus.WITH_REPRESENTATIVE);

      // The merchant has no account, so this leg self-attests and confirms in one request.
      const toMerchant = await ok<TransferResponse>(
        representative.api.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.REPRESENTATIVE_TO_MERCHANT,
          toPartyId: merchantId,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
          senderSignature: DRAWN,
        }),
        201,
      );

      expect(toMerchant.status).toBe(TransferStatus.CONFIRMED);
      expect(toMerchant.signatures).toHaveLength(1);
      expect((await readMachine(machine.id)).status).toBe(MachineStatus.WITH_MERCHANT);

      const fromMerchant = await ok<TransferResponse>(
        representative.api.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.MERCHANT_TO_REPRESENTATIVE,
          toPartyId: representative.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
          senderSignature: DRAWN,
        }),
        201,
      );

      expect(fromMerchant.status).toBe(TransferStatus.CONFIRMED);
      expect(fromMerchant.signatures[0].partyRole).toBe('RECEIVER');
      expect((await readMachine(machine.id)).status).toBe(MachineStatus.WITH_REPRESENTATIVE);

      const toBranch = await ok<TransferResponse>(
        representative.api.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.REPRESENTATIVE_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        201,
      );

      await ok<TransferResponse>(
        supervisor.api.post(`/transfers/${toBranch.id}/confirm`, {
          signature: DRAWN,
          payloadHash: toBranch.payloadHash,
        }),
      );
      expect((await readMachine(machine.id)).status).toBe(MachineStatus.IN_BRANCH_WAREHOUSE);

      const toCompany = await ok<TransferResponse>(
        supervisor.api.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.BRANCH_TO_COMPANY,
          toPartyId: companyWarehouseId,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        201,
      );

      const home = await ok<TransferResponse>(
        director.post(`/transfers/${toCompany.id}/confirm`, {
          signature: DRAWN,
          payloadHash: toCompany.payloadHash,
        }),
      );

      expect(home.status).toBe(TransferStatus.CONFIRMED);

      const finalState = await readMachine(machine.id);
      expect(finalState.status).toBe(MachineStatus.IN_COMPANY_WAREHOUSE);
      expect(finalState.holder).toMatchObject({ type: 'WAREHOUSE', id: companyWarehouseId });
    });

    it('puts the machine in transit and out of everyone’s hands until it is signed for', async () => {
      const machine = await createMachine();

      await ok<TransferResponse>(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        201,
      );

      expect((await readMachine(machine.id)).status).toBe(MachineStatus.IN_TRANSIT);
    });

    it('generates a sequential, human-readable reference number', async () => {
      const machine = await createMachine();
      const transfer = await deliverToSupervisor(machine);

      expect(transfer.referenceNo).toMatch(/^TRF-\d{4}-\d{6}$/);
    });
  });

  // ── the rules that make custody trustworthy ────────────────────────────────

  describe('custody rules', () => {
    it('refuses a machine that is not in your custody', async () => {
      const machine = await createMachine();
      await deliverToSupervisor(machine);

      // The supervisor holds it; the representative claims to be sending it onwards.
      await fails(
        representative.api.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.REPRESENTATIVE_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        422,
        'INVALID_MACHINE_STATUS',
      );
    });

    it('refuses a machine whose status does not allow the move', async () => {
      const machine = await createMachine();

      await fails(
        supervisor.api.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.BRANCH_TO_REPRESENTATIVE,
          toPartyId: representative.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        422,
        'INVALID_MACHINE_STATUS',
      );
    });

    /** The double-dispatch guard: the second request loses, and says which serial it lost on. */
    it('refuses a second transfer for a machine already in transit', async () => {
      const machine = await createMachine();

      await ok(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        201,
      );

      const error = await fails(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        409,
        'MACHINE_ALREADY_IN_TRANSIT',
      );

      expect(error.message).toContain(machine.serial);
    });

    /**
     * Two phones dispatching the same machine at the same instant. Exactly one may win — this is
     * the test the plan says everything downstream depends on.
     */
    it('serializes concurrent dispatches of the same machine', async () => {
      const machine = await createMachine();

      const attempts = Array.from({ length: 5 }, () =>
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
      );

      const results = await Promise.allSettled(attempts);
      const statuses = results.map((result) =>
        result.status === 'fulfilled' ? result.value.status : 0,
      );

      expect(statuses.filter((status) => status === 201)).toHaveLength(1);
      expect(statuses.filter((status) => status !== 201)).toHaveLength(4);
      expect((await readMachine(machine.id)).status).toBe(MachineStatus.IN_TRANSIT);
    });

    it('rejects a direct branch-to-branch hand-off', async () => {
      const machine = await createMachine();
      await deliverToSupervisor(machine);

      const otherBranch = await createBranch(director, 'فرع آخر');
      const otherSupervisor = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
        branchId: otherBranch.id,
      });

      // There is no branch-to-branch type at all, so the attempt has to be dressed up as a
      // hand-off to a representative — and the same-branch rule is what stops it.
      await fails(
        supervisor.api.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.BRANCH_TO_REPRESENTATIVE,
          toPartyId: otherSupervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        422,
        'INVALID_TRANSFER_TYPE',
      );
    });

    it('stops a representative inventing a company-warehouse dispatch', async () => {
      const machine = await createMachine();

      await fails(
        representative.api.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        403,
        'INVALID_TRANSFER_TYPE',
      );
    });

    it('refuses a retired machine', async () => {
      const machine = await createMachine();

      await ok(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_SCRAP,
          toPartyId: scrapWarehouseId,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
          senderSignature: DRAWN,
        }),
        201,
      );

      expect((await readMachine(machine.id)).status).toBe(MachineStatus.DECOMMISSIONED);

      await fails(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        422,
        'MACHINE_RETIRED',
      );
    });

    it('refuses the same machine listed twice in one transfer', async () => {
      const machine = await createMachine();

      await fails(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine), itemFor(machine)],
        }),
        400,
        'VALIDATION_FAILED',
      );
    });
  });

  // ── signing ────────────────────────────────────────────────────────────────

  describe('confirmation', () => {
    it('refuses a stale payload hash so nobody signs a document they did not read', async () => {
      const machine = await createMachine();

      const created = await ok<TransferResponse>(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        201,
      );

      await fails(
        supervisor.api.post(`/transfers/${created.id}/confirm`, {
          signature: DRAWN,
          payloadHash: 'a'.repeat(64),
        }),
        409,
        'PAYLOAD_CHANGED',
      );

      expect((await readMachine(machine.id)).status).toBe(MachineStatus.IN_TRANSIT);
    });

    it('lets nobody but the addressed receiver sign', async () => {
      const machine = await createMachine();

      const created = await ok<TransferResponse>(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        201,
      );

      await fails(
        representative.api.post(`/transfers/${created.id}/confirm`, {
          signature: DRAWN,
          payloadHash: created.payloadHash,
        }),
        403,
        'NOT_THE_RECEIVER',
      );
    });

    /**
     * The receiver's word wins. He says the battery is a different one, and the mismatch is
     * recorded against the delivery rather than argued about — the delivery is still accepted.
     */
    it('accepts the receiver’s corrections and records the mismatch they reveal', async () => {
      const machine = await createMachine();
      await deliverToSupervisor(machine);

      const created = await ok<TransferResponse>(
        supervisor.api.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.BRANCH_TO_REPRESENTATIVE,
          toPartyId: representative.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        201,
      );

      const confirmed = await ok<TransferResponse>(
        representative.api.post(`/transfers/${created.id}/confirm`, {
          signature: DRAWN,
          payloadHash: created.payloadHash,
          adjustments: [
            {
              transferItemId: created.items[0].id,
              batterySerialScanned: 'BT-SOMEONE-ELSES',
              hasCharger: false,
            },
          ],
        }),
      );

      expect(confirmed.status).toBe(TransferStatus.CONFIRMED);
      expect(confirmed.items[0].batteryMatches).toBe(false);
      expect(confirmed.items[0].hasCharger).toBe(false);
      expect(confirmed.violationsCount).toBe(1);
    });

    /** A serial nobody scanned is not a mismatch, and must not be filed as one. */
    it('leaves an unscanned serial as unknown rather than failed', async () => {
      const machine = await createMachine();

      const created = await ok<TransferResponse>(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine, { batterySerialScanned: undefined })],
        }),
        201,
      );

      expect(created.items[0].batteryMatches).toBeNull();
      expect(created.items[0].simMatches).toBeNull();
      expect(created.violationsCount).toBe(0);
    });

    it('records the signature against the hash that was actually signed', async () => {
      const machine = await createMachine();
      const confirmed = await deliverToSupervisor(machine);

      expect(confirmed.signatures).toHaveLength(1);
      expect(confirmed.signatures[0].partyRole).toBe('RECEIVER');
      expect(confirmed.signatures[0].payloadHash).toBe(confirmed.payloadHash);
    });

    it('will not confirm a transfer twice', async () => {
      const machine = await createMachine();
      const confirmed = await deliverToSupervisor(machine);

      await fails(
        supervisor.api.post(`/transfers/${confirmed.id}/confirm`, {
          signature: DRAWN,
          payloadHash: confirmed.payloadHash,
        }),
        422,
        'TRANSFER_NOT_PENDING',
      );
    });
  });

  // ── rejection and cancellation ─────────────────────────────────────────────

  describe('rejection', () => {
    it('restores the exact status each machine had before it left', async () => {
      const inCompany = await createMachine();
      const withSupervisor = await createMachine();
      await deliverToSupervisor(withSupervisor);

      // Two machines with genuinely different prior statuses, so a rollback that merely guesses
      // from the transfer type would put one of them back wrong.
      const created = await ok<TransferResponse>(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(inCompany)],
        }),
        201,
      );

      const rejected = await ok<TransferResponse>(
        supervisor.api.post(`/transfers/${created.id}/reject`, {
          reason: 'الشحنة لم تصل',
        }),
      );

      expect(rejected.status).toBe(TransferStatus.REJECTED);
      expect(rejected.rejectionReason).toBe('الشحنة لم تصل');
      expect((await readMachine(inCompany.id)).status).toBe(MachineStatus.IN_COMPANY_WAREHOUSE);
      expect((await readMachine(withSupervisor.id)).status).toBe(MachineStatus.IN_BRANCH_WAREHOUSE);
    });

    it('frees the machine for a new transfer', async () => {
      const machine = await createMachine();

      const created = await ok<TransferResponse>(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        201,
      );

      await ok(supervisor.api.post(`/transfers/${created.id}/reject`, { reason: 'خطأ' }));

      await ok(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        201,
      );
    });
  });

  describe('cancellation', () => {
    it('lets the sender withdraw a pending transfer and rolls the machines back', async () => {
      const machine = await createMachine();

      const created = await ok<TransferResponse>(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        201,
      );

      const cancelled = await ok<TransferResponse>(
        director.post(`/transfers/${created.id}/cancel`, { reason: 'تأجيل الشحنة' }),
      );

      expect(cancelled.status).toBe(TransferStatus.CANCELLED);
      expect((await readMachine(machine.id)).status).toBe(MachineStatus.IN_COMPANY_WAREHOUSE);
    });

    it('will not let the receiver cancel what he was asked to sign for', async () => {
      const machine = await createMachine();

      const created = await ok<TransferResponse>(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        201,
      );

      await fails(
        supervisor.api.post(`/transfers/${created.id}/cancel`, {}),
        403,
        'NOT_THE_SENDER',
      );
    });
  });

  // ── offline behaviour ──────────────────────────────────────────────────────

  describe('offline replay', () => {
    /**
     * A device on a bad connection retries what it could not confirm was received. That is the
     * normal case, not an error, and it must not dispatch the machine twice.
     */
    it('returns the original transfer when the same clientUuid is replayed', async () => {
      const machine = await createMachine();
      const clientUuid = randomUUID();

      const body = {
        clientUuid,
        type: TransferType.COMPANY_TO_BRANCH,
        toPartyId: supervisor.id,
        occurredAt: new Date().toISOString(),
        items: [itemFor(machine)],
      };

      const first = await ok<TransferResponse>(director.post('/transfers', body), 201);
      const replay = await ok<TransferResponse>(director.post('/transfers', body), 201);
      const thirdTime = await ok<TransferResponse>(director.post('/transfers', body), 201);

      expect(replay.id).toBe(first.id);
      expect(thirdTime.id).toBe(first.id);

      const page = await okPage<TransferResponse>(
        director.get(`/transfers?machineId=${machine.id}`),
      );
      expect(page.meta.total).toBe(1);
    });
  });

  // ── reading ────────────────────────────────────────────────────────────────

  describe('listing and scoping', () => {
    it('shows a receiver their inbox and a sender their outbox', async () => {
      const machine = await createMachine();

      const created = await ok<TransferResponse>(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
        201,
      );

      const inbox = await okPage<TransferResponse>(
        supervisor.api.get('/transfers/pending/incoming'),
      );
      expect(inbox.items.map((item) => item.id)).toContain(created.id);

      const outbox = await okPage<TransferResponse>(director.get('/transfers/pending/outgoing'));
      expect(outbox.items.map((item) => item.id)).toContain(created.id);

      // …and the representative's inbox is not the supervisor's.
      const otherInbox = await okPage<TransferResponse>(
        representative.api.get('/transfers/pending/incoming'),
      );
      expect(otherInbox.items.map((item) => item.id)).not.toContain(created.id);
    });

    it('filters by status and by the machine involved', async () => {
      const machine = await createMachine();
      const confirmed = await deliverToSupervisor(machine);

      const page = await okPage<TransferResponse>(
        director.get(`/transfers?machineId=${machine.id}&status=CONFIRMED`),
      );

      expect(page.items).toHaveLength(1);
      expect(page.items[0].id).toBe(confirmed.id);
    });

    it('reports mismatches through the hasViolations filter', async () => {
      const machine = await createMachine();
      await deliverToSupervisor(machine);

      const created = await ok<TransferResponse>(
        supervisor.api.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.BRANCH_TO_REPRESENTATIVE,
          toPartyId: representative.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine, { batterySerialScanned: 'BT-WRONG-ONE' })],
        }),
        201,
      );

      const page = await okPage<TransferResponse>(
        director.get(`/transfers?machineId=${machine.id}&hasViolations=true`),
      );

      expect(page.items.map((item) => item.id)).toContain(created.id);
    });

    it('hides another branch’s traffic from a branch-scoped reader', async () => {
      const machine = await createMachine();
      const mine = await deliverToSupervisor(machine);

      const otherBranch = await createBranch(director, 'فرع بعيد');
      const outsider = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
        branchId: otherBranch.id,
      });

      await fails(outsider.api.get(`/transfers/${mine.id}`), 404, 'TRANSFER_NOT_FOUND');
    });
  });

  // ── dry run ────────────────────────────────────────────────────────────────

  describe('validate', () => {
    it('reports a blocked machine without writing anything', async () => {
      const machine = await createMachine();
      await deliverToSupervisor(machine);

      const result = await ok<{ valid: boolean; problems: unknown[] }>(
        director.post('/transfers/validate', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
      );

      expect(result.valid).toBe(false);
      expect((await readMachine(machine.id)).status).toBe(MachineStatus.IN_BRANCH_WAREHOUSE);
    });

    it('green-lights a legal move and still writes nothing', async () => {
      const machine = await createMachine();

      const result = await ok<{ valid: boolean }>(
        director.post('/transfers/validate', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [itemFor(machine)],
        }),
      );

      expect(result.valid).toBe(true);
      expect((await readMachine(machine.id)).status).toBe(MachineStatus.IN_COMPANY_WAREHOUSE);

      const page = await okPage<TransferResponse>(
        director.get(`/transfers?machineId=${machine.id}`),
      );
      expect(page.meta.total).toBe(0);
    });
  });

  describe('what the client may offer', () => {
    it('offers each role only the moves it can actually make', async () => {
      const forDirector = await ok<CreatableTransferTypeResponse[]>(
        director.get('/transfers/creatable-types'),
      );
      const forSupervisor = await ok<CreatableTransferTypeResponse[]>(
        supervisor.api.get('/transfers/creatable-types'),
      );
      const forRepresentative = await ok<CreatableTransferTypeResponse[]>(
        representative.api.get('/transfers/creatable-types'),
      );

      const types = (list: CreatableTransferTypeResponse[]): TransferType[] =>
        list.map((entry) => entry.type);

      expect(types(forDirector)).toContain(TransferType.COMPANY_TO_BRANCH);
      expect(types(forSupervisor)).not.toContain(TransferType.COMPANY_TO_BRANCH);

      expect(types(forSupervisor)).toContain(TransferType.BRANCH_TO_REPRESENTATIVE);
      expect(types(forRepresentative)).not.toContain(TransferType.BRANCH_TO_REPRESENTATIVE);

      // The merchant has no login, so the representative books the return leg in.
      expect(types(forRepresentative)).toContain(TransferType.MERCHANT_TO_REPRESENTATIVE);

      // There is no branch-to-branch and no rep-to-rep move anywhere in the graph.
      expect(types(forSupervisor)).not.toContain(TransferType.REPRESENTATIVE_TO_BRANCH);
    });

    it('tells the client what kind of receiver to ask for', async () => {
      const options = await ok<CreatableTransferTypeResponse[]>(
        director.get('/transfers/creatable-types'),
      );

      const byType = (type: TransferType): CreatableTransferTypeResponse =>
        options.find((entry) => entry.type === type)!;

      expect(byType(TransferType.COMPANY_TO_BRANCH).receiverKind).toBe('USER');
      expect(byType(TransferType.COMPANY_TO_SCRAP).receiverKind).toBe('WAREHOUSE');
      // Nobody to pick: the factory is not a record.
      expect(byType(TransferType.COMPANY_TO_FACTORY).receiverKind).toBe('NONE');

      expect(byType(TransferType.COMPANY_TO_FACTORY).selfAttested).toBe(true);
      expect(byType(TransferType.COMPANY_TO_BRANCH).selfAttested).toBe(false);

      expect(byType(TransferType.COMPANY_TO_BRANCH).allowedFromStatuses).toEqual([
        MachineStatus.IN_COMPANY_WAREHOUSE,
      ]);
    });

    it('builds a picker for a representative who cannot read the user directory', async () => {
      // This is the whole reason the endpoint exists: `GET /users` is 403 for him, and he still
      // has to be able to choose which supervisor he is handing the machines back to.
      await representative.api.get('/users').expect(403);

      const recipients = await ok<TransferRecipientResponse[]>(
        representative.api.get(
          `/transfers/recipients?type=${TransferType.REPRESENTATIVE_TO_BRANCH}`,
        ),
      );

      expect(recipients.map((entry) => entry.id)).toContain(supervisor.id);
    });

    it('keeps the picker inside the branch, matching what create would allow', async () => {
      const otherBranch = await createBranch(director, 'فرع المستلمين');
      const otherSupervisor = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
        branchId: otherBranch.id,
        fullName: 'مشرف فرع تاني',
      });

      const recipients = await ok<TransferRecipientResponse[]>(
        representative.api.get(
          `/transfers/recipients?type=${TransferType.REPRESENTATIVE_TO_BRANCH}`,
        ),
      );

      // Offering him would only produce INTER_BRANCH_DIRECT_TRANSFER_NOT_ALLOWED on submit.
      expect(recipients.map((entry) => entry.id)).not.toContain(otherSupervisor.id);
    });

    it('returns nobody for a type whose receiver is not an account', async () => {
      const recipients = await ok<TransferRecipientResponse[]>(
        director.get(`/transfers/recipients?type=${TransferType.COMPANY_TO_FACTORY}`),
      );

      expect(recipients).toEqual([]);
    });

    it('offers warehouses when the receiver is a place', async () => {
      const recipients = await ok<TransferRecipientResponse[]>(
        director.get(`/transfers/recipients?type=${TransferType.COMPANY_TO_SCRAP}`),
      );

      expect(recipients.map((entry) => entry.id)).toContain(scrapWarehouseId);
    });

    it('offers nothing to a role that holds no custody', async () => {
      const accountant = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.ACCOUNTANT),
        fullName: 'محاسب بدون عهدة',
      });

      await accountant.api.get('/transfers/creatable-types').expect(403);
    });
  });
});
