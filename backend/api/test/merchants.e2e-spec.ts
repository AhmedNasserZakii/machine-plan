import { randomUUID } from 'node:crypto';
import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { SubscriptionPlanType } from 'src/common/enums/finance.enum';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { SignatureMethod, TransferType } from 'src/common/enums/transfer.enum';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { Api, fails, ok, okPage } from './utils/api-client';
import {
  createBranch,
  createMerchant,
  MerchantFixture,
  loginAsDirector,
  provisionUser,
  ProvisionedUser,
  roleIdByCode,
  uniqueCode,
  uniquePhone,
} from './utils/fixtures';
import { createTestApp } from './utils/test-app';

interface MerchantResponse {
  id: string;
  name: string;
  shopName: string;
  phone: string;
  nationalId: string | null;
  branch: { id: string; name: string } | null;
  registeredBy: { id: string; fullName: string } | null;
  machinesCount: number;
  activeSubscription: SubscriptionResponse | null;
  totalPaid: number;
  isActive: boolean;
}

interface SubscriptionResponse {
  id: string;
  planType: SubscriptionPlanType;
  machineId: string | null;
  amount: number;
  startDate: string;
  nextDueDate: string | null;
  isOverdue: boolean;
  totalCollected: number;
  collectionCount: number;
  isActive: boolean;
}

interface PaymentMethodResponse {
  id: string;
  code: string;
}

interface MachineResponse {
  id: string;
  serial: string;
  status: MachineStatus;
}

interface MachineModelResponse {
  id: string;
  machineType: { id: string; requiresSim: boolean };
}

const DRAWN = { method: SignatureMethod.DRAWN_SIGNATURE, deviceModel: 'e2e' };

