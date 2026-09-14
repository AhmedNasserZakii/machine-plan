import { createHash, randomUUID } from 'node:crypto';
import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { MediaPurpose } from 'src/common/enums/operations.enum';
import { SyncOperationStatus, SyncOperationType, SyncResolution } from 'src/common/enums/sync.enum';
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
  uniquePhone,
} from './utils/fixtures';
import { createTestApp } from './utils/test-app';

interface MachineResponse {
  id: string;
  serial: string;
  status: MachineStatus;
  battery: { id: string; serial: string } | null;
  holder: { type: string; id: string | null } | null;
}

interface TransferResponse {
  id: string;
  referenceNo: string;
  status: TransferStatus;
  items: { machine: { id: string }; photos: { mediaId: string }[] }[];
  payloadHash: string;
}

interface MachineModelResponse {
  id: string;
  machineType: { id: string; requiresSim: boolean };
}

interface MerchantResponse {
  id: string;
  name: string;
  shopName: string;
}

interface PresignResponse {
  mediaId: string;
  uploadUrl: string;
}

interface SyncStatusResponse {
  serverTime: string;
  schemaVersion: number;
}

interface BootstrapResponse extends SyncStatusResponse {
  lookups: {
    machineTypes: { id: string; name: string }[];
    machineModels: { id: string }[];
    paymentMethods: { id: string }[];
    violationTypes: { id: string }[];
    maintenanceLocations: { id: string }[];
    decommissionReasons: { id: string }[];
    financeCategories: { id: string; kind: string }[];
    branches: { id: string }[];
  };
  myMachines: { id: string; serial: string }[];
  myMerchants: { id: string }[];
  pendingTransfers: TransferResponse[];
  permissions: string[];
  truncated: { myMachines: boolean; myMerchants: boolean };
}

interface DeltaResponse extends BootstrapResponse {
  deleted: { machines: string[]; merchants: string[]; transfers: string[] };
  nextSince: string;
  hasMore: boolean;
}

interface OperationResult {
  clientUuid: string;
  type: SyncOperationType;
  status: SyncOperationStatus;
  serverId: string | null;
  error?: { code: string; message: string };
  resolution?: SyncResolution;
  serverState?: Record<string, unknown>;
}

interface BatchResponse {
  results: OperationResult[];
  serverTime: string;
}

const DRAWN = { method: SignatureMethod.DRAWN_SIGNATURE, deviceModel: 'e2e' };

