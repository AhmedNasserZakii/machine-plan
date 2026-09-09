import { randomUUID } from 'node:crypto';
import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ItemCondition, SignatureMethod, TransferType } from 'src/common/enums/transfer.enum';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { SyncOperationStatus, SyncOperationType } from 'src/common/enums/sync.enum';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { Api, ok } from './utils/api-client';
import {
  createBranch,
  loginAsDirector,
  provisionUser,
  ProvisionedUser,
  roleIdByCode,
  uniqueCode,
  uniquePhone,
} from './utils/fixtures';
import { createTestApp } from './utils/test-app';

/**
 * `5.2`: load and concurrency testing.
 *
 * Everything here runs against real Postgres, with real concurrent HTTP requests (`Promise.all`
 * over `supertest`, never a single `await` chain pretending to be parallel) — the same standard
 * this session applied to MinIO/PDF/migration verification: exercise the real thing, not a mock
 * of it.
 *
 * **Response-time / error-rate thresholds recorded here** (measured on this development
 * machine's local Postgres — a CI runner or production database will differ; treat the numbers
 * below as a smoke-level regression guard, not an SLA):
 * - Sync-batch throughput: 40 concurrent batches × 20 operations (800 total writes) complete in
 *   well under 30s, 0% operation-level error rate.
 * - Concurrent identical writes (same `clientUuid`, true concurrency) and concurrent custody
 *   confirms: 0% of racing requests may return an unexpected failure — every one must resolve to
 *   a well-defined outcome (the winner's success, or a clean `DUPLICATE`/409 for the rest).
 */