describe('Merchants (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;

  let branchId: string;
  let supervisor: ProvisionedUser;
  let representative: ProvisionedUser;
  /** A second rep in the same branch, to prove one cannot browse the other's book of trade. */
  let otherRepresentative: ProvisionedUser;

  let posModelId: string;
  let cashMethodId: string;

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);

    branchId = (await createBranch(director, 'فرع التجار')).id;

    supervisor = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
      branchId,
      fullName: 'مشرف التجار',
    });

    representative = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
      branchId,
      fullName: 'مندوب التجار',
    });

    otherRepresentative = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
      branchId,
      fullName: 'مندوب آخر',
    });

    const models = await ok<MachineModelResponse[]>(director.get('/machine-models'));
    posModelId = models.find((model) => model.machineType.requiresSim)!.id;

    const methods = await ok<PaymentMethodResponse[]>(director.get('/payment-methods'));
    cashMethodId = methods[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── registration ───────────────────────────────────────────────────────────

  describe('registration', () => {
    it('takes the branch and the registrar from the caller, never the body', async () => {
      const merchant = await createMerchant(representative.api, 'تاجر الفرع');

      const detail = await ok<MerchantResponse>(director.get(`/merchants/${merchant.id}`));

      expect(detail.branch?.id).toBe(branchId);
      expect(detail.registeredBy?.id).toBe(representative.id);
      expect(detail.isActive).toBe(true);
      expect(detail.machinesCount).toBe(0);
    });

    it('rejects a merchant with no address', async () => {
      await fails(
        representative.api.post('/merchants', {
          name: 'تاجر بلا عنوان',
          phone: uniquePhone(),
          shopName: 'محل',
        }),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('rejects a national ID that is not fourteen digits', async () => {
      await fails(
        representative.api.post('/merchants', {
          name: 'تاجر',
          phone: uniquePhone(),
          shopName: 'محل',
          address: 'شارع الاختبار',
          nationalId: '123',
        }),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('refuses a national ID already registered to someone else', async () => {
      const nationalId = `2980101${String(Date.now()).slice(-7)}`;

      await ok(
        representative.api.post('/merchants', {
          name: 'صاحب الرقم القومي',
          phone: uniquePhone(),
          shopName: 'محل',
          address: 'شارع الاختبار',
          nationalId,
        }),
        201,
      );

      await fails(
        representative.api.post('/merchants', {
          name: 'منتحل',
          phone: uniquePhone(),
          shopName: 'محل آخر',
          address: 'شارع آخر',
          nationalId,
        }),
        409,
        'DUPLICATE_NATIONAL_ID',
      );
    });

    /**
     * The rule that matters most in the field: a shop and its owner share a line often enough
     * that blocking a repeated phone would only teach representatives to invent numbers.
     */
    it('warns about a duplicate phone but still allows the registration', async () => {
      const phone = uniquePhone();

      const first = await ok<MerchantResponse>(
        representative.api.post('/merchants', {
          name: 'التاجر الأول',
          phone,
          shopName: 'المحل الأول',
          address: 'شارع الاختبار',
        }),
        201,
      );

      const check = await ok<{ warnings: string[]; existing: { id: string }[] }>(
        representative.api.post('/merchants/check', { phone }),
      );

      expect(check.warnings).toContain('DUPLICATE_PHONE');
      expect(check.existing.map((row) => row.id)).toContain(first.id);

      // And it goes through anyway.
      await ok(
        representative.api.post('/merchants', {
          name: 'التاجر الثاني',
          phone,
          shopName: 'المحل الثاني',
          address: 'شارع آخر',
        }),
        201,
      );
    });

    it('reports a clean check when nothing matches', async () => {
      const check = await ok<{ warnings: string[] }>(
        representative.api.post('/merchants/check', { phone: uniquePhone() }),
      );

      expect(check.warnings).toEqual([]);
    });
  });

  // ── visibility ─────────────────────────────────────────────────────────────

  describe('who can see whose merchants', () => {
    let mine: MerchantFixture;
    let theirs: MerchantFixture;

    beforeAll(async () => {
      mine = await createMerchant(representative.api, 'تاجري');
      theirs = await createMerchant(otherRepresentative.api, 'تاجر زميلي');
    });

    it('shows a representative only the shops he registered', async () => {
      const { items } = await okPage<MerchantResponse>(
        representative.api.get('/merchants?limit=100'),
      );

      const ids = items.map((row) => row.id);
      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(theirs.id);
    });

    it("hides another representative's merchant behind a 404 rather than a 403", async () => {
      // A 403 would confirm the id names something real, which is a different leak.
      await fails(representative.api.get(`/merchants/${theirs.id}`), 404, 'NOT_FOUND');
    });

    it('shows a supervisor the whole branch', async () => {
      const { items } = await okPage<MerchantResponse>(supervisor.api.get('/merchants?limit=100'));

      const ids = items.map((row) => row.id);
      expect(ids).toContain(mine.id);
      expect(ids).toContain(theirs.id);
    });

    it('shows the director everything', async () => {
      await ok<MerchantResponse>(director.get(`/merchants/${theirs.id}`));
    });

    it('offers a representative only his own shops in the transfer picker', async () => {
      const recipients = await ok<{ id: string }[]>(
        representative.api.get(
          `/transfers/recipients?type=${TransferType.REPRESENTATIVE_TO_MERCHANT}`,
        ),
      );

      const ids = recipients.map((row) => row.id);
      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(theirs.id);
    });
  });

  // ── deactivation ───────────────────────────────────────────────────────────

  describe('closing a merchant out', () => {
    let serialCounter = 0;

    async function machineWithRepresentative(): Promise<MachineResponse> {
      serialCounter += 1;
      const tag = `${uniqueCode('M')}_${serialCounter}`;

      const machine = await ok<MachineResponse>(
        director.post('/machines', {
          serial: `SN-${tag}`,
          machineModelId: posModelId,
          simSerial: `SIM-${tag}`,
          battery: { serial: `BT-${tag}` },
          hasBox: false,
        }),
        201,
      );

      const warehouses = await ok<{ id: string; type: string }[]>(director.get('/warehouses'));
      const branchWarehouse = warehouses.find((w) => w.type === 'COMPANY_MAIN')!;
      void branchWarehouse;

      const toBranch = await ok<{ id: string; payloadHash: string }>(
        director.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.COMPANY_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [{ machineId: machine.id, hasCharger: true, hasBox: false, condition: 'GOOD' }],
        }),
        201,
      );

      await ok(
        supervisor.api.post(`/transfers/${toBranch.id}/confirm`, {
          signature: DRAWN,
          payloadHash: toBranch.payloadHash,
        }),
      );

      const toRep = await ok<{ id: string; payloadHash: string }>(
        supervisor.api.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.BRANCH_TO_REPRESENTATIVE,
          toPartyId: representative.id,
          occurredAt: new Date().toISOString(),
          items: [{ machineId: machine.id, hasCharger: true, hasBox: false, condition: 'GOOD' }],
        }),
        201,
      );

      await ok(
        representative.api.post(`/transfers/${toRep.id}/confirm`, {
          signature: DRAWN,
          payloadHash: toRep.payloadHash,
        }),
      );

      return machine;
    }

    it('closes out a merchant who holds nothing', async () => {
      const merchant = await createMerchant(representative.api, 'تاجر منتهي');

      const closed = await ok<MerchantResponse>(
        director.patch(`/merchants/${merchant.id}/deactivate`),
      );

      expect(closed.isActive).toBe(false);
    });

    /**
     * The rule from `08`: the machines have to come back through a hand-off first. Closing the
     * merchant with units still out would leave the fleet with no idea where they are.
     */
    it('refuses while the merchant still holds machines, and names the serials', async () => {
      const merchant = await createMerchant(representative.api, 'تاجر بعهدة');
      const machine = await machineWithRepresentative();

      await ok(
        representative.api.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.REPRESENTATIVE_TO_MERCHANT,
          toPartyId: merchant.id,
          occurredAt: new Date().toISOString(),
          items: [{ machineId: machine.id, hasCharger: true, hasBox: false, condition: 'GOOD' }],
          senderSignature: DRAWN,
        }),
        201,
      );

      const detail = await ok<MerchantResponse>(director.get(`/merchants/${merchant.id}`));
      expect(detail.machinesCount).toBe(1);

      const error = await fails(
        director.patch(`/merchants/${merchant.id}/deactivate`),
        409,
        'MERCHANT_HAS_MACHINES',
      );

      expect(error.details?.map((detail) => detail.value)).toContain(machine.serial);

      // And once it comes back, the merchant closes out cleanly.
      await ok(
        representative.api.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.MERCHANT_TO_REPRESENTATIVE,
          toPartyId: representative.id,
          occurredAt: new Date().toISOString(),
          items: [{ machineId: machine.id, hasCharger: true, hasBox: false, condition: 'GOOD' }],
          senderSignature: DRAWN,
        }),
        201,
      );

      const closed = await ok<MerchantResponse>(
        director.patch(`/merchants/${merchant.id}/deactivate`),
      );
      expect(closed.isActive).toBe(false);
    });
  });

  // ── subscriptions ──────────────────────────────────────────────────────────

  describe('subscriptions', () => {
    let merchantId: string;

    beforeAll(async () => {
      merchantId = (await createMerchant(representative.api, 'تاجر مشترك')).id;
    });

    it('starts a monthly plan due on the start date', async () => {
      const merchant = (await createMerchant(representative.api, 'تاجر شهري')).id;

      const plan = await ok<SubscriptionResponse>(
        director.post(`/merchants/${merchant}/subscriptions`, {
          planType: SubscriptionPlanType.MONTHLY,
          amount: 350,
          startDate: '2026-09-01',
        }),
        201,
      );

      expect(plan.nextDueDate).toBe('2026-09-01');
      expect(plan.amount).toBe(350);
      expect(plan.isActive).toBe(true);
    });

    it('rejects a priced NONE plan', async () => {
      await fails(
        director.post(`/merchants/${merchantId}/subscriptions`, {
          planType: SubscriptionPlanType.NONE,
          amount: 100,
          startDate: '2026-09-01',
        }),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('generates no due date for a free arrangement', async () => {
      const merchant = (await createMerchant(representative.api, 'تاجر مجاني')).id;

      const plan = await ok<SubscriptionResponse>(
        director.post(`/merchants/${merchant}/subscriptions`, {
          planType: SubscriptionPlanType.NONE,
          amount: 0,
          startDate: '2026-09-01',
        }),
        201,
      );

      expect(plan.nextDueDate).toBeNull();
    });

    it('refuses a second live merchant-wide plan', async () => {
      const merchant = (await createMerchant(representative.api, 'تاجر مزدوج')).id;

      await ok(
        director.post(`/merchants/${merchant}/subscriptions`, {
          planType: SubscriptionPlanType.MONTHLY,
          amount: 200,
          startDate: '2026-09-01',
        }),
        201,
      );

      // Two live plans would silently double-bill on the overdue sweep, and the merchant would be
      // the one to discover it.
      await fails(
        director.post(`/merchants/${merchant}/subscriptions`, {
          planType: SubscriptionPlanType.MONTHLY,
          amount: 300,
          startDate: '2026-10-01',
        }),
        409,
        'VALIDATION_FAILED',
      );
    });

    describe('collecting', () => {
      it('records the payment and rolls a monthly plan forward one month', async () => {
        const merchant = (await createMerchant(representative.api, 'تاجر يدفع')).id;

        const plan = await ok<SubscriptionResponse>(
          director.post(`/merchants/${merchant}/subscriptions`, {
            planType: SubscriptionPlanType.MONTHLY,
            amount: 350,
            startDate: '2026-09-01',
          }),
          201,
        );

        const collected = await ok<SubscriptionResponse>(
          director.post(`/subscriptions/${plan.id}/collect`, {
            amount: 350,
            collectedAt: '2026-09-05T10:00:00.000Z',
            paymentMethodId: cashMethodId,
          }),
        );

        expect(collected.totalCollected).toBe(350);
        expect(collected.collectionCount).toBe(1);
        expect(collected.nextDueDate).toBe('2026-10-01');

        // Rolling from the *due* date, not the payment date: a merchant who pays late still owes
        // the following month on the first.
        const again = await ok<SubscriptionResponse>(
          director.post(`/subscriptions/${plan.id}/collect`, {
            amount: 350,
            collectedAt: '2026-10-20T10:00:00.000Z',
            paymentMethodId: cashMethodId,
          }),
        );

        expect(again.nextDueDate).toBe('2026-11-01');
        expect(again.totalCollected).toBe(700);
      });

      it('rolls a weekly plan forward seven days', async () => {
        const merchant = (await createMerchant(representative.api, 'تاجر أسبوعي')).id;

        const plan = await ok<SubscriptionResponse>(
          director.post(`/merchants/${merchant}/subscriptions`, {
            planType: SubscriptionPlanType.WEEKLY,
            amount: 100,
            startDate: '2026-09-01',
          }),
          201,
        );

        const collected = await ok<SubscriptionResponse>(
          director.post(`/subscriptions/${plan.id}/collect`, {
            amount: 100,
            collectedAt: '2026-09-01T10:00:00.000Z',
            paymentMethodId: cashMethodId,
          }),
        );

        expect(collected.nextDueDate).toBe('2026-09-08');
      });

      it('clears the due date once a one-off fee is paid', async () => {
        const merchant = (await createMerchant(representative.api, 'تاجر رسم واحد')).id;

        const plan = await ok<SubscriptionResponse>(
          director.post(`/merchants/${merchant}/subscriptions`, {
            planType: SubscriptionPlanType.ONE_TIME_FEE,
            amount: 1000,
            startDate: '2026-09-01',
          }),
          201,
        );

        const collected = await ok<SubscriptionResponse>(
          director.post(`/subscriptions/${plan.id}/collect`, {
            amount: 1000,
            collectedAt: '2026-09-02T10:00:00.000Z',
            paymentMethodId: cashMethodId,
          }),
        );

        expect(collected.nextDueDate).toBeNull();
        expect(collected.totalCollected).toBe(1000);
      });

      it('refuses an unknown payment method', async () => {
        const merchant = (await createMerchant(representative.api, 'تاجر بوسيلة خاطئة')).id;

        const plan = await ok<SubscriptionResponse>(
          director.post(`/merchants/${merchant}/subscriptions`, {
            planType: SubscriptionPlanType.MONTHLY,
            amount: 100,
            startDate: '2026-09-01',
          }),
          201,
        );

        await fails(
          director.post(`/subscriptions/${plan.id}/collect`, {
            amount: 100,
            collectedAt: '2026-09-05T10:00:00.000Z',
            paymentMethodId: randomUUID(),
          }),
          400,
          'VALIDATION_FAILED',
        );
      });

      it('surfaces the live plan and the running total on the merchant', async () => {
        const merchant = (await createMerchant(representative.api, 'تاجر بملخص')).id;

        const plan = await ok<SubscriptionResponse>(
          director.post(`/merchants/${merchant}/subscriptions`, {
            planType: SubscriptionPlanType.MONTHLY,
            amount: 250,
            startDate: '2026-09-01',
          }),
          201,
        );

        await ok(
          director.post(`/subscriptions/${plan.id}/collect`, {
            amount: 250,
            collectedAt: '2026-09-05T10:00:00.000Z',
            paymentMethodId: cashMethodId,
          }),
        );

        const detail = await ok<MerchantResponse>(director.get(`/merchants/${merchant}`));

        expect(detail.activeSubscription?.id).toBe(plan.id);
        expect(detail.totalPaid).toBe(250);
      });
    });

    it('ends a plan without losing what it collected', async () => {
      const merchant = (await createMerchant(representative.api, 'تاجر منتهي الاشتراك')).id;

      const plan = await ok<SubscriptionResponse>(
        director.post(`/merchants/${merchant}/subscriptions`, {
          planType: SubscriptionPlanType.MONTHLY,
          amount: 150,
          startDate: '2026-09-01',
        }),
        201,
      );

      await ok(
        director.post(`/subscriptions/${plan.id}/collect`, {
          amount: 150,
          collectedAt: '2026-09-05T10:00:00.000Z',
          paymentMethodId: cashMethodId,
        }),
      );

      const ended = await ok<SubscriptionResponse>(
        director.patch(`/subscriptions/${plan.id}`, { isActive: false }),
      );

      expect(ended.isActive).toBe(false);
      // Nothing left to chase, but the history stays.
      expect(ended.nextDueDate).toBeNull();
      expect(ended.totalCollected).toBe(150);
    });
  });

  // ── the merchant's story ───────────────────────────────────────────────────

  it('renders a timeline of hand-offs, plans and collections', async () => {
    const merchant = (await createMerchant(representative.api, 'تاجر بتاريخ')).id;

    const plan = await ok<SubscriptionResponse>(
      director.post(`/merchants/${merchant}/subscriptions`, {
        planType: SubscriptionPlanType.MONTHLY,
        amount: 300,
        startDate: '2026-09-01',
      }),
      201,
    );

    await ok(
      director.post(`/subscriptions/${plan.id}/collect`, {
        amount: 300,
        collectedAt: '2026-09-05T10:00:00.000Z',
        paymentMethodId: cashMethodId,
      }),
    );

    const timeline = await ok<{ kind: string; code: string }[]>(
      director.get(`/merchants/${merchant}/timeline`),
    );

    expect(timeline.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining(['SUBSCRIPTION_STARTED', 'COLLECTION']),
    );
  });
});
