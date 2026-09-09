import { ConfigService } from '@nestjs/config';
import { NotificationsConfig } from 'src/config/notifications.config';
import { NotificationSchedulerService } from '../services/notification-scheduler.service';
import { NotificationSweepsService, SweepResult } from '../services/notification-sweeps.service';

const EMPTY: SweepResult = { examined: 0, notified: 0 };

function scheduler(): { service: NotificationSchedulerService; ran: string[] } {
  const ran: string[] = [];

  const sweeps = {
    runAndLog: async (name: string, sweep: () => Promise<SweepResult>) => {
      ran.push(name);
      return sweep();
    },
    transferReminders: () => Promise.resolve(EMPTY),
    maintenanceSweep: () => Promise.resolve(EMPTY),
    budgetSweep: () => Promise.resolve(EMPTY),
    warrantyCheck: () => Promise.resolve(EMPTY),
    subscriptionDues: () => Promise.resolve(EMPTY),
    idleMachines: () => Promise.resolve(EMPTY),
    decommissionCandidates: () => Promise.resolve(EMPTY),
  } as unknown as NotificationSweepsService;

  const config = {
    getOrThrow: () =>
      ({ localUtcOffsetMinutes: 120, schedulerEnabled: false }) as NotificationsConfig,
  } as unknown as ConfigService;

  return { service: new NotificationSchedulerService(sweeps, config), ran };
}

/** UTC instants chosen so the Cairo (+02:00) wall clock reads the hour each job is due at. */
const AT_LOCAL_MIDDAY = new Date('2026-09-08T10:00:00.000Z');
const AT_LOCAL_0200_TUESDAY = new Date('2026-09-08T00:00:00.000Z');
const AT_LOCAL_0400_SUNDAY = new Date('2026-09-13T02:00:00.000Z');

describe('NotificationSchedulerService.tick', () => {
  it('runs only the hourly sweeps at an hour nothing else is due at', async () => {
    const { service } = scheduler();

    expect(await service.tick(AT_LOCAL_MIDDAY)).toEqual([
      'transfer-reminders',
      'notification-maintenance',
    ]);
  });

  it('runs a daily sweep in its own local hour', async () => {
    const { service } = scheduler();

    expect(await service.tick(AT_LOCAL_0200_TUESDAY)).toContain('budget-sweep');
  });

  it('does not run a daily sweep outside its hour', async () => {
    const { service } = scheduler();

    expect(await service.tick(AT_LOCAL_MIDDAY)).not.toContain('budget-sweep');
  });

  it('runs a weekly sweep only on its weekday', async () => {
    const { service } = scheduler();

    expect(await service.tick(AT_LOCAL_0400_SUNDAY)).toContain('idle-machines');
  });

  it('holds a weekly sweep back on the right hour of the wrong day', async () => {
    const { service } = scheduler();

    // 04:00 Cairo on a Tuesday: the hour matches, the weekday does not.
    expect(await service.tick(new Date('2026-09-08T02:00:00.000Z'))).not.toContain('idle-machines');
  });

  it('runs a daily sweep once however many ticks fall inside its hour', async () => {
    const { service } = scheduler();

    await service.tick(AT_LOCAL_0200_TUESDAY);

    expect(await service.tick(new Date('2026-09-08T00:45:00.000Z'))).not.toContain('budget-sweep');
  });

  it('runs it again the next day', async () => {
    const { service } = scheduler();

    await service.tick(AT_LOCAL_0200_TUESDAY);

    expect(await service.tick(new Date('2026-09-09T00:00:00.000Z'))).toContain('budget-sweep');
  });

  it('delegates the work rather than doing any of its own', async () => {
    const { service, ran } = scheduler();

    await service.tick(AT_LOCAL_0200_TUESDAY);

    expect(ran).toContain('budget-sweep');
  });
});
