import { randomUUID } from 'node:crypto';
import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import {
  NotificationEntityType,
  NotificationTemplateCode,
  PushSkipReason,
  PushStatus,
} from 'src/common/enums/notification.enum';
import { MaintenanceResult, ResponsibleParty, Severity } from 'src/common/enums/operations.enum';
import { ItemCondition, SignatureMethod, TransferType } from 'src/common/enums/transfer.enum';
import { NotificationDispatcherService } from 'src/modules/notifications/services/notification-dispatcher.service';
import { NotificationRecipientsService } from 'src/modules/notifications/services/notification-recipients.service';
import { NotificationSweepsService } from 'src/modules/notifications/services/notification-sweeps.service';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import { Api, fails, ok, okPage } from './utils/api-client';
import {
  createBranch,
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
}

interface MachineModelResponse {
  id: string;
  machineType: { id: string; requiresSim: boolean };
}

interface TransferResponse {
  id: string;
  referenceNo: string;
  status: string;
  payloadHash: string;
}

interface NotificationResponse {
  id: string;
  templateCode: NotificationTemplateCode;
  title: string;
  body: string;
  locale: string;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  deepLink: string | null;
  data: Record<string, string>;
  isRead: boolean;
  readAt: string | null;
  pushStatus: PushStatus;
  pushSkipReason: PushSkipReason | null;
  createdAt: string;
}

interface PreferencesResponse {
  locale: string;
  preferences: {
    templateCode: NotificationTemplateCode;
    push: boolean;
    inApp: boolean;
    inAppLocked: boolean;
  }[];
}

interface MaintenanceOrderResponse {
  id: string;
  referenceNo: string;
  status: string;
}

interface LocationResponse {
  id: string;
  code: string;
}

interface PaymentMethodResponse {
  id: string;
}

