import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsConfig } from 'src/config/notifications.config';
import { dayBucket, weekBucket } from '../notification-rules';
import { NotificationSweepsService } from './notification-sweeps.service';

/** One scheduled sweep: when it is allowed to run, and the bucket it may only run once per. */
interface ScheduledSweep {
  name: string;
  /** Local hour it is due at. `null` for the hourly jobs, which are due every tick. */
  hour: number | null;
  /** Local weekday it is due on, Sunday being 0. `null` for anything that is not weekly. */
  weekday: number | null;
  bucketOf: (localNow: Date) => string;
  run: () => Promise<unknown>;
}

/** How often the due list is examined. Short enough that a restart cannot skip a whole window. */
const TICK_MS = 15 * 60 * 1000;

const MINUTE_MS = 60 * 1000;

/**
 * The clock behind the sweeps of `18`, and nothing else.
 *
 * A plain interval rather than a cron library, for two reasons. The schedule is six fixed times a
 * day, which is not worth a dependency; and the guarantee a cron would give — fire exactly at
 * 02:00 — is not the guarantee this needs. Each sweep claims a dedupe key before it notifies, so
 * what matters is that a due window is *entered* at least once, not that it is hit on the second.
 * That also makes a missed window after a deploy self-healing: the next tick inside the same hour
 * picks it up, and the tick after that finds the bucket already claimed and does nothing.
 *
 * Every handler is two lines because the work belongs to `NotificationSweepsService`, where it can
 * be called with an explicit `now` and asserted on. A scheduler that contained its own logic would
 * be testable only by waiting for it.
 */
@Injectable()
export class NotificationSchedulerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(NotificationSchedulerService.name);
  private readonly config: NotificationsConfig;
  private readonly lastRun = new Map<string, string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly sweeps: NotificationSweepsService,
    config: ConfigService,
  ) {
    this.config = config.getOrThrow<NotificationsConfig>('notifications');
  }

  onApplicationBootstrap(): void {
    if (!this.config.schedulerEnabled) {
      this.logger.log('Notification sweeps are disabled; no timer is started');
      return;
    }

    // Unref'd so a pending tick cannot hold the process open during a shutdown.
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Runs whichever sweeps are due. Exposed rather than private so the schedule itself can be
   * exercised without a fifteen-minute wait.
   */
  async tick(now = new Date()): Promise<string[]> {
    const local = this.toLocal(now);
    const ran: string[] = [];

    for (const sweep of this.schedule()) {
      if (sweep.hour !== null && local.getUTCHours() !== sweep.hour) continue;
      if (sweep.weekday !== null && local.getUTCDay() !== sweep.weekday) continue;

      const bucket = sweep.bucketOf(local);
      if (this.lastRun.get(sweep.name) === bucket) continue;

      this.lastRun.set(sweep.name, bucket);
      await sweep.run();
      ran.push(sweep.name);
    }

    return ran;
  }

  /** `18`'s job table. The times are the spec's; the buckets are what make them exactly-once. */
  private schedule(): ScheduledSweep[] {
    const hourBucket = (local: Date): string => local.toISOString().slice(0, 13);

    return [
      {
        name: 'transfer-reminders',
        hour: null,
        weekday: null,
        bucketOf: hourBucket,
        run: () =>
          this.sweeps.runAndLog('transfer-reminders', () => this.sweeps.transferReminders()),
      },
      {
        name: 'notification-maintenance',
        hour: null,
        weekday: null,
        bucketOf: hourBucket,
        run: () =>
          this.sweeps.runAndLog('notification-maintenance', () => this.sweeps.maintenanceSweep()),
      },
      {
        name: 'budget-sweep',
        hour: 2,
        weekday: null,
        bucketOf: dayBucket,
        run: () => this.sweeps.runAndLog('budget-sweep', () => this.sweeps.budgetSweep()),
      },
      {
        name: 'warranty-check',
        hour: 3,
        weekday: null,
        bucketOf: dayBucket,
        run: () => this.sweeps.runAndLog('warranty-check', () => this.sweeps.warrantyCheck()),
      },
      {
        name: 'subscription-dues',
        hour: 6,
        weekday: null,
        bucketOf: dayBucket,
        run: () => this.sweeps.runAndLog('subscription-dues', () => this.sweeps.subscriptionDues()),
      },
      {
        name: 'idle-machines',
        hour: 4,
        weekday: 0,
        bucketOf: weekBucket,
        run: () => this.sweeps.runAndLog('idle-machines', () => this.sweeps.idleMachines()),
      },
      {
        name: 'decommission-candidates',
        hour: 5,
        weekday: 0,
        bucketOf: weekBucket,
        run: () =>
          this.sweeps.runAndLog('decommission-candidates', () =>
            this.sweeps.decommissionCandidates(),
          ),
      },
    ];
  }

  /**
   * The recipients' wall clock, as a `Date` whose UTC fields read as local ones.
   *
   * "Daily at 02:00" means two in the morning where the business is, not wherever the server
   * happens to be provisioned — the same offset quiet hours are measured against.
   */
  private toLocal(now: Date): Date {
    return new Date(now.getTime() + this.config.localUtcOffsetMinutes * MINUTE_MS);
  }
}
