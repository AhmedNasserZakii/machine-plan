import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DEFAULT_LOCALE } from 'src/common/constants/locales';
import { NotificationTemplateCode } from 'src/common/enums/notification.enum';
import { NotificationsConfig } from 'src/config/notifications.config';
import { Budget } from 'src/modules/finance/entities/budget.entity';
import { escalationOf } from 'src/modules/finance/budget-rules';
import { BudgetsService } from 'src/modules/finance/services/budgets.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { Notification } from '../entities/notification.entity';
import {
  dayBucket,
  daysSince,
  daysUntil,
  dedupeKey,
  ESCALATION_HOURS,
  hoursSince,
  REMINDER_HOURS,
  weekBucket,
} from '../notification-rules';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import {
  NotificationRecipientsService,
  dedupe,
  Recipient,
} from './notification-recipients.service';

/** What one sweep did, so the scheduler can log a number instead of a promise. */
export interface SweepResult {
  /** Rows the sweep considered — the ones whose state matched, before dedupe. */
  examined: number;
  /** Notifications actually written. Lower than `examined` on a re-run, which is the point. */
  notified: number;
}

const EMPTY: SweepResult = { examined: 0, notified: 0 };

/** Statuses in which a machine is somebody's responsibility, so standing still is a problem. */
const IDLE_ELIGIBLE_STATUSES = [
  'WITH_REPRESENTATIVE',
  'WITH_SUPERVISOR',
  'WITH_MERCHANT',
  'IN_BRANCH_WAREHOUSE',
];

/**
 * The scheduled half of `18`: the notifications nobody's action produces.
 *
 * Every method here is public and takes `now`, because these are the parts of the feature with no
 * request behind them — a test that could only reach them by waiting for a cron would not be a
 * test. The scheduler is a thin caller.
 *
 * **Idempotence is in the database, not in the schedule.** Each sweep claims a
 * `{templateCode}:{entityId}:{bucket}` key before it notifies, so a re-run, a second instance or a
 * worker that died halfway through cannot double-notify. That is also why these are plain crons
 * rather than BullMQ repeatables: the guarantee a queue would add is the one already held, and it
 * would add a hard Redis dependency to the one part of the system that must keep working when the
 * cache is down.
 */
