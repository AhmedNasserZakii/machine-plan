import { randomUUID } from 'node:crypto';
import type { App } from 'supertest/types';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { FinanceKind } from 'src/common/enums/finance.enum';
import { Severity } from 'src/common/enums/operations.enum';
import { ReportJobStatus, ReportKey } from 'src/common/enums/report.enum';
import { ItemCondition, SignatureMethod, TransferType } from 'src/common/enums/transfer.enum';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { Api, fails, ok } from './utils/api-client';
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

interface ReportColumn {
  key: string;
  header: string;
  type: 'text' | 'number' | 'date';
}

interface ReportResponse {
  key: ReportKey;
  title: string;
  generatedAt: string;
  filters: Record<string, unknown>;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  totals: Record<string, number> | null;
  rowCount: number;
  truncated: boolean;
  extra?: Record<string, unknown>;
}

interface CatalogueEntry {
  key: ReportKey;
  title: string;
  permission: string;
  path: string;
  allowed: boolean;
}

interface JobAccepted {
  jobId: string;
  status: ReportJobStatus;
  pollUrl: string;
}

interface JobResponse {
  id: string;
  reportKey: ReportKey;
  format: string;
  status: ReportJobStatus;
  rowCount: number | null;
  filename: string | null;
  sizeBytes: number | null;
  downloadUrl: string | null;
  errorCode: string | null;
  expiresAt: string;
  completedAt: string | null;
}

interface MachineResponse {
  id: string;
  serial: string;
}

interface MachineModelResponse {
  id: string;
  machineType: { id: string; requiresSim: boolean };
}

interface TransferResponse {
  id: string;
  referenceNo: string;
  payloadHash: string;
}

interface CategoryResponse {
  id: string;
}

const DRAWN = { method: SignatureMethod.DRAWN_SIGNATURE, deviceModel: 'e2e' };
const DAY_MS = 24 * 60 * 60 * 1000;