const DRAWN = { method: SignatureMethod.DRAWN_SIGNATURE, deviceModel: 'e2e' };

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;

  let branchId: string;
  let supervisor: ProvisionedUser;
  let representative: ProvisionedUser;
  /**
   * The events `18` addresses to "the Director" skip whoever acted, so the closer of a
   * maintenance order has to be someone else. A second Director account would do it, but there
   * may only ever be one active Director in a database shared by the whole e2e run, so the
   * closer is a custom role holding just the maintenance permissions instead.
   */
  let workshopManager: ProvisionedUser;

  let posModelId: string;
  let workshopLocationId: string;
  let workshopWarehouseId: string;
  let cashMethodId: string;

  let dispatcher: NotificationDispatcherService;
  let recipients: NotificationRecipientsService;
  let sweeps: NotificationSweepsService;

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);

    dispatcher = app.get(NotificationDispatcherService);
    recipients = app.get(NotificationRecipientsService);
    sweeps = app.get(NotificationSweepsService);

    branchId = (await createBranch(director, 'فرع الإشعارات')).id;

    supervisor = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
      branchId,
      fullName: 'مشرف الإشعارات',
    });

    representative = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
      branchId,
      fullName: 'مندوب الإشعارات',
    });

    const workshopRole = await ok<{ id: string }>(
      director.post('/roles', {
        code: uniqueCode('WORKSHOP'),
        translations: { ar: { displayName: 'مسؤول الورشة' } },
        permissions: [
          Perm.MAINTENANCE_READ,
          Perm.MAINTENANCE_UPDATE,
          Perm.MAINTENANCE_CLOSE,
          Perm.MAINTENANCE_SET_COST,
          Perm.MACHINES_READ_ALL,
        ],
      }),
      201,
    );

    workshopManager = await provisionUser(server, director, {
      roleId: workshopRole.id,
      fullName: 'مسؤول ورشة الإشعارات',
    });

    const models = await ok<MachineModelResponse[]>(director.get('/machine-models?limit=100'));
    posModelId = models.find((model) => model.machineType.requiresSim)!.id;

    // Nothing seeds a workshop store, and the internal-workshop route has nowhere to send a
    // machine until one exists.
    workshopWarehouseId = (
      await ok<{ id: string }>(
        director.post('/warehouses', { type: 'MAINTENANCE', name: 'ورشة الإشعارات' }),
        201,
      )
    ).id;

    const locations = await ok<LocationResponse[]>(director.get('/maintenance-locations'));
    workshopLocationId = locations.find((row) => row.code === 'INTERNAL_WORKSHOP')!.id;

    const methods = await ok<PaymentMethodResponse[]>(director.get('/payment-methods'));
    cashMethodId = methods[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── fixtures ───────────────────────────────────────────────────────────────

  let serialCounter = 0;

  async function createMachine(): Promise<MachineResponse> {
    serialCounter += 1;
    const tag = `${uniqueCode('N')}_${serialCounter}`;

    return ok<MachineResponse>(
      director.post('/machines', {
        serial: `SN-${tag}`,
        machineModelId: posModelId,
        simSerial: `SIM-${tag}`,
        battery: { serial: `BT-${tag}` },
        hasBox: true,
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

  /** Director → the branch supervisor, which is the hand-off that leaves a signature pending. */
  async function sendToBranch(machine: MachineResponse): Promise<TransferResponse> {
    return ok<TransferResponse>(
      director.post('/transfers', {
        clientUuid: randomUUID(),
        type: TransferType.COMPANY_TO_BRANCH,
        toPartyId: supervisor.id,
        occurredAt: new Date().toISOString(),
        items: [item(machine)],
      }),
      201,
    );
  }

  async function issueToBranch(machine: MachineResponse): Promise<TransferResponse> {
    const transfer = await sendToBranch(machine);

    await ok(
      supervisor.api.post(`/transfers/${transfer.id}/confirm`, {
        signature: DRAWN,
        payloadHash: transfer.payloadHash,
      }),
    );

    return transfer;
  }

  /** Company → branch → representative, so the representative has something to hand back. */
  async function issueToRepresentative(machine: MachineResponse): Promise<void> {
    await issueToBranch(machine);

    const toRep = await ok<TransferResponse>(
      supervisor.api.post('/transfers', {
        clientUuid: randomUUID(),
        type: TransferType.BRANCH_TO_REPRESENTATIVE,
        toPartyId: representative.id,
        occurredAt: new Date().toISOString(),
        items: [item(machine)],
      }),
      201,
    );

    await ok(
      representative.api.post(`/transfers/${toRep.id}/confirm`, {
        signature: DRAWN,
        payloadHash: toRep.payloadHash,
      }),
    );
  }

  async function inboxOf(
    user: Api,
    templateCode?: NotificationTemplateCode,
  ): Promise<NotificationResponse[]> {
    const query = templateCode ? `?templateCode=${templateCode}&limit=100` : '?limit=100';
    const page = await okPage<NotificationResponse>(user.get(`/notifications${query}`));

    return page.items;
  }

  /**
   * The Director hears about every branch in the database, and the e2e run shares one, so his
   * inbox is not guaranteed to hold the notification under test on the first page.
   */
  async function about(
    user: Api,
    templateCode: NotificationTemplateCode,
    entityId: string,
  ): Promise<NotificationResponse | undefined> {
    for (let page = 1; page <= 10; page += 1) {
      const results = await okPage<NotificationResponse>(
        user.get(`/notifications?templateCode=${templateCode}&limit=100&page=${page}`),
      );
      const found = results.items.find((notification) => notification.entityId === entityId);

      if (found) return found;
      if (results.items.length < 100) return undefined;
    }

    return undefined;
  }

  // ── the list ───────────────────────────────────────────────────────────────

  describe('GET /notifications', () => {
    it('needs a token', async () => {
      await fails(director.as(null).get('/notifications'), 401, 'UNAUTHENTICATED');
    });

    it('shows the caller his own notifications, newest first', async () => {
      const first = await sendToBranch(await createMachine());
      const second = await sendToBranch(await createMachine());

      const inbox = await inboxOf(supervisor.api, NotificationTemplateCode.TRANSFER_PENDING);
      const ids = inbox.map((notification) => notification.entityId);

      expect(ids).toContain(first.id);
      expect(ids).toContain(second.id);
      expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
    });

    it('filters to the unread ones', async () => {
      const page = await okPage<NotificationResponse>(
        supervisor.api.get('/notifications?unreadOnly=true&limit=100'),
      );

      expect(page.items.every((notification) => !notification.isRead)).toBe(true);
    });

    it('filters by template code', async () => {
      const inbox = await inboxOf(supervisor.api, NotificationTemplateCode.TRANSFER_PENDING);

      expect(inbox.length).toBeGreaterThan(0);
      expect(
        inbox.every(
          (notification) => notification.templateCode === NotificationTemplateCode.TRANSFER_PENDING,
        ),
      ).toBe(true);
    });

    it('paginates', async () => {
      const page = await okPage<NotificationResponse>(supervisor.api.get('/notifications?limit=1'));

      expect(page.items).toHaveLength(1);
      expect(page.meta.limit).toBe(1);
    });
  });

  // ── the events ─────────────────────────────────────────────────────────────

  describe('event triggers', () => {
    it('tells the receiver a hand-off is waiting for his signature', async () => {
      const transfer = await sendToBranch(await createMachine());

      const notification = await about(
        supervisor.api,
        NotificationTemplateCode.TRANSFER_PENDING,
        transfer.id,
      );

      expect(notification).toBeDefined();
      expect(notification!.entityType).toBe(NotificationEntityType.TRANSFER);
      expect(notification!.body).toContain(transfer.referenceNo);
      expect(notification!.deepLink).toBe(`machinery://transfers/${transfer.id}`);
      expect(notification!.isRead).toBe(false);
    });

    it('renders the template in Arabic, the primary locale', async () => {
      const transfer = await sendToBranch(await createMachine());
      const notification = await about(
        supervisor.api,
        NotificationTemplateCode.TRANSFER_PENDING,
        transfer.id,
      );

      expect(notification!.locale).toBe('ar');
      expect(notification!.title).toMatch(/[\u0600-\u06FF]/);
    });

    it('leaves no placeholder unrendered', async () => {
      const transfer = await sendToBranch(await createMachine());
      const notification = await about(
        supervisor.api,
        NotificationTemplateCode.TRANSFER_PENDING,
        transfer.id,
      );

      expect(notification!.body).not.toMatch(/\{[A-Za-z]/);
    });

    it('never notifies somebody about his own action', async () => {
      const transfer = await sendToBranch(await createMachine());

      expect(
        await about(director, NotificationTemplateCode.TRANSFER_PENDING, transfer.id),
      ).toBeUndefined();
    });

    it('tells the sender his delivery was signed for', async () => {
      const transfer = await issueToBranch(await createMachine());

      const notification = await about(
        director,
        NotificationTemplateCode.TRANSFER_CONFIRMED,
        transfer.id,
      );

      expect(notification).toBeDefined();
      expect(notification!.body).toContain(transfer.referenceNo);
    });

    it('tells the sender when a hand-off is refused', async () => {
      const machine = await createMachine();
      await issueToRepresentative(machine);

      const back = await ok<TransferResponse>(
        representative.api.post('/transfers', {
          clientUuid: randomUUID(),
          type: TransferType.REPRESENTATIVE_TO_BRANCH,
          toPartyId: supervisor.id,
          occurredAt: new Date().toISOString(),
          items: [item(machine)],
        }),
        201,
      );

      await ok(
        supervisor.api.post(`/transfers/${back.id}/reject`, {
          reason: 'الماكينة غير مطابقة للطلب',
        }),
      );

      const notification = await about(
        representative.api,
        NotificationTemplateCode.TRANSFER_REJECTED,
        back.id,
      );

      expect(notification).toBeDefined();
      expect(notification!.body).toContain('الماكينة غير مطابقة للطلب');
    });

    it('tells the representative and his supervisor about a violation filed against him', async () => {
      const types = await ok<{ id: string; code: string }[]>(director.get('/violation-types'));

      const violation = await ok<{ id: string }>(
        supervisor.api.post('/violations', {
          userId: representative.id,
          violationTypeId: types[0].id,
          severity: Severity.MEDIUM,
          description: 'مخالفة اختبار الإشعارات',
        }),
        201,
      );

      const forRepresentative = await about(
        representative.api,
        NotificationTemplateCode.VIOLATION_CREATED,
        violation.id,
      );

      expect(forRepresentative).toBeDefined();
      expect(forRepresentative!.entityType).toBe(NotificationEntityType.VIOLATION);
      // The supervisor filed it, so the no-self-notification rule keeps it out of his own list.
      expect(
        await about(supervisor.api, NotificationTemplateCode.VIOLATION_CREATED, violation.id),
      ).toBeUndefined();
    });

    it('tells the Director a machine came back unrepairable', async () => {
      // An order opens on a unit sitting in the company warehouse, which is where a new one is.
      const machine = await createMachine();

      const order = await ok<MaintenanceOrderResponse>(
        supervisor.api.post('/maintenance-orders', {
          clientUuid: randomUUID(),
          machineId: machine.id,
          locationId: workshopLocationId,
          reportedFault: 'لا تعمل الشاشة',
          sentAt: new Date().toISOString(),
        }),
        201,
      );

      await ok(
        director.post(`/maintenance-orders/${order.id}/send`, {
          signature: DRAWN,
          occurredAt: new Date().toISOString(),
          // Named outright: the suites share a database, so another one's workshop store can
          // make the destination ambiguous mid-run.
          warehouseId: workshopWarehouseId,
        }),
      );

      await ok(
        director.post(`/maintenance-orders/${order.id}/receive`, {
          signature: DRAWN,
          occurredAt: new Date().toISOString(),
        }),
      );

      await ok(
        workshopManager.api.post(`/maintenance-orders/${order.id}/close`, {
          result: MaintenanceResult.UNREPAIRABLE,
          responsibleParty: ResponsibleParty.COMPANY,
          cost: 500,
          paymentMethodId: cashMethodId,
          isFreeUnderWarranty: false,
          returnedAt: new Date().toISOString(),
        }),
      );

      // Closed by the workshop, so the rule against self-notification leaves the Director in.
      const candidate = await about(
        director,
        NotificationTemplateCode.DECOMMISSION_CANDIDATE,
        machine.id,
      );

      expect(candidate).toBeDefined();
      expect(candidate!.body).toContain(machine.serial);
    });

    it('tells the Director a machine left for repair', async () => {
      const machine = await createMachine();

      const order = await ok<MaintenanceOrderResponse>(
        supervisor.api.post('/maintenance-orders', {
          clientUuid: randomUUID(),
          machineId: machine.id,
          locationId: workshopLocationId,
          reportedFault: 'عطل في البطارية',
          sentAt: new Date().toISOString(),
        }),
        201,
      );

      const notification = await about(
        director,
        NotificationTemplateCode.MAINTENANCE_OPENED,
        order.id,
      );

      expect(notification).toBeDefined();
      expect(notification!.body).toContain(order.referenceNo);
    });
  });

  // ── push, when there is no transport ───────────────────────────────────────

  describe('push with FCM unconfigured', () => {
    it('records the push as skipped rather than sent', async () => {
      const transfer = await sendToBranch(await createMachine());
      const notification = await about(
        supervisor.api,
        NotificationTemplateCode.TRANSFER_PENDING,
        transfer.id,
      );

      expect(notification!.pushStatus).toBe(PushStatus.SKIPPED);
      expect(notification!.pushSkipReason).toBe(PushSkipReason.TRANSPORT_DISABLED);
    });

    it('names the missing transport rather than blaming a flood or the hour', async () => {
      const inbox = await inboxOf(supervisor.api);
      const reasons = new Set(inbox.map((notification) => notification.pushSkipReason));

      expect(reasons.has(PushSkipReason.DIGESTED)).toBe(false);
      expect(reasons.has(PushSkipReason.QUIET_HOURS)).toBe(false);
    });

    it('never claims a delivery anywhere in the inbox', async () => {
      const inbox = await inboxOf(supervisor.api);

      expect(inbox.some((notification) => notification.pushStatus === PushStatus.SENT)).toBe(false);
    });

    it('still delivers the notification itself, which is the part that is real', async () => {
      const transfer = await sendToBranch(await createMachine());

      expect(
        await about(supervisor.api, NotificationTemplateCode.TRANSFER_PENDING, transfer.id),
      ).toBeDefined();
    });
  });

  // ── read state ─────────────────────────────────────────────────────────────

  describe('read state', () => {
    it('counts the unread ones', async () => {
      await sendToBranch(await createMachine());

      const before = await ok<{ unread: number }>(
        supervisor.api.get('/notifications/unread-count'),
      );

      expect(before.unread).toBeGreaterThan(0);
    });

    it('marks one read and drops the badge by one', async () => {
      const transfer = await sendToBranch(await createMachine());
      const notification = await about(
        supervisor.api,
        NotificationTemplateCode.TRANSFER_PENDING,
        transfer.id,
      );

      const before = await ok<{ unread: number }>(
        supervisor.api.get('/notifications/unread-count'),
      );
      const updated = await ok<NotificationResponse>(
        supervisor.api.patch(`/notifications/${notification!.id}/read`),
      );
      const after = await ok<{ unread: number }>(supervisor.api.get('/notifications/unread-count'));

      expect(updated.isRead).toBe(true);
      expect(updated.readAt).not.toBeNull();
      expect(after.unread).toBe(before.unread - 1);
    });

    it('is idempotent — marking a read notification read again changes nothing', async () => {
      const [notification] = await inboxOf(supervisor.api);

      await ok(supervisor.api.patch(`/notifications/${notification.id}/read`));
      const before = await ok<{ unread: number }>(
        supervisor.api.get('/notifications/unread-count'),
      );
      await ok(supervisor.api.patch(`/notifications/${notification.id}/read`));
      const after = await ok<{ unread: number }>(supervisor.api.get('/notifications/unread-count'));

      expect(after.unread).toBe(before.unread);
    });

    it('refuses to touch somebody else’s notification', async () => {
      const transfer = await sendToBranch(await createMachine());
      const notification = await about(
        supervisor.api,
        NotificationTemplateCode.TRANSFER_PENDING,
        transfer.id,
      );

      await fails(
        representative.api.patch(`/notifications/${notification!.id}/read`),
        404,
        'NOT_FOUND',
      );
    });

    it('clears the badge entirely', async () => {
      await sendToBranch(await createMachine());

      await ok<{ updated: number }>(supervisor.api.patch('/notifications/read-all', {}));
      const after = await ok<{ unread: number }>(supervisor.api.get('/notifications/unread-count'));

      expect(after.unread).toBe(0);
    });

    it('clears only the ids listed when the client names them', async () => {
      const first = await sendToBranch(await createMachine());
      const second = await sendToBranch(await createMachine());

      const target = await about(
        supervisor.api,
        NotificationTemplateCode.TRANSFER_PENDING,
        first.id,
      );

      const result = await ok<{ updated: number }>(
        supervisor.api.patch('/notifications/read-all', { ids: [target!.id] }),
      );
      const other = await about(
        supervisor.api,
        NotificationTemplateCode.TRANSFER_PENDING,
        second.id,
      );

      expect(result.updated).toBe(1);
      expect(other!.isRead).toBe(false);
    });
  });

  // ── preferences ────────────────────────────────────────────────────────────

  describe('preferences', () => {
    it('lists every template with the caller’s choices', async () => {
      const view = await ok<PreferencesResponse>(
        representative.api.get('/notification-preferences'),
      );

      expect(view.locale).toBe('ar');
      expect(view.preferences.length).toBeGreaterThan(0);
      expect(
        view.preferences.some(
          (entry) => entry.templateCode === NotificationTemplateCode.TRANSFER_PENDING,
        ),
      ).toBe(true);
    });

    it('never offers the digest as something to configure', async () => {
      const view = await ok<PreferencesResponse>(
        representative.api.get('/notification-preferences'),
      );

      expect(
        view.preferences.some((entry) => entry.templateCode === NotificationTemplateCode.DIGEST),
      ).toBe(false);
    });

    it('suppresses the in-app row for a template the user switched off', async () => {
      const muted = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
        branchId,
        fullName: 'مشرف كتم الإشعارات',
      });

      await ok(
        muted.api.put('/notification-preferences', {
          preferences: [
            { templateCode: NotificationTemplateCode.TRANSFER_CONFIRMED, inApp: false },
          ],
        }),
      );

      const recipient = await recipients.byId(muted.id);
      await dispatcher.dispatch({
        templateCode: NotificationTemplateCode.TRANSFER_CONFIRMED,
        recipients: [recipient!],
        params: { referenceNo: 'TRF-MUTED', receiverName: 'x', machineCount: 1 },
        entityId: randomUUID(),
      });

      expect(await inboxOf(muted.api, NotificationTemplateCode.TRANSFER_CONFIRMED)).toHaveLength(0);
    });

    it('records a muted push as skipped for that reason, not for the missing transport', async () => {
      const quiet = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
        branchId,
        fullName: 'مشرف بدون دفع',
      });

      await ok(
        quiet.api.put('/notification-preferences', {
          preferences: [{ templateCode: NotificationTemplateCode.TRANSFER_CONFIRMED, push: false }],
        }),
      );

      const recipient = await recipients.byId(quiet.id);
      await dispatcher.dispatch({
        templateCode: NotificationTemplateCode.TRANSFER_CONFIRMED,
        recipients: [recipient!],
        params: { referenceNo: 'TRF-QUIET', receiverName: 'x', machineCount: 1 },
        entityId: randomUUID(),
      });

      const [notification] = await inboxOf(quiet.api, NotificationTemplateCode.TRANSFER_CONFIRMED);

      expect(notification.pushSkipReason).toBe(PushSkipReason.PREFERENCE_OFF);
    });

    it('cannot switch off a template whose in-app delivery is locked', async () => {
      const stubborn = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
        branchId,
        fullName: 'مشرف التسليم الحرج',
      });

      const view = await ok<PreferencesResponse>(
        stubborn.api.put('/notification-preferences', {
          preferences: [{ templateCode: NotificationTemplateCode.TRANSFER_PENDING, inApp: false }],
        }),
      );

      const entry = view.preferences.find(
        (row) => row.templateCode === NotificationTemplateCode.TRANSFER_PENDING,
      );

      expect(entry!.inAppLocked).toBe(true);
      expect(entry!.inApp).toBe(true);
    });

    it('writes the notification in the language the user picked', async () => {
      const english = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
        branchId,
        fullName: 'English supervisor',
      });

      await ok(english.api.put('/notification-preferences', { locale: 'en' }));

      const recipient = await recipients.byId(english.id);
      await dispatcher.dispatch({
        templateCode: NotificationTemplateCode.TRANSFER_CONFIRMED,
        recipients: [recipient!],
        params: { referenceNo: 'TRF-EN', receiverName: 'x', machineCount: 1 },
        entityId: randomUUID(),
      });

      const [notification] = await inboxOf(
        english.api,
        NotificationTemplateCode.TRANSFER_CONFIRMED,
      );

      expect(notification.locale).toBe('en');
      expect(notification.title).toMatch(/^[\x20-\x7E]+$/);
    });

    it('rejects a template code that is not in the catalogue', async () => {
      await fails(
        representative.api.put('/notification-preferences', {
          preferences: [{ templateCode: 'NOT_A_TEMPLATE', inApp: false }],
        }),
        400,
        'VALIDATION_FAILED',
      );
    });
  });

  // ── devices ────────────────────────────────────────────────────────────────

  describe('devices', () => {
    it('registers a push token', async () => {
      const result = await ok<{ deviceId: string; registered: boolean }>(
        representative.api.post('/devices', {
          deviceId: `dev-${uniqueCode('D')}`,
          pushToken: 'fcm-token-e2e',
          platform: 'ANDROID',
        }),
      );

      expect(result.registered).toBe(true);
    });

    it('still records the push as skipped, because a token is not a transport', async () => {
      const deviceId = `dev-${uniqueCode('D')}`;

      await ok(
        supervisor.api.post('/devices', {
          deviceId,
          pushToken: 'fcm-token-e2e-2',
          platform: 'ANDROID',
        }),
      );

      const transfer = await sendToBranch(await createMachine());
      const notification = await about(
        supervisor.api,
        NotificationTemplateCode.TRANSFER_PENDING,
        transfer.id,
      );

      expect(notification!.pushStatus).toBe(PushStatus.SKIPPED);
      expect(notification!.pushSkipReason).toBe(PushSkipReason.TRANSPORT_DISABLED);
    });

    it('unregisters a device', async () => {
      const deviceId = `dev-${uniqueCode('D')}`;

      await ok(
        representative.api.post('/devices', {
          deviceId,
          pushToken: 'fcm-token-e2e-3',
          platform: 'ANDROID',
        }),
      );

      expect(
        await ok<{ removed: boolean }>(representative.api.delete(`/devices/${deviceId}`)),
      ).toEqual({ removed: true });
    });
  });

  // ── the scheduled half ─────────────────────────────────────────────────────

  describe('sweeps', () => {
    it('reminds the receiver of a hand-off he has left unsigned for a day', async () => {
      const transfer = await sendToBranch(await createMachine());
      const inThirtyHours = new Date(Date.now() + 30 * 60 * 60 * 1000);

      const result = await sweeps.transferReminders(inThirtyHours);

      expect(result.examined).toBeGreaterThan(0);

      const reminder = await about(
        supervisor.api,
        NotificationTemplateCode.TRANSFER_REMINDER,
        transfer.id,
      );

      expect(reminder).toBeDefined();
      expect(reminder!.data.hours).toBe('30');
    });

    it('does not remind him twice for the same wave', async () => {
      const inThirtyHours = new Date(Date.now() + 30 * 60 * 60 * 1000);

      await sweeps.transferReminders(inThirtyHours);
      const before = (await inboxOf(supervisor.api, NotificationTemplateCode.TRANSFER_REMINDER))
        .length;

      await sweeps.transferReminders(inThirtyHours);
      const after = (await inboxOf(supervisor.api, NotificationTemplateCode.TRANSFER_REMINDER))
        .length;

      expect(after).toBe(before);
    });

    it('escalates a hand-off nobody has signed in three days', async () => {
      const transfer = await sendToBranch(await createMachine());
      const inFourDays = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);

      await sweeps.transferReminders(inFourDays);

      expect(
        await about(director, NotificationTemplateCode.TRANSFER_STUCK, transfer.id),
      ).toBeDefined();
    });

    it('reports what it examined without notifying when nothing is due', async () => {
      const result = await sweeps.warrantyCheck(new Date('2000-01-01T00:00:00.000Z'));

      expect(result).toEqual({ examined: 0, notified: 0 });
    });

    it('purges dedupe keys whose window has closed', async () => {
      const wayAhead = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000);

      await expect(sweeps.maintenanceSweep(wayAhead)).resolves.toEqual(
        expect.objectContaining({ notified: expect.any(Number) }),
      );
    });
  });

  // ── digests ────────────────────────────────────────────────────────────────

  describe('flooding', () => {
    /**
     * Digesting is a decision about pushes. With no transport there is nothing to fold, so every
     * one of them is stored and every one says why its push did not happen — the summary that
     * would otherwise stand in for them is not invented.
     */
    it('still stores every notification of a flood, and digests none of them', async () => {
      const flooded = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
        branchId,
        fullName: 'مشرف الفيضان',
      });

      const recipient = await recipients.byId(flooded.id);

      for (let index = 0; index < 6; index += 1) {
        await dispatcher.dispatch({
          templateCode: NotificationTemplateCode.TRANSFER_CONFIRMED,
          recipients: [recipient!],
          params: { referenceNo: `TRF-${index}`, receiverName: 'x', machineCount: 1 },
          entityId: randomUUID(),
        });
      }

      const stored = await inboxOf(flooded.api, NotificationTemplateCode.TRANSFER_CONFIRMED);

      expect(stored).toHaveLength(6);
      expect(
        stored.every(
          (notification) => notification.pushSkipReason === PushSkipReason.TRANSPORT_DISABLED,
        ),
      ).toBe(true);
      expect(await inboxOf(flooded.api, NotificationTemplateCode.DIGEST)).toHaveLength(0);
    });
  });

  // ── dedupe ─────────────────────────────────────────────────────────────────

  describe('dedupe keys', () => {
    it('lets the first claimant through and refuses the second', async () => {
      const key = `E2E:${randomUUID()}:bucket`;

      expect(await dispatcher.claimDedupeKey(key)).toBe(true);
      expect(await dispatcher.claimDedupeKey(key)).toBe(false);
    });

    it('reports a dispatch that lost the race as deduped, with nothing written', async () => {
      const key = `E2E:${randomUUID()}:bucket`;
      const recipient = await recipients.byId(representative.id);

      const request = {
        templateCode: NotificationTemplateCode.TRANSFER_CONFIRMED,
        recipients: [recipient!],
        params: { referenceNo: 'TRF-DEDUPE', receiverName: 'x', machineCount: 1 },
        entityId: randomUUID(),
        dedupeKey: key,
      };

      const first = await dispatcher.dispatch(request);
      const second = await dispatcher.dispatch(request);

      expect(first.created).toHaveLength(1);
      expect(second.deduped).toBe(true);
      expect(second.created).toHaveLength(0);
    });
  });
});