@Injectable()
export class NotificationSweepsService {
  private readonly logger = new Logger(NotificationSweepsService.name);
  private readonly config: NotificationsConfig;

  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(Budget) private readonly budgets: Repository<Budget>,
    private readonly dispatcher: NotificationDispatcherService,
    private readonly recipients: NotificationRecipientsService,
    private readonly budgetsService: BudgetsService,
    private readonly settings: SettingsService,
    config: ConfigService,
  ) {
    this.config = config.getOrThrow<NotificationsConfig>('notifications');
  }

  /**
   * Hourly. Reminds a receiver at 24h and 48h, and escalates at 72h (`18`).
   *
   * A wave only fires inside its own 24-hour window. Without that, the first run after this
   * feature ships would greet every long-pending hand-off with both reminders at once, and the
   * escalation is bucketed by day rather than once ever so a genuinely stuck delivery keeps
   * appearing until somebody deals with it.
   */
  async transferReminders(now = new Date()): Promise<SweepResult> {
    const rows = await this.notifications.query<PendingTransferRow[]>(
      `SELECT t.id, t.reference_no, t.branch_id, t.to_party_id, t.occurred_at,
              COUNT(ti.id)::int AS machine_count,
              u.full_name AS receiver_name
         FROM transfers t
         JOIN transfer_items ti ON ti.transfer_id = t.id
         LEFT JOIN users u ON u.id = t.to_party_id
        WHERE t.status = 'PENDING'
          AND t.deleted_at IS NULL
          AND t.to_party_id IS NOT NULL
          AND t.occurred_at <= $1
        GROUP BY t.id, u.full_name
        ORDER BY t.occurred_at ASC`,
      [new Date(now.getTime() - REMINDER_HOURS[0] * 60 * 60 * 1000)],
    );

    let notified = 0;

    for (const row of rows) {
      const hours = hoursSince(new Date(row.occurred_at), now);
      const receiver = await this.recipients.byId(row.to_party_id);

      for (const wave of REMINDER_HOURS) {
        if (!receiver || hours < wave || hours >= wave + 24) continue;

        notified += await this.fanOut({
          templateCode: NotificationTemplateCode.TRANSFER_REMINDER,
          recipients: [receiver],
          params: {
            referenceNo: row.reference_no,
            hours,
            machineCount: row.machine_count,
          },
          entityId: row.id,
          dedupeKey: dedupeKey(NotificationTemplateCode.TRANSFER_REMINDER, row.id, `${wave}h`),
        });
      }

      if (hours >= ESCALATION_HOURS) {
        notified += await this.fanOut({
          templateCode: NotificationTemplateCode.TRANSFER_STUCK,
          recipients: await this.recipients.directorsAndBranchSupervisors(row.branch_id),
          params: {
            referenceNo: row.reference_no,
            hours,
            receiverName: row.receiver_name ?? '—',
          },
          entityId: row.id,
          dedupeKey: dedupeKey(NotificationTemplateCode.TRANSFER_STUCK, row.id, dayBucket(now)),
        });
      }
    }

    return { examined: rows.length, notified };
  }

  /** Daily. The two warning waves and the expiry notice (`18`). */
  async warrantyCheck(now = new Date()): Promise<SweepResult> {
    const today = now.toISOString().slice(0, 10);
    const waves = [...this.config.warrantyWarningDays, 0];

    const rows = await this.notifications.query<WarrantyRow[]>(
      `SELECT m.id, m.serial, m.warranty_end, m.current_branch_id
         FROM machines m
        WHERE m.deleted_at IS NULL
          AND m.warranty_end IS NOT NULL
          AND m.status NOT IN ('DECOMMISSIONED', 'REPLACED')
          AND m.warranty_end = ANY($1::date[])
        ORDER BY m.warranty_end ASC`,
      [waves.map((days) => addDays(today, days))],
    );

    let notified = 0;

    for (const row of rows) {
      const days = daysUntil(row.warranty_end, today);
      const expired = days <= 0;

      notified += await this.fanOut({
        templateCode: expired
          ? NotificationTemplateCode.WARRANTY_EXPIRED
          : NotificationTemplateCode.WARRANTY_EXPIRING,
        // The expiry itself is the Director's problem; the warnings are still actionable at the
        // branch that holds the unit, which is why only they reach a supervisor (`18`).
        recipients: expired
          ? await this.recipients.directors()
          : await this.recipients.directorsAndBranchSupervisors(row.current_branch_id),
        params: { machineSerial: row.serial, days, warrantyEnd: row.warranty_end },
        entityId: row.id,
        dedupeKey: dedupeKey(
          expired
            ? NotificationTemplateCode.WARRANTY_EXPIRED
            : NotificationTemplateCode.WARRANTY_EXPIRING,
          row.id,
          `${days}d`,
        ),
      });
    }

    return { examined: rows.length, notified };
  }

  /**
   * Daily. Catches the thresholds a budget crossed because time passed rather than because
   * anything was booked — a month ending with the money already spent is still news.
   */
  async budgetSweep(now = new Date()): Promise<SweepResult> {
    const asOf = now.toISOString().slice(0, 10);

    const budgets = await this.budgets
      .createQueryBuilder('budget')
      .where('budget.is_active = true')
      .andWhere('budget.period_start <= :asOf AND budget.period_end >= :asOf', { asOf })
      .getMany();

    let notified = 0;

    for (const budget of budgets) {
      const computed = await this.budgetsService.compute(budget, asOf);
      const escalation = escalationOf(budget.lastAlertLevel, computed.status);

      if (!escalation) continue;

      await this.budgets.update(budget.id, {
        lastAlertLevel: escalation,
        lastAlertAt: new Date(),
      });

      notified += await this.announceBudget(budget, computed.spent, computed.usedPercent, now);
    }

    return { examined: budgets.length, notified };
  }

  /**
   * The same announcement the finance write path makes, so a threshold crossed by a transaction
   * and one crossed by the calendar read identically in the recipient's list.
   *
   * The category name is taken in the default locale rather than the recipient's: the placeholder
   * values are rendered once for the whole audience, and inventing a second dispatch per language
   * would give the same budget two dedupe identities.
   */
  async announceBudget(
    budget: Budget,
    spent: number,
    usedPercent: number,
    now = new Date(),
  ): Promise<number> {
    const exceeded = usedPercent >= 100;
    const templateCode = exceeded
      ? NotificationTemplateCode.BUDGET_EXCEEDED
      : NotificationTemplateCode.BUDGET_WARNING;

    const [category] = await this.notifications.query<CategoryNameRow[]>(
      `SELECT COALESCE(tr.name, fc.code, '—') AS name
         FROM finance_categories fc
         LEFT JOIN finance_category_translations tr
                ON tr.finance_category_id = fc.id AND tr.locale = $2
        WHERE fc.id = $1`,
      [budget.categoryId, DEFAULT_LOCALE],
    );

    return this.fanOut({
      templateCode,
      recipients: dedupe([
        ...(await this.recipients.withPermission('finance.read', budget.branchId)),
        ...(await this.recipients.directors()),
      ]),
      params: {
        categoryName: category?.name ?? '—',
        periodLabel: `${budget.periodStart} → ${budget.periodEnd}`,
        spent: spent.toFixed(2),
        amount: Number(budget.amount).toFixed(2),
        usedPercent: usedPercent.toFixed(1),
      },
      entityId: budget.id,
      // One announcement per budget per level: `evaluateAfterWrite` and this sweep both call
      // here, and whichever notices the crossing first is the one that gets to tell people.
      dedupeKey: dedupeKey(templateCode, budget.id, `${budget.periodStart}:${dayBucket(now)}`),
    });
  }

  /** Daily. Subscriptions falling due today, and the ones that have been ignored a week (`18`). */
  async subscriptionDues(now = new Date()): Promise<SweepResult> {
    const today = now.toISOString().slice(0, 10);

    const rows = await this.notifications.query<SubscriptionRow[]>(
      `SELECT s.id, s.amount, s.next_due_date, m.name AS merchant_name,
              m.branch_id, m.created_by_user_id
         FROM merchant_subscriptions s
         JOIN merchants m ON m.id = s.merchant_id
        WHERE s.deleted_at IS NULL
          AND s.is_active = true
          AND s.plan_type <> 'NONE'
          AND s.next_due_date IS NOT NULL
          AND s.next_due_date <= $1::date
        ORDER BY s.next_due_date ASC`,
      [today],
    );

    let notified = 0;

    for (const row of rows) {
      const overdueDays = daysSince(
        new Date(`${row.next_due_date}T00:00:00.000Z`),
        new Date(`${today}T00:00:00.000Z`),
      );
      const params = {
        merchantName: row.merchant_name,
        amount: Number(row.amount).toFixed(2),
        dueDate: row.next_due_date,
        days: overdueDays,
      };

      if (overdueDays >= this.config.subscriptionOverdueDays) {
        notified += await this.fanOut({
          templateCode: NotificationTemplateCode.SUBSCRIPTION_OVERDUE,
          recipients: await this.recipients.directorsAndBranchSupervisors(row.branch_id),
          params,
          entityId: row.id,
          dedupeKey: dedupeKey(
            NotificationTemplateCode.SUBSCRIPTION_OVERDUE,
            row.id,
            dayBucket(now),
          ),
        });
        continue;
      }

      const registrar = await this.recipients.byId(row.created_by_user_id);

      notified += await this.fanOut({
        templateCode: NotificationTemplateCode.SUBSCRIPTION_DUE,
        recipients: dedupe([
          ...(registrar ? [registrar] : []),
          ...(await this.recipients.branchSupervisors(row.branch_id)),
        ]),
        params,
        entityId: row.id,
        dedupeKey: dedupeKey(NotificationTemplateCode.SUBSCRIPTION_DUE, row.id, row.next_due_date),
      });
    }

    return { examined: rows.length, notified };
  }

  /**
   * Weekly. Machines nobody has moved in `IDLE_ALERT_DAYS` (`18`).
   *
   * "Movement" is the last time the unit appeared on a hand-off, not the last time its row was
   * touched: an `updated_at` bumped by a note is not a machine that went anywhere.
   */
  async idleMachines(now = new Date()): Promise<SweepResult> {
    const cutoff = new Date(now.getTime() - this.config.idleAlertDays * 24 * 60 * 60 * 1000);

    const rows = await this.notifications.query<IdleMachineRow[]>(
      `SELECT m.id, m.serial, m.current_branch_id,
              COALESCE(MAX(ti.created_at), m.created_at) AS last_movement,
              COALESCE(u.full_name, mer.shop_name, w.name, '—') AS holder_name
         FROM machines m
         LEFT JOIN transfer_items ti ON ti.machine_id = m.id
         LEFT JOIN users u ON u.id = m.current_holder_id
         LEFT JOIN merchants mer ON mer.id = m.current_holder_id
         LEFT JOIN warehouses w ON w.id = m.current_holder_id
        WHERE m.deleted_at IS NULL
          AND m.status = ANY($1::text[])
        GROUP BY m.id, u.full_name, mer.shop_name, w.name
       HAVING COALESCE(MAX(ti.created_at), m.created_at) < $2
        ORDER BY 4 ASC`,
      [IDLE_ELIGIBLE_STATUSES, cutoff],
    );

    let notified = 0;

    for (const row of rows) {
      notified += await this.fanOut({
        templateCode: NotificationTemplateCode.MACHINE_IDLE,
        recipients: await this.recipients.branchSupervisors(row.current_branch_id),
        params: {
          machineSerial: row.serial,
          days: daysSince(new Date(row.last_movement), now),
          holderName: row.holder_name,
        },
        entityId: row.id,
        dedupeKey: dedupeKey(NotificationTemplateCode.MACHINE_IDLE, row.id, weekBucket(now)),
      });
    }

    return { examined: rows.length, notified };
  }

  /**
   * Weekly. Machines whose repairs have outgrown their value (`13`, `18`).
   *
   * Judged on the same two thresholds the machine module shows the Director on screen, read from
   * `settings` rather than hard-coded, so the alert and the recommendation cannot disagree.
   */
  async decommissionCandidates(now = new Date()): Promise<SweepResult> {
    const thresholds = await this.settings.decommissionThresholds();

    const rows = await this.notifications.query<CandidateRow[]>(
      `SELECT m.id, m.serial, m.total_repair_cost, m.purchase_price, m.repair_count
         FROM machines m
        WHERE m.deleted_at IS NULL
          AND m.status NOT IN ('DECOMMISSIONED', 'REPLACED')
          AND (
            (m.purchase_price IS NOT NULL AND m.purchase_price > 0
              AND m.total_repair_cost / m.purchase_price >= $1)
            OR m.repair_count >= $2
          )
        ORDER BY m.repair_count DESC`,
      [thresholds.considerRatio, thresholds.considerRepairCount],
    );

    const directors = await this.recipients.directors();
    let notified = 0;

    for (const row of rows) {
      const purchasePrice = Number(row.purchase_price ?? 0);
      const repairCost = Number(row.total_repair_cost);

      notified += await this.fanOut({
        templateCode: NotificationTemplateCode.DECOMMISSION_CANDIDATE,
        recipients: directors,
        params: {
          machineSerial: row.serial,
          repairCost: repairCost.toFixed(2),
          purchasePrice: purchasePrice.toFixed(2),
          ratio: purchasePrice > 0 ? ((repairCost / purchasePrice) * 100).toFixed(1) : '—',
        },
        entityId: row.id,
        dedupeKey: dedupeKey(
          NotificationTemplateCode.DECOMMISSION_CANDIDATE,
          row.id,
          weekBucket(now),
        ),
      });
    }

    return { examined: rows.length, notified };
  }

  /** Hourly housekeeping: send what quiet hours held back, then drop the spent dedupe keys. */
  async maintenanceSweep(now = new Date()): Promise<SweepResult> {
    const flushed = await this.dispatcher.flushPendingPushes(now);
    const purged = await this.dispatcher.purgeExpiredDedupeKeys(now);

    return { examined: flushed + purged, notified: flushed };
  }

  private async fanOut(request: {
    templateCode: NotificationTemplateCode;
    recipients: readonly Recipient[];
    params: Record<string, string | number>;
    entityId: string;
    dedupeKey: string;
  }): Promise<number> {
    if (request.recipients.length === 0) return 0;

    const outcome = await this.dispatcher.tryDispatch(request);

    return outcome?.created.length ?? 0;
  }

  /** Runs every sweep in turn and logs one line per sweep. Used by the hourly and daily crons. */
  async runAndLog(name: string, sweep: () => Promise<SweepResult>): Promise<SweepResult> {
    try {
      const result = await sweep();
      this.logger.log({ sweep: name, ...result }, 'Notification sweep finished');

      return result;
    } catch (error) {
      // A sweep that throws must not take the scheduler down with it: the next window is a
      // perfectly good retry, and the dedupe keys make it safe.
      this.logger.error({ err: error, sweep: name }, 'Notification sweep failed');

      return EMPTY;
    }
  }
}

interface PendingTransferRow {
  id: string;
  reference_no: string;
  branch_id: string | null;
  to_party_id: string;
  occurred_at: string;
  machine_count: number;
  receiver_name: string | null;
}

interface WarrantyRow {
  id: string;
  serial: string;
  warranty_end: string;
  current_branch_id: string | null;
}

interface SubscriptionRow {
  id: string;
  amount: string;
  next_due_date: string;
  merchant_name: string;
  branch_id: string | null;
  created_by_user_id: string;
}

interface IdleMachineRow {
  id: string;
  serial: string;
  current_branch_id: string | null;
  last_movement: string;
  holder_name: string;
}

interface CandidateRow {
  id: string;
  serial: string;
  total_repair_cost: string;
  purchase_price: string | null;
  repair_count: number;
}

interface CategoryNameRow {
  name: string;
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}