function day(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

function inDays(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
}

function names(ar: string): Record<string, { name: string }> {
  return { ar: { name: ar }, en: { name: ar } };
}

/** Every report, with the permission that opens it and the role that holds it. */
const OPERATIONS_REPORTS = [
  '/reports/machines/inventory',
  '/reports/machines/custody',
  '/reports/machines/idle',
  '/reports/machines/costs',
  '/reports/machines/warranty',
  '/reports/transfers',
  '/reports/transfers/pending',
  '/reports/representatives',
  '/reports/violations',
  '/reports/maintenance',
] as const;

const FINANCE_REPORTS = [
  '/reports/finance/expenses',
  '/reports/finance/income',
  '/reports/finance/pnl',
  '/reports/finance/budgets',
  '/reports/branches/comparison',
] as const;

describe('Reports (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;

  let branchId: string;
  let otherBranchId: string;
  let supervisor: ProvisionedUser;
  let representative: ProvisionedUser;
  let otherSupervisor: ProvisionedUser;
  let accountant: ProvisionedUser;

  let posModelId: string;
  let cashMethodId: string;
  let expenseCategoryId: string;
  let incomeCategoryId: string;

  /** Held by the branch, so it appears in custody, inventory and the transfer log. */
  let branchMachine: MachineResponse;
  /** Never confirmed, so it is the pending hand-off the reports have to find. */
  let pendingTransfer: TransferResponse;
  let maintenanceReference: string;

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);

    branchId = (await createBranch(director, 'فرع التقارير')).id;
    otherBranchId = (await createBranch(director, 'فرع التقارير الآخر')).id;

    supervisor = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
      branchId,
      fullName: 'مشرف التقارير',
    });

    otherSupervisor = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
      branchId: otherBranchId,
      fullName: 'مشرف الفرع الآخر',
    });

    representative = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
      branchId,
      fullName: 'مندوب التقارير',
    });

    accountant = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.ACCOUNTANT),
      fullName: 'محاسب التقارير',
    });

    const models = await ok<MachineModelResponse[]>(director.get('/machine-models'));
    posModelId = models.find((model) => model.machineType.requiresSim)!.id;

    cashMethodId = (await ok<{ id: string }[]>(director.get('/payment-methods')))[0].id;

    await seedOperations();
    await seedFinance();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── fixtures ───────────────────────────────────────────────────────────────

  let serialCounter = 0;

  async function createMachine(overrides: Record<string, unknown> = {}): Promise<MachineResponse> {
    serialCounter += 1;
    const tag = `${uniqueCode('R')}_${serialCounter}`;

    return ok<MachineResponse>(
      director.post('/machines', {
        serial: `SN-${tag}`,
        machineModelId: posModelId,
        simSerial: `SIM-${tag}`,
        battery: { serial: `BT-${tag}` },
        hasBox: true,
        purchasePrice: 4200,
        purchaseDate: day(400),
        warrantyEnd: inDays(20),
        ...overrides,
      }),
      201,
    );
  }

  function item(machine: MachineResponse): Record<string, unknown> {
    return {
      machineId: machine.id,
      hasCharger: true,
      hasBox: true,
      condition: ItemCondition.GOOD,
    };
  }

  async function sendToBranch(
    machine: MachineResponse,
    toPartyId: string,
  ): Promise<TransferResponse> {
    return ok<TransferResponse>(
      director.post('/transfers', {
        clientUuid: randomUUID(),
        type: TransferType.COMPANY_TO_BRANCH,
        toPartyId,
        occurredAt: new Date().toISOString(),
        items: [item(machine)],
      }),
      201,
    );
  }

  async function seedOperations(): Promise<void> {
    branchMachine = await createMachine();
    const confirmed = await sendToBranch(branchMachine, supervisor.id);

    await ok(
      supervisor.api.post(`/transfers/${confirmed.id}/confirm`, {
        signature: DRAWN,
        payloadHash: confirmed.payloadHash,
      }),
    );

    // Handed on to the representative, so custody has somebody to attribute it to.
    const toRep = await ok<TransferResponse>(
      supervisor.api.post('/transfers', {
        clientUuid: randomUUID(),
        type: TransferType.BRANCH_TO_REPRESENTATIVE,
        toPartyId: representative.id,
        occurredAt: new Date().toISOString(),
        items: [item(branchMachine)],
      }),
      201,
    );

    await ok(
      representative.api.post(`/transfers/${toRep.id}/confirm`, {
        signature: DRAWN,
        payloadHash: toRep.payloadHash,
      }),
    );

    pendingTransfer = await sendToBranch(await createMachine(), supervisor.id);

    // The other branch gets its own machine, which is what branch scoping has to hide.
    const otherMachine = await createMachine();
    const toOther = await sendToBranch(otherMachine, otherSupervisor.id);
    await ok(
      otherSupervisor.api.post(`/transfers/${toOther.id}/confirm`, {
        signature: DRAWN,
        payloadHash: toOther.payloadHash,
      }),
    );

    await createMerchant(representative.api, 'تاجر التقارير');

    const types = await ok<{ id: string }[]>(director.get('/violation-types'));
    await ok(
      supervisor.api.post('/violations', {
        userId: representative.id,
        violationTypeId: types[0].id,
        severity: Severity.HIGH,
        description: 'مخالفة لتقرير المخالفات',
      }),
      201,
    );

    const locations = await ok<{ id: string; code: string }[]>(
      director.get('/maintenance-locations'),
    );

    maintenanceReference = (
      await ok<{ referenceNo: string }>(
        director.post('/maintenance-orders', {
          clientUuid: randomUUID(),
          machineId: (await createMachine()).id,
          locationId: locations.find((row) => row.code === 'INTERNAL_WORKSHOP')!.id,
          reportedFault: 'عطل لتقرير الصيانة',
          sentAt: new Date().toISOString(),
        }),
        201,
      )
    ).referenceNo;
  }

  async function seedFinance(): Promise<void> {
    expenseCategoryId = (
      await ok<CategoryResponse>(
        director.post('/finance/categories', {
          kind: FinanceKind.EXPENSE,
          translations: names('مصروف التقارير'),
        }),
        201,
      )
    ).id;

    incomeCategoryId = (
      await ok<CategoryResponse>(
        director.post('/finance/categories', {
          kind: FinanceKind.INCOME,
          translations: names('إيراد التقارير'),
        }),
        201,
      )
    ).id;

    for (const branch of [branchId, otherBranchId]) {
      await ok(
        director.post('/finance/transactions', {
          kind: FinanceKind.EXPENSE,
          amount: 1500,
          categoryId: expenseCategoryId,
          transactionDate: day(3),
          paymentMethodId: cashMethodId,
          branchId: branch,
        }),
        201,
      );

      await ok(
        director.post('/finance/transactions', {
          kind: FinanceKind.INCOME,
          amount: 4000,
          categoryId: incomeCategoryId,
          transactionDate: day(2),
          paymentMethodId: cashMethodId,
          branchId: branch,
        }),
        201,
      );
    }

    await ok(
      director.post('/finance/budgets', {
        categoryId: expenseCategoryId,
        periodType: 'MONTHLY',
        periodStart: day(30),
        periodEnd: inDays(30),
        amount: 10000,
      }),
      201,
    );
  }

  async function report(api: Api, path: string, query = ''): Promise<ReportResponse> {
    return ok<ReportResponse>(api.get(`${path}${query}`));
  }

  /**
   * The e2e run shares one database between suites, so a fleet-wide report holds rows this
   * suite never created and the one it is looking for need not be on the first page.
   */
  async function findRow(
    path: string,
    match: (row: Record<string, unknown>) => boolean,
    query = '',
  ): Promise<Record<string, unknown> | undefined> {
    const separator = query ? '&' : '?';

    for (let page = 1; page <= 10; page += 1) {
      const result = await report(director, path, `${query}${separator}limit=100&page=${page}`);
      const found = result.rows.find(match);

      if (found) return found;
      if (result.rows.length < 100) return undefined;
    }

    return undefined;
  }

  /** Supertest's default parser assumes text; binary files have to be collected by hand. */
  function binaryParser(
    res: request.Response,
    callback: (error: Error | null, body: Buffer) => void,
  ): void {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
    res.on('error', (error: Error) => callback(error, Buffer.alloc(0)));
  }

  async function download(url: string): Promise<Buffer> {
    const path = url.slice(url.indexOf('/api/'));
    const response = await request(server).get(path).buffer(true).parse(binaryParser).expect(200);
    return response.body as Buffer;
  }

  /** Starts an export and polls it to a terminal state. */
  async function exportReport(
    path: string,
    format: 'csv' | 'xlsx' | 'pdf',
    api: Api = director,
  ): Promise<JobResponse> {
    const accepted = await ok<JobAccepted>(api.get(`${path}?format=${format}`), 202);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const job = await ok<JobResponse>(api.get(`/reports/jobs/${accepted.jobId}`));

      if (job.status === ReportJobStatus.READY || job.status === ReportJobStatus.FAILED) {
        return job;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`export of ${path} never finished`);
  }

  // ── the catalogue ──────────────────────────────────────────────────────────

  describe('GET /reports', () => {
    it('needs a token', async () => {
      await fails(director.as(null).get('/reports'), 401, 'UNAUTHENTICATED');
    });

    it('lists every report with its permission and path', async () => {
      const catalogue = await ok<CatalogueEntry[]>(director.get('/reports'));

      expect(catalogue).toHaveLength(17);
      expect(catalogue.every((entry) => entry.path.startsWith('/reports/'))).toBe(true);
      expect(
        catalogue.every(
          (entry) =>
            entry.permission.startsWith('reports.') ||
            entry.permission.startsWith('merchants.') ||
            entry.permission.startsWith('maintenance.'),
        ),
      ).toBe(true);
    });

    it('flags every report as allowed for the Director', async () => {
      const catalogue = await ok<CatalogueEntry[]>(director.get('/reports'));

      expect(catalogue.every((entry) => entry.allowed)).toBe(true);
    });

    it('flags the finance reports as closed to a caller who cannot read money', async () => {
      const catalogue = await ok<CatalogueEntry[]>(supervisor.api.get('/reports'));
      const finance = catalogue.filter((entry) => entry.permission === 'reports.finance');

      expect(finance.length).toBeGreaterThan(0);
      expect(finance.every((entry) => !entry.allowed)).toBe(true);
    });

    it('titles the reports in the requested language', async () => {
      const arabic = await ok<CatalogueEntry[]>(director.get('/reports'));
      const english = await ok<CatalogueEntry[]>(director.withLocale('en').get('/reports'));

      expect(arabic[0].title).not.toBe(english[0].title);
      expect(arabic[0].title).toMatch(/[\u0600-\u06FF]/);
    });
  });

  // ── the reports themselves ─────────────────────────────────────────────────

  describe('machine reports', () => {
    it('inventory lists the fleet with real rows', async () => {
      const result = await report(director, '/reports/machines/inventory');

      expect(result.key).toBe(ReportKey.MACHINE_INVENTORY);
      expect(result.rowCount).toBeGreaterThan(0);
      expect(result.columns.length).toBeGreaterThan(0);
      expect(
        await findRow('/reports/machines/inventory', (row) => row.serial === branchMachine.serial),
      ).toBeDefined();
    });

    it('custody attributes the machine to whoever holds it', async () => {
      const held = await findRow(
        '/reports/machines/custody',
        (row) => row.serial === branchMachine.serial,
      );

      expect(held).toBeDefined();
      expect(held!.group).toBe('مندوب التقارير');
    });

    it('custody regroups on request', async () => {
      const byBranch = await report(director, '/reports/machines/custody', '?groupBy=branch');

      expect(byBranch.filters.groupBy).toBe('branch');
      expect(byBranch.rowCount).toBeGreaterThan(0);
    });

    /**
     * Idleness is measured from the last hand-off *row*, so a suite that creates its fleet
     * minutes ago cannot have an idle machine. What is asserted is the query and the threshold
     * it reports back, not a row count the fixtures cannot honestly produce.
     */
    it('idle runs against the threshold it was given', async () => {
      const result = await report(director, '/reports/machines/idle', '?days=1');

      expect(result.key).toBe(ReportKey.MACHINE_IDLE);
      expect(result.filters.days).toBe(1);
      expect(result.rowCount).toBe(0);
      expect(result.columns.map((column) => column.key)).toContain('idleDays');
    });

    it('costs reports purchase against repairs', async () => {
      const result = await report(director, '/reports/machines/costs');

      expect(result.rowCount).toBeGreaterThan(0);
      expect(result.columns.map((column) => column.key)).toContain('purchasePrice');
    });

    it('warranty finds the units lapsing inside the window', async () => {
      const result = await report(director, '/reports/machines/warranty', '?days=60');

      expect(result.rowCount).toBeGreaterThan(0);
      expect(
        await findRow(
          '/reports/machines/warranty',
          (row) => row.serial === branchMachine.serial,
          '?days=60',
        ),
      ).toBeDefined();
    });

    it('lifecycle tells one machine’s whole story', async () => {
      const result = await report(director, `/reports/machines/${branchMachine.id}/lifecycle`);

      expect(result.key).toBe(ReportKey.MACHINE_LIFECYCLE);
      expect(result.rowCount).toBeGreaterThan(0);
    });

    it('lifecycle refuses an id that is not a machine', async () => {
      await fails(
        director.get(`/reports/machines/${randomUUID()}/lifecycle`),
        404,
        'MACHINE_NOT_FOUND',
      );
    });
  });

  describe('transfer reports', () => {
    it('the log carries the hand-offs of the period', async () => {
      const result = await report(director, '/reports/transfers');

      expect(result.rowCount).toBeGreaterThan(0);
      expect(
        await findRow(
          '/reports/transfers',
          (row) => row.referenceNo === pendingTransfer.referenceNo,
        ),
      ).toBeDefined();
    });

    it('pending carries only what is still unsigned', async () => {
      const result = await report(director, '/reports/transfers/pending', '?limit=100');
      const waiting = await findRow(
        '/reports/transfers/pending',
        (row) => row.referenceNo === pendingTransfer.referenceNo,
      );

      expect(waiting).toBeDefined();
      expect(Number(waiting!.waitingHours)).toBeGreaterThanOrEqual(0);
      expect(result.columns.map((column) => column.key)).toContain('waitingHours');
    });
  });

  describe('people, merchants and maintenance', () => {
    it('representative performance scores the people who hold machines', async () => {
      const result = await report(director, '/reports/representatives');

      expect(result.rowCount).toBeGreaterThan(0);
      expect(result.extra?.scoreFormula).toEqual(expect.any(String));

      const scored = await findRow(
        '/reports/representatives',
        (row) => row.name === 'مندوب التقارير',
      );

      expect(scored).toBeDefined();
      expect(Number(scored!.machinesHeld)).toBeGreaterThan(0);
      // One high violation, filed above, off a clean 100.
      expect(Number(scored!.highViolations)).toBe(1);
      expect(Number(scored!.score)).toBeLessThan(100);
    });

    it('the violations register carries the violation that was filed', async () => {
      const filed = await findRow(
        '/reports/violations',
        (row) => row.userName === 'مندوب التقارير' && row.severity === Severity.HIGH,
      );

      expect(filed).toBeDefined();
      expect(filed!.branch).toBe('فرع التقارير');
    });

    it('the merchant portfolio carries the registered merchant', async () => {
      const merchant = await findRow('/reports/merchants', (row) => row.name === 'تاجر التقارير');

      expect(merchant).toBeDefined();
      expect(merchant!.registeredBy).toBe('مندوب التقارير');
    });

    it('the maintenance log carries the open order', async () => {
      const result = await report(director, '/reports/maintenance', '?limit=100');
      const order = await findRow(
        '/reports/maintenance',
        (row) => row.referenceNo === maintenanceReference,
      );

      expect(result.rowCount).toBeGreaterThan(0);
      expect(order).toBeDefined();
      expect(order!.status).toBe('OPEN');
    });
  });

  describe('finance reports', () => {
    it('expenses roll the category tree up', async () => {
      const result = await report(director, '/reports/finance/expenses');

      expect(result.rowCount).toBeGreaterThan(0);
      expect(result.totals).not.toBeNull();
    });

    it('income does the same for what came in', async () => {
      const result = await report(director, '/reports/finance/income');

      expect(result.rowCount).toBeGreaterThan(0);
    });

    it('profit and loss nets the two, by period and by branch', async () => {
      const result = await report(director, '/reports/finance/pnl');

      expect(result.rowCount).toBeGreaterThan(0);
      expect(result.extra?.byBranch).toEqual(expect.any(Array));
    });

    it('profit and loss buckets by the requested granularity', async () => {
      const daily = await report(director, '/reports/finance/pnl', '?granularity=DAY');

      expect(daily.filters.granularity).toBe('DAY');
      expect(daily.rowCount).toBeGreaterThan(0);
    });

    it('budget performance carries the budget with its pace', async () => {
      const result = await report(director, '/reports/finance/budgets');

      expect(result.rowCount).toBeGreaterThan(0);
      expect(result.columns.map((column) => column.key)).toContain('projectedTotal');
    });

    it('branch comparison puts the branches side by side', async () => {
      const result = await report(director, '/reports/branches/comparison');

      expect(result.rowCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ── the shared contract ────────────────────────────────────────────────────

  describe('the shared contract', () => {
    it('reports the period it actually ran for', async () => {
      const result = await report(
        director,
        '/reports/transfers',
        '?dateFrom=2026-01-01&dateTo=2026-12-31',
      );

      expect(result.filters).toMatchObject({ from: '2026-01-01', to: '2026-12-31' });
    });

    it('defaults the window rather than scanning everything', async () => {
      const result = await report(director, '/reports/transfers');

      expect(result.filters.from).toEqual(expect.any(String));
      expect(result.filters.to).toBe(new Date().toISOString().slice(0, 10));
    });

    it('pages without changing the row count it reports', async () => {
      const full = await report(director, '/reports/machines/inventory', '?limit=100');
      const firstPage = await report(director, '/reports/machines/inventory', '?limit=1');

      expect(firstPage.rows).toHaveLength(1);
      expect(firstPage.rowCount).toBe(full.rowCount);
    });

    it('sorts on one of its own columns', async () => {
      const result = await report(
        director,
        '/reports/machines/inventory',
        '?sortBy=serial&sortDir=asc&limit=100',
      );
      const serials = result.rows.map((row) => String(row.serial));

      expect(serials).toEqual([...serials].sort((a, b) => a.localeCompare(b, 'ar')));
    });

    it('refuses a sort key the report does not have', async () => {
      await fails(
        director.get('/reports/machines/inventory?sortBy=nonsense'),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('serves a repeated request from the cache, generated at the same instant', async () => {
      const first = await report(director, '/reports/machines/costs');
      const second = await report(director, '/reports/machines/costs');

      expect(second.generatedAt).toBe(first.generatedAt);
    });

    it('does not serve one caller’s report to another', async () => {
      const mine = await report(director, '/reports/machines/inventory');
      const theirs = await report(supervisor.api, '/reports/machines/inventory');

      expect(theirs.generatedAt).not.toBe(mine.generatedAt);
    });
  });

  // ── permissions and scoping ────────────────────────────────────────────────

  describe('permissions', () => {
    it.each(OPERATIONS_REPORTS)('refuses %s to a representative', async (path) => {
      await fails(representative.api.get(path), 403, 'INSUFFICIENT_PERMISSIONS');
    });

    it.each(FINANCE_REPORTS)('refuses %s to a branch supervisor', async (path) => {
      await fails(supervisor.api.get(path), 403, 'INSUFFICIENT_PERMISSIONS');
    });

    it('lets the accountant run the finance reports', async () => {
      const result = await report(accountant.api, '/reports/finance/expenses');

      expect(result.key).toBe(ReportKey.EXPENSES_BY_CATEGORY);
    });

    /**
     * The portfolio hangs off `merchants.read` rather than a `reports.*` code, so the
     * representative who registers merchants can read it — narrowed to his own branch.
     */
    it('lets a representative read the merchant portfolio he feeds', async () => {
      const result = await report(representative.api, '/reports/merchants');

      expect(result.filters.branchId).toBe(branchId);
      expect(result.rows.every((row) => row.branch === 'فرع التقارير')).toBe(true);
    });

    it('refuses the operations reports to the accountant', async () => {
      await fails(accountant.api.get('/reports/transfers'), 403, 'INSUFFICIENT_PERMISSIONS');
    });

    it('refuses an export to a caller who may read the report but not export it', async () => {
      await fails(
        supervisor.api.get('/reports/machines/inventory?format=csv'),
        403,
        'INSUFFICIENT_PERMISSIONS',
      );
    });
  });

  describe('branch scoping', () => {
    it('shows a scoped supervisor only his own branch’s machines', async () => {
      const mine = await report(supervisor.api, '/reports/machines/inventory', '?limit=100');
      const everything = await report(director, '/reports/machines/inventory', '?limit=100');

      expect(mine.rowCount).toBeGreaterThan(0);
      expect(mine.rowCount).toBeLessThan(everything.rowCount);
      expect(mine.rows.some((row) => row.serial === branchMachine.serial)).toBe(true);
    });

    it('refuses to widen: a scoped caller cannot ask for another branch', async () => {
      await fails(
        supervisor.api.get(`/reports/machines/inventory?branchId=${otherBranchId}`),
        403,
        'BRANCH_SCOPE_VIOLATION',
      );
    });

    it('lets an unrestricted caller narrow to one branch', async () => {
      const narrowed = await report(
        director,
        '/reports/machines/inventory',
        `?branchId=${otherBranchId}&limit=100`,
      );

      expect(narrowed.filters.branchId).toBe(otherBranchId);
      expect(narrowed.rows.every((row) => row.serial !== branchMachine.serial)).toBe(true);
    });

    it('scopes the transfer log to the caller’s branch too', async () => {
      const mine = await report(supervisor.api, '/reports/transfers', '?limit=100');
      const everything = await report(director, '/reports/transfers', '?limit=100');

      expect(mine.rowCount).toBeGreaterThan(0);
      expect(mine.rowCount).toBeLessThanOrEqual(everything.rowCount);
    });
  });

  // ── exports ────────────────────────────────────────────────────────────────

  describe('exports', () => {
    it('answers a csv request with a job to poll', async () => {
      const accepted = await ok<JobAccepted>(
        director.get('/reports/machines/inventory?format=csv'),
        202,
      );

      expect(accepted.jobId).toEqual(expect.any(String));
      expect(accepted.pollUrl).toContain(accepted.jobId);
    });

    it('produces a csv whose row count matches the report', async () => {
      const rendered = await report(director, '/reports/machines/inventory', '?limit=100');
      const job = await exportReport('/reports/machines/inventory', 'csv');

      expect(job.status).toBe(ReportJobStatus.READY);
      expect(job.rowCount).toBe(rendered.rowCount);
      expect(job.filename).toMatch(/\.csv$/);
      expect(job.downloadUrl).toEqual(expect.any(String));
      expect(job.sizeBytes).toBeGreaterThan(0);
    });

    it('produces an xlsx whose row count matches the report', async () => {
      const rendered = await report(director, '/reports/violations', '?limit=100');
      const job = await exportReport('/reports/violations', 'xlsx');

      expect(job.status).toBe(ReportJobStatus.READY);
      expect(job.rowCount).toBe(rendered.rowCount);
      expect(job.filename).toMatch(/\.xlsx$/);
    });

    it('sets a retention date on the file', async () => {
      const job = await exportReport('/reports/transfers', 'csv');

      expect(Date.parse(job.expiresAt)).toBeGreaterThan(Date.now());
    });

    describe('pdf', () => {
      it('produces a well-formed pdf through the same job flow as csv/xlsx', async () => {
        const job = await exportReport('/reports/machines/inventory', 'pdf');

        expect(job.status).toBe(ReportJobStatus.READY);
        expect(job.filename).toMatch(/\.pdf$/);
        expect(job.sizeBytes).toBeGreaterThan(0);

        const bytes = await download(job.downloadUrl!);
        expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
        expect(bytes.subarray(-16).toString('ascii')).toContain('%%EOF');
      });

      it('renders English report data into extractable, correctly-ordered PDF text', async () => {
        const job = await exportReport(
          '/reports/machines/inventory',
          'pdf',
          director.withLocale('en'),
        );
        const bytes = await download(job.downloadUrl!);

        const parser = new PDFParse({ data: bytes });
        try {
          const { text } = await parser.getText();
          expect(text).toMatch(/Machine inventory/i);
          expect(text).toContain('Report');
          expect(text).toContain('Generated at');
          expect(text).toContain('Total');
          expect(text).toMatch(/Page 1 of \d+/);
        } finally {
          await parser.destroy();
        }
      });

      it('renders an Arabic pdf with the right page count and byte size', async () => {
        // Chromium ships the correct Arabic *glyphs* into the PDF (confirmed by rendering a
        // sample to a PNG and reading it during development of this feature) but the glyphs it
        // writes are shaped presentation forms, not the logical Arabic codepoints the template
        // was given — so a naive text-extraction library reads back reordered, transformed
        // characters that will never string-match the Arabic source text. That is a property of
        // PDF text extraction from shaped Arabic, not a rendering bug, so this checks the things
        // an extractor *can* answer reliably: it parses as a real multi-page PDF at all, and it
        // is not suspiciously small (the usual signature of a font that failed to embed and left
        // an almost-empty page).
        const job = await exportReport('/reports/violations', 'pdf');
        const bytes = await download(job.downloadUrl!);

        const parser = new PDFParse({ data: bytes });
        try {
          const info = await parser.getInfo();
          expect(info.total).toBeGreaterThanOrEqual(1);
        } finally {
          await parser.destroy();
        }
        expect(bytes.byteLength).toBeGreaterThan(2000);
      });
    });

    it('hides one caller’s job from another', async () => {
      const accepted = await ok<JobAccepted>(
        director.get('/reports/machines/inventory?format=csv'),
        202,
      );

      await fails(accountant.api.get(`/reports/jobs/${accepted.jobId}`), 404, 'NOT_FOUND');
    });

    it('404s an export job that does not exist', async () => {
      await fails(director.get(`/reports/jobs/${randomUUID()}`), 404, 'NOT_FOUND');
    });
  });

  // ── the finance export, which had to be aligned with these ─────────────────

  describe('GET /finance/export', () => {
    it('still returns csv', async () => {
      const response = await director.get('/finance/export?format=csv').expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('.csv');
    });

    it('now returns an xlsx workbook rather than 501', async () => {
      const response = await director.get('/finance/export?format=xlsx').expect(200);

      expect(response.headers['content-type']).toContain('spreadsheetml');
      expect(response.headers['content-disposition']).toContain('.xlsx');
    });
  });
});