/** Header bytes are what the content check reads; the rest of a real photo is noise here. */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 0x20)]);

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Offline sync (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;

  let branchId: string;
  let supervisor: ProvisionedUser;
  let representative: ProvisionedUser;

  let posModelId: string;

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);

    const branch = await createBranch(director, 'فرع المزامنة');
    branchId = branch.id;

    supervisor = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
      branchId,
      fullName: 'مشرف المزامنة',
    });

    representative = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
      branchId,
      fullName: 'مندوب المزامنة',
    });

    const models = await ok<MachineModelResponse[]>(director.get('/machine-models?limit=100'));
    posModelId = models.find((model) => model.machineType.requiresSim)!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── fixtures ───────────────────────────────────────────────────────────────

  let serialCounter = 0;

  async function createMachine(): Promise<MachineResponse> {
    serialCounter += 1;
    const tag = `${uniqueCode('S')}_${serialCounter}`;

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

  function itemFor(machine: MachineResponse, overrides: Record<string, unknown> = {}): unknown {
    return {
      machineId: machine.id,
      batterySerialScanned: machine.battery!.serial,
      hasCharger: true,
      hasBox: true,
      condition: ItemCondition.GOOD,
      ...overrides,
    };
  }

  /** Leaves the transfer unsigned, which is what puts it in the supervisor's offline inbox. */
  async function sendToSupervisor(machine: MachineResponse): Promise<TransferResponse> {
    return ok<TransferResponse>(
      director.post('/transfers', {
        clientUuid: randomUUID(),
        type: TransferType.COMPANY_TO_BRANCH,
        toPartyId: supervisor.id,
        occurredAt: new Date().toISOString(),
        items: [itemFor(machine)],
      }),
      201,
    );
  }

  async function deliverToSupervisor(machine: MachineResponse): Promise<TransferResponse> {
    const created = await sendToSupervisor(machine);

    return ok<TransferResponse>(
      supervisor.api.post(`/transfers/${created.id}/confirm`, {
        signature: DRAWN,
        payloadHash: created.payloadHash,
      }),
    );
  }

  async function deliverToRepresentative(machine: MachineResponse): Promise<void> {
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

    await ok<TransferResponse>(
      representative.api.post(`/transfers/${created.id}/confirm`, {
        signature: DRAWN,
        payloadHash: created.payloadHash,
      }),
    );
  }

  function readMachine(machineId: string): Promise<MachineResponse> {
    return ok<MachineResponse>(director.get(`/machines/${machineId}`));
  }

  /** How many transfers exist for a machine — the only honest way to prove a replay wrote once. */
  async function transferCount(machineId: string): Promise<number> {
    const { meta } = await okPage<TransferResponse>(
      director.get(`/transfers?machineId=${machineId}`),
    );
    return meta.total;
  }

  function serverTime(): Promise<SyncStatusResponse> {
    return ok<SyncStatusResponse>(director.get('/sync/status'));
  }

  function merchantPayload(name: string): Record<string, unknown> {
    return {
      name,
      phone: uniquePhone(),
      shopName: `محل ${name}`,
      address: 'شارع المزامنة، القاهرة',
    };
  }

  /**
   * A photo taken offline: reserved under the id the device generated, uploaded, confirmed. The
   * `clientUuid` is what a queued operation can reference, since the real id did not exist when
   * the camera shutter closed.
   */
  async function uploadPhoto(uploader: Api, clientUuid: string): Promise<string> {
    const reserved = await ok<PresignResponse>(
      uploader.post('/media/presign', {
        purpose: MediaPurpose.TRANSFER_PHOTO,
        mimeType: 'image/jpeg',
        sizeBytes: JPEG.byteLength,
        checksum: createHash('sha256').update(JPEG).digest('hex'),
        clientUuid,
      }),
      201,
    );

    await request(server)
      .put(reserved.uploadUrl.slice(reserved.uploadUrl.indexOf('/api/')))
      .set('Content-Type', 'image/jpeg')
      .send(JPEG)
      .expect(200);

    await ok(uploader.post('/media/confirm', { mediaId: reserved.mediaId }));

    return reserved.mediaId;
  }

  function batch(api: Api, operations: unknown[]): Promise<BatchResponse> {
    return ok<BatchResponse>(api.post('/sync/batch', { operations }));
  }

  // ── GET /sync/status ───────────────────────────────────────────────────────

  describe('GET /sync/status', () => {
    it('answers with the server clock and the shape version the client must match', async () => {
      const status = await serverTime();

      expect(Date.parse(status.serverTime)).not.toBeNaN();
      expect(status.schemaVersion).toBeGreaterThanOrEqual(1);
    });

    it('refuses an anonymous caller', async () => {
      await fails(director.as(null).get('/sync/status'), 401, 'UNAUTHENTICATED');
    });
  });

  // ── GET /sync/bootstrap ────────────────────────────────────────────────────

  describe('GET /sync/bootstrap', () => {
    it('hands the Director every reference table the app renders from', async () => {
      const boot = await ok<BootstrapResponse>(director.get('/sync/bootstrap'));

      expect(boot.lookups.machineTypes.length).toBeGreaterThan(0);
      expect(boot.lookups.machineModels.length).toBeGreaterThan(0);
      expect(boot.lookups.paymentMethods.length).toBeGreaterThan(0);
      expect(boot.lookups.violationTypes.length).toBeGreaterThan(0);
      expect(boot.lookups.maintenanceLocations.length).toBeGreaterThan(0);
      expect(boot.lookups.decommissionReasons.length).toBeGreaterThan(0);
      expect(boot.lookups.financeCategories.length).toBeGreaterThan(0);
      expect(boot.lookups.branches.some((branch) => branch.id === branchId)).toBe(true);
      expect(boot.permissions).toContain('transfers.create');
      expect(boot.truncated.myMachines).toBe(false);
      expect(boot.myMerchants.length).toBeLessThanOrEqual(500);
      expect(typeof boot.truncated.myMerchants).toBe('boolean');
    });

    it('gives a representative the machines in his hands and the shops he registered', async () => {
      const machine = await createMachine();
      await deliverToRepresentative(machine);
      const merchant = await createMerchant(representative.api, 'تاجر المزامنة');

      const boot = await ok<BootstrapResponse>(representative.api.get('/sync/bootstrap'));

      expect(boot.myMachines.map((row) => row.id)).toContain(machine.id);
      expect(boot.myMerchants.map((row) => row.id)).toContain(merchant.id);
    });

    it('withholds the money tables from someone without finance.read, rather than failing', async () => {
      const boot = await ok<BootstrapResponse>(representative.api.get('/sync/bootstrap'));

      expect(boot.permissions).not.toContain('finance.read');
      expect(boot.lookups.financeCategories).toEqual([]);
      expect(boot.lookups.paymentMethods).toEqual([]);
      // The tables he does need are still there — a sync must not be all-or-nothing.
      expect(boot.lookups.machineTypes.length).toBeGreaterThan(0);
    });

    it('carries a pending transfer in full, so it can be checked and signed with no signal', async () => {
      const machine = await createMachine();
      const pending = await sendToSupervisor(machine);

      const boot = await ok<BootstrapResponse>(supervisor.api.get('/sync/bootstrap'));
      const inbox = boot.pendingTransfers.find((transfer) => transfer.id === pending.id);

      expect(inbox).toBeDefined();
      expect(inbox!.items).toHaveLength(1);
      expect(inbox!.items[0].machine.id).toBe(machine.id);
      // The hash is what the signature is taken over; without it the device cannot sign offline.
      expect(inbox!.payloadHash).toBe(pending.payloadHash);
    });

    it('does not offer a transfer that is waiting for somebody else', async () => {
      const machine = await createMachine();
      const pending = await sendToSupervisor(machine);

      const boot = await ok<BootstrapResponse>(representative.api.get('/sync/bootstrap'));

      expect(boot.pendingTransfers.map((transfer) => transfer.id)).not.toContain(pending.id);
    });
  });

  // ── GET /sync/delta ────────────────────────────────────────────────────────

  describe('GET /sync/delta', () => {
    it('returns only what changed after the cursor', async () => {
      const older = await createMachine();
      await deliverToRepresentative(older);

      const cursor = (await serverTime()).serverTime;

      const newer = await createMachine();
      await deliverToRepresentative(newer);

      const delta = await ok<DeltaResponse>(
        representative.api.get(`/sync/delta?since=${encodeURIComponent(cursor)}`),
      );

      const ids = delta.myMachines.map((row) => row.id);
      expect(ids).toContain(newer.id);
      expect(ids).not.toContain(older.id);
    });

    it('hands back a cursor for the next call', async () => {
      const before = (await serverTime()).serverTime;

      const delta = await ok<DeltaResponse>(
        representative.api.get(`/sync/delta?since=${encodeURIComponent(before)}`),
      );

      expect(Date.parse(delta.nextSince)).toBeGreaterThanOrEqual(Date.parse(before));
      expect(delta.hasMore).toBe(false);

      const nothingSince = await ok<DeltaResponse>(
        representative.api.get(`/sync/delta?since=${encodeURIComponent(delta.nextSince)}`),
      );
      expect(nothingSince.myMachines).toEqual([]);
      expect(nothingSince.hasMore).toBe(false);
    });

    it('sets hasMore when a collection hits the cap, and not when it does not', async () => {
      const cursor = (await serverTime()).serverTime;
      const first = await createMachine();
      await deliverToRepresentative(first);
      const second = await createMachine();
      await deliverToRepresentative(second);

      const capped = await ok<DeltaResponse>(
        representative.api.get(`/sync/delta?since=${encodeURIComponent(cursor)}&limit=1`),
      );
      expect(capped.myMachines).toHaveLength(1);
      expect(capped.hasMore).toBe(true);

      const full = await ok<DeltaResponse>(
        representative.api.get(`/sync/delta?since=${encodeURIComponent(cursor)}&limit=10`),
      );
      expect(full.myMachines.map((row) => row.id).sort()).toEqual([first.id, second.id].sort());
      expect(full.hasMore).toBe(false);
    });

    it('names the machine that left the caller’s custody so the device can drop it', async () => {
      const machine = await createMachine();
      await deliverToRepresentative(machine);

      const cursor = (await serverTime()).serverTime;

      const merchantId = (await createMerchant(representative.api, 'تاجر التسليم')).id;
      await ok<TransferResponse>(
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

      const delta = await ok<DeltaResponse>(
        representative.api.get(`/sync/delta?since=${encodeURIComponent(cursor)}`),
      );

      expect(delta.deleted.machines).toContain(machine.id);
      expect(delta.myMachines.map((row) => row.id)).not.toContain(machine.id);
    });

    it('names the transfer that no longer needs a signature', async () => {
      const machine = await createMachine();
      const pending = await sendToSupervisor(machine);

      const cursor = (await serverTime()).serverTime;

      await ok<TransferResponse>(
        supervisor.api.post(`/transfers/${pending.id}/confirm`, {
          signature: DRAWN,
          payloadHash: pending.payloadHash,
        }),
      );

      const delta = await ok<DeltaResponse>(
        supervisor.api.get(`/sync/delta?since=${encodeURIComponent(cursor)}`),
      );

      expect(delta.deleted.transfers).toContain(pending.id);
    });

    it('refuses a cursor that is not a timestamp', async () => {
      await fails(representative.api.get('/sync/delta?since=yesterday'), 400, 'VALIDATION_FAILED');
    });

    it('requires a cursor at all', async () => {
      await fails(representative.api.get('/sync/delta'), 400, 'VALIDATION_FAILED');
    });
  });

  // ── Idempotency-Key ────────────────────────────────────────────────────────

  describe('Idempotency-Key', () => {
    it('replays the identical body and status, and writes exactly one row', async () => {
      const machine = await createMachine();
      const key = randomUUID();
      const body = {
        clientUuid: randomUUID(),
        type: TransferType.COMPANY_TO_BRANCH,
        toPartyId: supervisor.id,
        occurredAt: new Date().toISOString(),
        items: [itemFor(machine)],
      };

      const first = await director.post('/transfers', body).set('Idempotency-Key', key);
      expect(first.status).toBe(201);

      const replay = await director.post('/transfers', body).set('Idempotency-Key', key);

      expect(replay.status).toBe(first.status);
      expect(replay.body.data).toEqual(first.body.data);
      expect(await transferCount(machine.id)).toBe(1);
    });

    it('replays a confirmation, which answers 200 rather than 201', async () => {
      const machine = await createMachine();
      const pending = await sendToSupervisor(machine);
      const key = randomUUID();
      const body = { signature: DRAWN, payloadHash: pending.payloadHash };

      const first = await supervisor.api
        .post(`/transfers/${pending.id}/confirm`, body)
        .set('Idempotency-Key', key);
      expect(first.status).toBe(200);

      const replay = await supervisor.api
        .post(`/transfers/${pending.id}/confirm`, body)
        .set('Idempotency-Key', key);

      expect(replay.status).toBe(200);
      expect(replay.body.data).toEqual(first.body.data);
    });

    it('creates a second row for a different key', async () => {
      const first = await createMachine();
      const second = await createMachine();

      await ok(
        director
          .post('/transfers', {
            clientUuid: randomUUID(),
            type: TransferType.COMPANY_TO_BRANCH,
            toPartyId: supervisor.id,
            occurredAt: new Date().toISOString(),
            items: [itemFor(first)],
          })
          .set('Idempotency-Key', randomUUID()),
        201,
      );

      await ok(
        director
          .post('/transfers', {
            clientUuid: randomUUID(),
            type: TransferType.COMPANY_TO_BRANCH,
            toPartyId: supervisor.id,
            occurredAt: new Date().toISOString(),
            items: [itemFor(second)],
          })
          .set('Idempotency-Key', randomUUID()),
        201,
      );

      expect(await transferCount(first.id)).toBe(1);
      expect(await transferCount(second.id)).toBe(1);
    });

    it('refuses the same key with a different body', async () => {
      const machine = await createMachine();
      const other = await createMachine();
      const key = randomUUID();

      await ok(
        director
          .post('/transfers', {
            clientUuid: randomUUID(),
            type: TransferType.COMPANY_TO_BRANCH,
            toPartyId: supervisor.id,
            occurredAt: new Date().toISOString(),
            items: [itemFor(machine)],
          })
          .set('Idempotency-Key', key),
        201,
      );

      await fails(
        director
          .post('/transfers', {
            clientUuid: randomUUID(),
            type: TransferType.COMPANY_TO_BRANCH,
            toPartyId: supervisor.id,
            occurredAt: new Date().toISOString(),
            items: [itemFor(other)],
          })
          .set('Idempotency-Key', key),
        409,
        'IDEMPOTENCY_KEY_REUSED',
      );

      expect(await transferCount(other.id)).toBe(0);
    });

    it('refuses the same key on a different endpoint', async () => {
      const key = randomUUID();
      const tag = uniqueCode('K');

      await ok(
        director.post('/merchants', merchantPayload('تاجر المفتاح')).set('Idempotency-Key', key),
        201,
      );

      await fails(
        director
          .post('/machines', { serial: `SN-${tag}`, machineModelId: posModelId, hasBox: false })
          .set('Idempotency-Key', key),
        409,
        'IDEMPOTENCY_KEY_REUSED',
      );
    });

    it('frees the key again when the first attempt failed, so a fixed retry works', async () => {
      const machine = await createMachine();
      const key = randomUUID();

      // A rejected attempt is not an answer worth replaying, so the reservation is dropped and
      // the client may spend the same key on the corrected request.
      await fails(
        director
          .post('/transfers', {
            clientUuid: randomUUID(),
            type: TransferType.COMPANY_TO_BRANCH,
            toPartyId: supervisor.id,
            occurredAt: new Date().toISOString(),
            items: [],
          })
          .set('Idempotency-Key', key),
        400,
        'VALIDATION_FAILED',
      );

      await ok(
        director
          .post('/transfers', {
            clientUuid: randomUUID(),
            type: TransferType.COMPANY_TO_BRANCH,
            toPartyId: supervisor.id,
            occurredAt: new Date().toISOString(),
            items: [itemFor(machine)],
          })
          .set('Idempotency-Key', key),
        201,
      );
    });

    it('scopes a key to its caller, so two devices may pick the same value', async () => {
      const key = randomUUID();

      const mine = await ok<MerchantResponse>(
        representative.api
          .post('/merchants', merchantPayload('تاجر النطاق'))
          .set('Idempotency-Key', key),
        201,
      );

      // The same key from another user is a different reservation entirely — treating keys as
      // global would either serve him the response above or refuse his request as reused.
      const theirs = await ok<MerchantResponse>(
        director
          .post('/merchants', merchantPayload('تاجر النطاق الآخر'))
          .set('Idempotency-Key', key),
        201,
      );

      expect(theirs.id).not.toBe(mine.id);
    });

    it('rejects a key too short to be a real one', async () => {
      await fails(
        director.post('/merchants', merchantPayload('تاجر قصير')).set('Idempotency-Key', 'short'),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('leaves a request with no key on the ordinary path', async () => {
      const machine = await createMachine();

      // The header is optional: `clientUuid` protects the same endpoint independently, and the
      // two mechanisms are meant to work apart as well as together.
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

      expect(await transferCount(machine.id)).toBe(1);
    });
  });

  // ── client_uuid ────────────────────────────────────────────────────────────

  describe('client_uuid', () => {
    it('returns the merchant already registered when a submit is repeated', async () => {
      const clientUuid = randomUUID();
      const payload = { ...merchantPayload('تاجر مكرر'), clientUuid };

      const first = await ok<MerchantResponse>(representative.api.post('/merchants', payload), 201);
      const again = await ok<MerchantResponse>(representative.api.post('/merchants', payload), 201);

      expect(again.id).toBe(first.id);
    });

    it('returns the same media reservation when a presign is repeated', async () => {
      const clientUuid = randomUUID();

      const first = await ok<PresignResponse>(
        representative.api.post('/media/presign', {
          purpose: MediaPurpose.TRANSFER_PHOTO,
          mimeType: 'image/jpeg',
          sizeBytes: JPEG.byteLength,
          clientUuid,
        }),
        201,
      );

      const again = await ok<PresignResponse>(
        representative.api.post('/media/presign', {
          purpose: MediaPurpose.TRANSFER_PHOTO,
          mimeType: 'image/jpeg',
          sizeBytes: JPEG.byteLength,
          clientUuid,
        }),
        201,
      );

      expect(again.mediaId).toBe(first.mediaId);
    });
  });

  // ── occurredAt ─────────────────────────────────────────────────────────────

  describe('occurredAt', () => {
    it('refuses a hand-off dated three days into the future', async () => {
      const machine = await createMachine();

      await fails(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date(Date.now() + 3 * DAY_MS).toISOString(),
          items: [itemFor(machine)],
        }),
        422,
        'INVALID_OCCURRED_AT',
      );
    });

    it('tolerates a device clock a few hours fast', async () => {
      const machine = await createMachine();

      await ok(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          items: [itemFor(machine)],
        }),
        201,
      );
    });

    it('refuses a backfill from months ago for an ordinary user', async () => {
      const machine = await createMachine();
      await deliverToRepresentative(machine);
      const merchantId = (await createMerchant(representative.api, 'تاجر التاريخ')).id;

      await fails(
        representative.api.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.REPRESENTATIVE_TO_MERCHANT,
          toPartyId: merchantId,
          occurredAt: new Date(Date.now() - 60 * DAY_MS).toISOString(),
          items: [itemFor(machine)],
          senderSignature: DRAWN,
        }),
        422,
        'INVALID_OCCURRED_AT',
      );
    });

    it('lets a Director record one, because correcting history is his job', async () => {
      const machine = await createMachine();

      await ok(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date(Date.now() - 60 * DAY_MS).toISOString(),
          items: [itemFor(machine)],
        }),
        201,
      );
    });
  });

  // ── POST /sync/batch ───────────────────────────────────────────────────────

  describe('POST /sync/batch', () => {
    it('applies a day of queued work and reports each item in the order it was recorded', async () => {
      const machine = await createMachine();
      await deliverToRepresentative(machine);
      const merchantId = (await createMerchant(representative.api, 'تاجر الطابور')).id;

      const registration = randomUUID();
      const handOver = randomUUID();
      const occurredAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { results } = await batch(representative.api, [
        {
          clientUuid: registration,
          type: SyncOperationType.CREATE_MERCHANT,
          payload: merchantPayload('تاجر الشارع'),
        },
        {
          clientUuid: handOver,
          type: SyncOperationType.CREATE_TRANSFER,
          occurredAt,
          payload: {
            type: TransferType.REPRESENTATIVE_TO_MERCHANT,
            toPartyId: merchantId,
            items: [itemFor(machine)],
            senderSignature: DRAWN,
          },
        },
      ]);

      expect(results.map((result) => result.clientUuid)).toEqual([registration, handOver]);
      expect(results.map((result) => result.status)).toEqual([
        SyncOperationStatus.SUCCESS,
        SyncOperationStatus.SUCCESS,
      ]);
      expect(results[1].serverId).toBeTruthy();

      // The hand-off is recorded as having happened when the device says it did, not when it
      // finally reached the server.
      const registered = await ok<MerchantResponse>(
        director.get(`/merchants/${results[0].serverId}`),
      );
      expect(registered.name).toBe('تاجر الشارع');
      expect((await readMachine(machine.id)).status).toBe(MachineStatus.WITH_MERCHANT);
    });

    it('reports the second push of the same clientUuid as a duplicate, and writes one row', async () => {
      const clientUuid = randomUUID();
      const name = `تاجر ${uniqueCode('DUP')}`;
      const operation = {
        clientUuid,
        type: SyncOperationType.CREATE_MERCHANT,
        payload: merchantPayload(name),
      };

      const first = await batch(representative.api, [operation]);
      expect(first.results[0].status).toBe(SyncOperationStatus.SUCCESS);

      const again = await batch(representative.api, [operation]);

      expect(again.results[0]).toMatchObject({
        clientUuid,
        status: SyncOperationStatus.DUPLICATE,
        serverId: first.results[0].serverId,
      });

      const { items } = await okPage<MerchantResponse>(
        representative.api.get(`/merchants?search=${encodeURIComponent(name)}`),
      );
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(first.results[0].serverId);
    });

    it('commits the good operations in a batch that also contains a bad one', async () => {
      const good = randomUUID();
      const bad = randomUUID();

      const { results } = await batch(representative.api, [
        {
          clientUuid: bad,
          type: SyncOperationType.CREATE_MERCHANT,
          payload: { name: 'ناقص', phone: 'not-a-phone' },
        },
        {
          clientUuid: good,
          type: SyncOperationType.CREATE_MERCHANT,
          payload: merchantPayload('تاجر سليم'),
        },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        clientUuid: bad,
        status: SyncOperationStatus.FAILED,
        resolution: SyncResolution.DISCARD,
        serverId: null,
      });
      expect(results[0].error!.code).toBe('VALIDATION_FAILED');
      expect(results[1]).toMatchObject({ clientUuid: good, status: SyncOperationStatus.SUCCESS });
      expect(results[1].serverId).toBeTruthy();
    });

    it('reports a custody conflict as MANUAL and changes nothing', async () => {
      const machine = await createMachine();
      // The supervisor signed for it; the device thinks the representative still has it.
      await deliverToSupervisor(machine);
      const merchantId = (await createMerchant(representative.api, 'تاجر التعارض')).id;

      const { results } = await batch(representative.api, [
        {
          clientUuid: randomUUID(),
          type: SyncOperationType.CREATE_TRANSFER,
          occurredAt: new Date().toISOString(),
          payload: {
            type: TransferType.REPRESENTATIVE_TO_MERCHANT,
            toPartyId: merchantId,
            items: [itemFor(machine)],
            senderSignature: DRAWN,
          },
        },
      ]);

      expect(results[0]).toMatchObject({
        status: SyncOperationStatus.CONFLICT,
        resolution: SyncResolution.MANUAL,
        serverId: null,
      });

      // …and it says where the machine actually is, which is the whole point of MANUAL.
      const state = results[0].serverState as { machines: { id: string; status: string }[] };
      expect(state.machines[0]).toMatchObject({
        id: machine.id,
        status: MachineStatus.IN_BRANCH_WAREHOUSE,
      });

      const unchanged = await readMachine(machine.id);
      expect(unchanged.status).toBe(MachineStatus.IN_BRANCH_WAREHOUSE);
      expect(await transferCount(machine.id)).toBe(1);
    });

    it('reports a signature for a transfer that was withdrawn, with the server’s version', async () => {
      const machine = await createMachine();
      const pending = await sendToSupervisor(machine);

      await ok(director.post(`/transfers/${pending.id}/cancel`, { reason: 'خطأ في التسجيل' }));

      const { results } = await batch(supervisor.api, [
        {
          clientUuid: randomUUID(),
          type: SyncOperationType.CONFIRM_TRANSFER,
          payload: {
            transferId: pending.id,
            signature: DRAWN,
            payloadHash: pending.payloadHash,
          },
        },
      ]);

      expect(results[0]).toMatchObject({
        status: SyncOperationStatus.CONFLICT,
        resolution: SyncResolution.MANUAL,
      });

      const state = results[0].serverState as { transfer: { id: string; status: string } };
      expect(state.transfer).toMatchObject({
        id: pending.id,
        status: TransferStatus.CANCELLED,
      });
    });

    it('treats a re-pushed signature as a duplicate rather than a second signature', async () => {
      const machine = await createMachine();
      const pending = await sendToSupervisor(machine);

      await ok<TransferResponse>(
        supervisor.api.post(`/transfers/${pending.id}/confirm`, {
          signature: DRAWN,
          payloadHash: pending.payloadHash,
        }),
      );

      const { results } = await batch(supervisor.api, [
        {
          clientUuid: randomUUID(),
          type: SyncOperationType.CONFIRM_TRANSFER,
          payload: {
            transferId: pending.id,
            signature: DRAWN,
            payloadHash: pending.payloadHash,
          },
        },
      ]);

      expect(results[0]).toMatchObject({
        status: SyncOperationStatus.DUPLICATE,
        serverId: pending.id,
      });
    });

    it('rejects a pending transfer pushed offline, and rolls custody back', async () => {
      const machine = await createMachine();
      const pending = await sendToSupervisor(machine);

      const { results } = await batch(supervisor.api, [
        {
          clientUuid: randomUUID(),
          type: SyncOperationType.REJECT_TRANSFER,
          payload: {
            transferId: pending.id,
            reason: 'الماكينة معطوبة',
          },
        },
      ]);

      expect(results[0]).toMatchObject({
        status: SyncOperationStatus.SUCCESS,
        serverId: pending.id,
      });

      const rejected = await ok<TransferResponse>(director.get(`/transfers/${pending.id}`));
      expect(rejected.status).toBe(TransferStatus.REJECTED);
      expect((await readMachine(machine.id)).status).toBe(MachineStatus.IN_COMPANY_WAREHOUSE);
    });

    it('reports a re-pushed rejection of an already-resolved transfer as a conflict', async () => {
      const machine = await createMachine();
      const pending = await sendToSupervisor(machine);

      await ok<TransferResponse>(
        supervisor.api.post(`/transfers/${pending.id}/reject`, { reason: 'رفض أول مرة' }),
      );

      const { results } = await batch(supervisor.api, [
        {
          clientUuid: randomUUID(),
          type: SyncOperationType.REJECT_TRANSFER,
          payload: {
            transferId: pending.id,
            reason: 'رفض تاني بالغلط',
          },
        },
      ]);

      expect(results[0]).toMatchObject({
        status: SyncOperationStatus.CONFLICT,
        resolution: SyncResolution.MANUAL,
      });

      const state = results[0].serverState as { transfer: { id: string; status: string } };
      expect(state.transfer).toMatchObject({ id: pending.id, status: TransferStatus.REJECTED });
    });

    it('resolves a photo the device referenced by the id it made up offline', async () => {
      const machine = await createMachine();
      await deliverToRepresentative(machine);
      const merchantId = (await createMerchant(representative.api, 'تاجر الصور')).id;

      const photoClientUuid = randomUUID();
      const mediaId = await uploadPhoto(representative.api, photoClientUuid);

      const { results } = await batch(representative.api, [
        {
          clientUuid: randomUUID(),
          type: SyncOperationType.CREATE_TRANSFER,
          occurredAt: new Date().toISOString(),
          payload: {
            type: TransferType.REPRESENTATIVE_TO_MERCHANT,
            toPartyId: merchantId,
            items: [itemFor(machine, { photoMediaIds: [photoClientUuid] })],
            senderSignature: DRAWN,
          },
        },
      ]);

      expect(results[0].status).toBe(SyncOperationStatus.SUCCESS);

      const transfer = await ok<TransferResponse>(
        director.get(`/transfers/${results[0].serverId}`),
      );
      expect(transfer.items[0].photos.map((photo) => photo.mediaId)).toEqual([mediaId]);
    });

    it('asks the client to retry an operation whose photo has not been uploaded yet', async () => {
      const machine = await createMachine();
      await deliverToRepresentative(machine);
      const merchantId = (await createMerchant(representative.api, 'تاجر الانتظار')).id;

      const { results } = await batch(representative.api, [
        {
          clientUuid: randomUUID(),
          type: SyncOperationType.CREATE_TRANSFER,
          occurredAt: new Date().toISOString(),
          payload: {
            type: TransferType.REPRESENTATIVE_TO_MERCHANT,
            toPartyId: merchantId,
            items: [itemFor(machine, { photoMediaIds: [randomUUID()] })],
            senderSignature: DRAWN,
          },
        },
      ]);

      expect(results[0]).toMatchObject({
        status: SyncOperationStatus.FAILED,
        resolution: SyncResolution.RETRY,
      });
      expect(results[0].error!.code).toBe('MEDIA_NOT_FOUND');
      expect((await readMachine(machine.id)).status).toBe(MachineStatus.WITH_REPRESENTATIVE);
    });

    it('resolves a merchant registered offline in the very same batch', async () => {
      const machine = await createMachine();
      await deliverToRepresentative(machine);

      const merchantClientUuid = randomUUID();
      const transferClientUuid = randomUUID();

      const { results } = await batch(representative.api, [
        {
          clientUuid: merchantClientUuid,
          type: SyncOperationType.CREATE_MERCHANT,
          payload: merchantPayload('تاجر اليوم نفسه'),
        },
        {
          clientUuid: transferClientUuid,
          type: SyncOperationType.CREATE_TRANSFER,
          occurredAt: new Date().toISOString(),
          payload: {
            type: TransferType.REPRESENTATIVE_TO_MERCHANT,
            // Named by the id the device made up when it registered the merchant a moment
            // earlier — the real merchant id did not exist on the device at all.
            toPartyId: merchantClientUuid,
            items: [itemFor(machine)],
            senderSignature: DRAWN,
          },
        },
      ]);

      expect(results.map((result) => result.status)).toEqual([
        SyncOperationStatus.SUCCESS,
        SyncOperationStatus.SUCCESS,
      ]);

      const transfer = await ok<TransferResponse & { to: { id: string } }>(
        director.get(`/transfers/${results[1].serverId}`),
      );
      expect(transfer.to.id).toBe(results[0].serverId);
    });

    it('resolves a merchant registered offline in an earlier, already-synced batch', async () => {
      const machine = await createMachine();
      await deliverToRepresentative(machine);

      const merchantClientUuid = randomUUID();
      const first = await batch(representative.api, [
        {
          clientUuid: merchantClientUuid,
          type: SyncOperationType.CREATE_MERCHANT,
          payload: merchantPayload('تاجر أمس'),
        },
      ]);
      const merchantServerId = first.results[0].serverId;

      const { results } = await batch(representative.api, [
        {
          clientUuid: randomUUID(),
          type: SyncOperationType.CREATE_TRANSFER,
          occurredAt: new Date().toISOString(),
          payload: {
            type: TransferType.REPRESENTATIVE_TO_MERCHANT,
            toPartyId: merchantClientUuid,
            items: [itemFor(machine)],
            senderSignature: DRAWN,
          },
        },
      ]);

      expect(results[0].status).toBe(SyncOperationStatus.SUCCESS);

      const transfer = await ok<TransferResponse & { to: { id: string } }>(
        director.get(`/transfers/${results[0].serverId}`),
      );
      expect(transfer.to.id).toBe(merchantServerId);
    });

    it('discards a transfer naming a merchant that was never registered, offline or otherwise', async () => {
      const machine = await createMachine();
      await deliverToRepresentative(machine);

      const { results } = await batch(representative.api, [
        {
          clientUuid: randomUUID(),
          type: SyncOperationType.CREATE_TRANSFER,
          occurredAt: new Date().toISOString(),
          payload: {
            type: TransferType.REPRESENTATIVE_TO_MERCHANT,
            toPartyId: randomUUID(),
            items: [itemFor(machine)],
            senderSignature: DRAWN,
          },
        },
      ]);

      // A `clientUuid` that never resolves reads exactly like a stranger's real id would:
      // "unknown merchant", not a sync-specific complaint.
      expect(results[0]).toMatchObject({
        status: SyncOperationStatus.FAILED,
        resolution: SyncResolution.DISCARD,
      });
      expect(results[0].error!.code).toBe('VALIDATION_FAILED');
    });

    it('queues a subscription for a merchant registered offline in an earlier batch', async () => {
      const merchantClientUuid = randomUUID();
      const created = await batch(representative.api, [
        {
          clientUuid: merchantClientUuid,
          type: SyncOperationType.CREATE_MERCHANT,
          payload: merchantPayload('تاجر الاشتراك'),
        },
      ]);
      const merchantServerId = created.results[0].serverId!;

      const { results } = await batch(representative.api, [
        {
          clientUuid: randomUUID(),
          type: SyncOperationType.CREATE_SUBSCRIPTION,
          payload: {
            merchantId: merchantClientUuid,
            planType: 'MONTHLY',
            amount: 300,
            startDate: '2026-09-01',
          },
        },
      ]);

      expect(results[0].status).toBe(SyncOperationStatus.SUCCESS);

      const subscriptions = await ok<{ id: string; amount: number }[]>(
        director.get(`/merchants/${merchantServerId}/subscriptions`),
      );
      expect(subscriptions.map((row) => row.id)).toContain(results[0].serverId);
    });

    it('reports the second push of the same subscription clientUuid as a duplicate', async () => {
      const merchant = await createMerchant(representative.api, 'تاجر التكرار');
      const operation = {
        clientUuid: randomUUID(),
        type: SyncOperationType.CREATE_SUBSCRIPTION,
        payload: {
          merchantId: merchant.id,
          planType: 'MONTHLY',
          amount: 300,
          startDate: '2026-09-01',
        },
      };

      const first = await batch(representative.api, [operation]);
      expect(first.results[0].status).toBe(SyncOperationStatus.SUCCESS);

      const again = await batch(representative.api, [operation]);
      expect(again.results[0]).toMatchObject({
        status: SyncOperationStatus.DUPLICATE,
        serverId: first.results[0].serverId,
      });

      const subscriptions = await ok<{ id: string }[]>(
        director.get(`/merchants/${merchant.id}/subscriptions`),
      );
      expect(subscriptions).toHaveLength(1);
    });

    it('discards an operation the caller has no permission for', async () => {
      const { results } = await batch(representative.api, [
        {
          clientUuid: randomUUID(),
          type: SyncOperationType.CREATE_FINANCE_TRANSACTION,
          payload: { amount: '100.00' },
        },
      ]);

      expect(results[0]).toMatchObject({
        status: SyncOperationStatus.FAILED,
        resolution: SyncResolution.DISCARD,
      });
      expect(results[0].error!.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('discards an operation dated three days into the future', async () => {
      const machine = await createMachine();
      await deliverToRepresentative(machine);
      const merchantId = (await createMerchant(representative.api, 'تاجر الساعة')).id;

      const { results } = await batch(representative.api, [
        {
          clientUuid: randomUUID(),
          type: SyncOperationType.CREATE_TRANSFER,
          occurredAt: new Date(Date.now() + 3 * DAY_MS).toISOString(),
          payload: {
            type: TransferType.REPRESENTATIVE_TO_MERCHANT,
            toPartyId: merchantId,
            items: [itemFor(machine)],
            senderSignature: DRAWN,
          },
        },
      ]);

      expect(results[0]).toMatchObject({
        status: SyncOperationStatus.FAILED,
        resolution: SyncResolution.DISCARD,
      });
      expect(results[0].error!.code).toBe('INVALID_OCCURRED_AT');
      expect((await readMachine(machine.id)).status).toBe(MachineStatus.WITH_REPRESENTATIVE);
    });

    it('replays a whole batch that arrives twice under one Idempotency-Key', async () => {
      const key = randomUUID();
      const body = {
        operations: [
          {
            clientUuid: randomUUID(),
            type: SyncOperationType.CREATE_MERCHANT,
            payload: merchantPayload(`تاجر ${uniqueCode('RPL')}`),
          },
        ],
      };

      const first = await representative.api.post('/sync/batch', body).set('Idempotency-Key', key);
      expect(first.status).toBe(200);

      const replay = await representative.api.post('/sync/batch', body).set('Idempotency-Key', key);

      // Identical to the byte, `serverTime` included: this is the recorded response, not a re-run.
      expect(replay.body.data).toEqual(first.body.data);
    });

    it('refuses an empty queue', async () => {
      await fails(
        representative.api.post('/sync/batch', { operations: [] }),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('refuses a queue longer than one push may carry', async () => {
      const operations = Array.from({ length: 51 }, () => ({
        clientUuid: randomUUID(),
        type: SyncOperationType.CREATE_MERCHANT,
        payload: merchantPayload('تاجر طويل'),
      }));

      await fails(representative.api.post('/sync/batch', { operations }), 400, 'VALIDATION_FAILED');
    });

    it('refuses an operation of an unknown kind', async () => {
      await fails(
        representative.api.post('/sync/batch', {
          operations: [{ clientUuid: randomUUID(), type: 'DELETE_EVERYTHING', payload: {} }],
        }),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('refuses a confirmation that does not say what it is confirming', async () => {
      const { results } = await batch(supervisor.api, [
        {
          clientUuid: randomUUID(),
          type: SyncOperationType.CONFIRM_TRANSFER,
          payload: { signature: DRAWN },
        },
      ]);

      expect(results[0]).toMatchObject({
        status: SyncOperationStatus.FAILED,
        resolution: SyncResolution.DISCARD,
      });
      expect(results[0].error!.code).toBe('VALIDATION_FAILED');
    });

    it('refuses an anonymous push', async () => {
      await fails(
        director.as(null).post('/sync/batch', { operations: [] }),
        401,
        'UNAUTHENTICATED',
      );
    });
  });
});