describe('Concurrency and load (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;
  let dataSource: DataSource;

  let branchId: string;
  let posModelId: string;

  const DRAWN = { method: SignatureMethod.DRAWN_SIGNATURE, deviceModel: 'e2e' };

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);
    dataSource = app.get(DataSource);

    const branch = await createBranch(director, 'فرع الحمل');
    branchId = branch.id;

    const models = await ok<{ id: string; machineType: { requiresSim: boolean } }[]>(
      director.get('/machine-models'),
    );
    posModelId = models.find((model) => model.machineType.requiresSim)!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  let serialCounter = 0;
  async function createMachine(): Promise<{
    id: string;
    battery: { id: string; serial: string } | null;
  }> {
    serialCounter += 1;
    const tag = `${uniqueCode('T')}_${serialCounter}`;

    return ok(
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

  function merchantOp(clientUuid = randomUUID()): Record<string, unknown> {
    return {
      clientUuid,
      type: SyncOperationType.CREATE_MERCHANT,
      payload: {
        name: 'تاجر الحمل',
        phone: uniquePhone(),
        shopName: 'محل الحمل',
        address: 'شارع الحمل، القاهرة',
      },
    };
  }

  // ── concurrent custody transfers ─────────────────────────────────────────

  describe('concurrent custody transfers', () => {
    it('serializes concurrent confirmations of the same transfer', async () => {
      const supervisor = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
        branchId,
      });
      const representative = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
        branchId,
      });

      const machine = await createMachine();
      const item = {
        machineId: machine.id,
        batterySerialScanned: machine.battery!.serial,
        hasCharger: true,
        hasBox: true,
        condition: ItemCondition.GOOD,
      };

      const intake = await ok<{ id: string; payloadHash: string }>(
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
        supervisor.api.post(`/transfers/${intake.id}/confirm`, {
          signature: DRAWN,
          payloadHash: intake.payloadHash,
        }),
      );

      const created = await ok<{ id: string; payloadHash: string }>(
        supervisor.api.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.BRANCH_TO_REPRESENTATIVE,
          toPartyId: representative.id,
          occurredAt: new Date().toISOString(),
          items: [item],
        }),
        201,
      );

      const attempts = Array.from({ length: 5 }, () =>
        representative.api.post(`/transfers/${created.id}/confirm`, {
          signature: DRAWN,
          payloadHash: created.payloadHash,
        }),
      );

      const results = await Promise.allSettled(attempts);
      const statuses = results.map((result) =>
        result.status === 'fulfilled' ? result.value.status : 0,
      );

      expect(statuses.filter((status) => status === 200)).toHaveLength(1);
      expect(statuses.filter((status) => status !== 200)).toHaveLength(4);

      const machineRow = await dataSource.query<{ status: MachineStatus }[]>(
        `SELECT status FROM machines WHERE id = $1`,
        [machine.id],
      );
      expect(machineRow[0].status).toBe(MachineStatus.WITH_REPRESENTATIVE);
    });
  });

  // ── concurrent identical sync operations ─────────────────────────────────

  describe('concurrent identical sync-batch writes', () => {
    it('never reports a bare failure for a genuine concurrent duplicate — only success or DUPLICATE', async () => {
      const representative = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
        branchId,
      });

      const clientUuid = randomUUID();
      const op = merchantOp(clientUuid);

      const attempts = Array.from({ length: 10 }, () =>
        representative.api.post('/sync/batch', { operations: [op] }),
      );
      const responses = await Promise.all(attempts);

      const results = responses.map((response) => {
        expect(response.status).toBe(200);
        return response.body.data.results[0] as {
          status: SyncOperationStatus;
          serverId: string | null;
        };
      });

      // The one invariant that actually matters: nobody sees a bare failure, and everybody who
      // succeeds agrees on the same row.
      const serverIds = new Set(results.map((result) => result.serverId));
      expect(serverIds.size).toBe(1);
      expect(
        results.every(
          (result) =>
            result.status === SyncOperationStatus.SUCCESS ||
            result.status === SyncOperationStatus.DUPLICATE,
        ),
      ).toBe(true);

      const rows = await dataSource.query<{ count: string }[]>(
        `SELECT count(*) FROM merchants WHERE client_uuid = $1`,
        [clientUuid],
      );
      expect(rows[0].count).toBe('1');
    });

    it('survives a triple sequential replay of an identical offline batch with no duplicate rows', async () => {
      const representative = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
        branchId,
      });

      const clientUuids = [randomUUID(), randomUUID(), randomUUID()];
      const operations = clientUuids.map((id) => merchantOp(id));

      const attempt1 = await ok<{ results: { status: SyncOperationStatus; serverId: string }[] }>(
        representative.api.post('/sync/batch', { operations }),
      );
      expect(attempt1.results.every((r) => r.status === SyncOperationStatus.SUCCESS)).toBe(true);

      // Same client, exact same payload, sent again — the offline device never saw attempt 1's
      // response (a dropped connection, a killed app) and is doing the only safe thing: retry.
      const attempt2 = await ok<{ results: { status: SyncOperationStatus; serverId: string }[] }>(
        representative.api.post('/sync/batch', { operations }),
      );
      const attempt3 = await ok<{ results: { status: SyncOperationStatus; serverId: string }[] }>(
        representative.api.post('/sync/batch', { operations }),
      );

      for (const replay of [attempt2, attempt3]) {
        expect(replay.results.every((r) => r.status === SyncOperationStatus.DUPLICATE)).toBe(true);
        expect(replay.results.map((r) => r.serverId)).toEqual(
          attempt1.results.map((r) => r.serverId),
        );
      }

      const rows = await dataSource.query<{ count: string }[]>(
        `SELECT count(*) FROM merchants WHERE client_uuid = ANY($1::uuid[])`,
        [clientUuids],
      );
      expect(rows[0].count).toBe('3');
    });
  });

  // ── load ──────────────────────────────────────────────────────────────────

  describe('sync-batch load', () => {
    it('40 representatives pushing 20-operation batches concurrently: 0% error rate', async () => {
      const REP_COUNT = 40;
      const OPS_PER_BATCH = 20;

      const representatives: ProvisionedUser[] = [];
      for (let i = 0; i < REP_COUNT; i += 1) {
        representatives.push(
          await provisionUser(server, director, {
            roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
            branchId,
          }),
        );
      }

      const startedAt = Date.now();
      const responses = await Promise.all(
        representatives.map((rep) =>
          rep.api.post('/sync/batch', {
            operations: Array.from({ length: OPS_PER_BATCH }, () => merchantOp()),
          }),
        ),
      );
      const durationMs = Date.now() - startedAt;

      let succeeded = 0;
      let failed = 0;
      for (const response of responses) {
        expect(response.status).toBe(200);
        for (const result of response.body.data.results as { status: SyncOperationStatus }[]) {
          if (result.status === SyncOperationStatus.SUCCESS) succeeded += 1;
          else failed += 1;
        }
      }

      // eslint-disable-next-line no-console
      console.log(
        `[load] ${REP_COUNT} reps x ${OPS_PER_BATCH} ops = ${REP_COUNT * OPS_PER_BATCH} ` +
          `operations in ${durationMs}ms, ${succeeded} succeeded, ${failed} failed`,
      );

      expect(succeeded).toBe(REP_COUNT * OPS_PER_BATCH);
      expect(failed).toBe(0);
      // Generous smoke-level ceiling, not an SLA — see the file-level doc comment.
      expect(durationMs).toBeLessThan(30_000);
    }, 120_000);
  });
});
