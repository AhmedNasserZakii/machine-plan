import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { Locale } from 'src/common/constants/locales';
import {
  NotificationEntityType,
  NotificationTemplateCode,
  PushSkipReason,
  PushStatus,
} from 'src/common/enums/notification.enum';
import { NotificationsConfig } from 'src/config/notifications.config';
import { pushDeliveryTotal } from 'src/common/metrics/metrics';
import { captureError } from 'src/common/observability/sentry';
import { UserDevice } from 'src/modules/users/entities/user-device.entity';
import { Notification } from '../entities/notification.entity';
import { NotificationDedupe } from '../entities/notification-dedupe.entity';
import {
  dedupeKey,
  DIGEST_WINDOW_MS,
  isWithinQuietHours,
  nextSendableAt,
  QuietHours,
  renderTemplate,
  shouldDigest,
  TemplateParams,
} from '../notification-rules';
import { DIGEST_SUBJECTS } from '../notification-templates.catalogue';
import { Recipient } from './notification-recipients.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationTemplatesService, ResolvedTemplate } from './notification-templates.service';
import { FcmPushTransport } from './push/fcm-push.transport';
import { PushMessage } from './push/push.transport';

export interface DispatchRequest {
  templateCode: NotificationTemplateCode;
  recipients: readonly Recipient[];
  /** Filled into the template body. Every declared `{placeholder}` must be present. */
  params: TemplateParams;
  entityType?: NotificationEntityType | null;
  entityId?: string | null;
  /**
   * Never notify somebody about their own action (`18`, delivery rule 1). Passed rather than
   * inferred so a sweep — which has no actor — can leave it out.
   */
  actorId?: string | null;
  /** `{templateCode}:{entityId}:{bucket}`; set by the scheduled jobs to stay idempotent. */
  dedupeKey?: string | null;
}

export type DispatchSkipReason = 'ACTOR' | 'IN_APP_OFF';

export interface DispatchOutcome {
  created: Notification[];
  /** Recipients filtered out before a row was written, and why. */
  skipped: { userId: string; reason: DispatchSkipReason }[];
  /** True when the dedupe key already existed, so this dispatch was a sweep re-run. */
  deduped: boolean;
}

/** A dedupe key outlives the longest job period (a week) plus slack for a late re-run. */
const DEDUPE_TTL_MS = 8 * 24 * 60 * 60 * 1000;

/** How many held-back pushes one flush attempt drains. */
const FLUSH_BATCH = 500;

/**
 * The fan-out: one domain event becomes one stored notification per recipient, plus a
 * best-effort push on top (`18`).
 *
 * Two properties this is built around.
 *
 * **In-app is the delivery; push is a courtesy.** Every notification is a row, always, and the
 * three `push_*` columns record what happened to its push — sent, deferred to the next window,
 * folded into a digest, or skipped because there is no transport configured. A push that could
 * not be attempted is never allowed to look like one that was.
 *
 * **Dispatch never fails the caller.** A transfer that was confirmed stays confirmed even if the
 * notification could not be written, which is why every trigger site calls `tryDispatch` and
 * ignores the result. It is also why this service takes no part in the caller's transaction: a
 * notification rolled back with a business operation is fine, but a business operation rolled
 * back by a notification is a bug.
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private readonly config: NotificationsConfig;

  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(NotificationDedupe)
    private readonly dedupe: Repository<NotificationDedupe>,
    @InjectRepository(UserDevice) private readonly devices: Repository<UserDevice>,
    private readonly templates: NotificationTemplatesService,
    private readonly preferences: NotificationPreferencesService,
    private readonly push: FcmPushTransport,
    config: ConfigService,
  ) {
    this.config = config.getOrThrow<NotificationsConfig>('notifications');
  }

  /**
   * Dispatches and swallows anything that goes wrong, because no business operation should fail
   * over a notification. Trigger sites use this; the sweeps use `dispatch` so they can count.
   */
  async tryDispatch(request: DispatchRequest): Promise<DispatchOutcome | null> {
    try {
      return await this.dispatch(request);
    } catch (error) {
      this.logger.error(
        { err: error, templateCode: request.templateCode, entityId: request.entityId },
        'Notification dispatch failed',
      );
      captureError(error, { templateCode: request.templateCode, entityId: request.entityId });

      return null;
    }
  }

  async dispatch(request: DispatchRequest): Promise<DispatchOutcome> {
    const outcome: DispatchOutcome = { created: [], skipped: [], deduped: false };

    if (request.dedupeKey && !(await this.claimDedupeKey(request.dedupeKey))) {
      return { ...outcome, deduped: true };
    }

    const audience = request.recipients.filter((recipient) => {
      if (recipient.id === request.actorId) {
        outcome.skipped.push({ userId: recipient.id, reason: 'ACTOR' });
        return false;
      }
      return true;
    });

    if (audience.length === 0) return outcome;

    // Rendered once per locale rather than once per recipient: two supervisors reading Arabic
    // share one template lookup and one render.
    const wordings = new Map<Locale, RenderedTemplate>();

    for (const locale of new Set(audience.map((recipient) => recipient.locale))) {
      const template = await this.templates.resolve(request.templateCode, locale);
      if (!template.isActive) return outcome;

      wordings.set(locale, {
        template,
        title: renderTemplate(template.title, request.params),
        body: renderTemplate(template.body, request.params),
      });
    }

    const [{ template }] = [...wordings.values()];
    const choices = await this.preferences.resolve(
      audience.map((recipient) => recipient.id),
      template,
    );
    const digests: { recipient: Recipient; count: number }[] = [];

    for (const recipient of audience) {
      const wording = wordings.get(recipient.locale);
      const choice = choices.get(recipient.id);
      if (!wording || !choice) continue;

      if (!choice.inApp) {
        // In-app off and the template is not locked, so there is nothing to store. Push-only
        // delivery is deliberately unsupported: a notification with no row is one nobody can
        // go back to, and the badge count would disagree with the list.
        outcome.skipped.push({ userId: recipient.id, reason: 'IN_APP_OFF' });
        continue;
      }

      const plan = await this.planPush(recipient, wording.template, choice.push);
      if (plan.digestCount !== null) digests.push({ recipient, count: plan.digestCount });

      outcome.created.push(
        await this.notifications.save(
          this.notifications.create({
            userId: recipient.id,
            templateCode: wording.template.code,
            locale: recipient.locale,
            title: wording.title,
            body: wording.body,
            entityType: request.entityType ?? asEntityType(wording.template.entityType),
            entityId: request.entityId ?? null,
            deepLink: deepLinkOf(wording.template.deepLinkTemplate, request.entityId ?? null),
            data: stringifyParams(request.params),
            pushStatus: plan.status,
            pushSkipReason: plan.reason,
            pushDeferredUntil: plan.deferredUntil,
          }),
        ),
      );
    }

    await this.deliverPushes(outcome.created);

    for (const digest of digests) {
      await this.sendDigest(digest.recipient, request.templateCode, digest.count);
    }

    return outcome;
  }

  /**
   * Sends the pushes quiet hours held back, plus anything a crashed process left `PENDING`.
   *
   * Run from the hourly sweep. A deferral nothing ever flushed would be the worst of both worlds:
   * a notification the recipient was promised and a row claiming it is still on its way.
   */
  async flushPendingPushes(now = new Date()): Promise<number> {
    const due = await this.notifications.find({
      where: [
        { pushStatus: PushStatus.PENDING },
        { pushStatus: PushStatus.DEFERRED, pushDeferredUntil: LessThanOrEqual(now) },
      ],
      order: { createdAt: 'ASC' },
      take: FLUSH_BATCH,
    });

    if (due.length === 0) return 0;

    // Marked sendable before handing them over, so the same rows are not picked up twice by two
    // overlapping flushes.
    for (const notification of due) {
      notification.pushStatus = PushStatus.PENDING;
      notification.pushSkipReason = null;
      notification.pushDeferredUntil = null;
    }

    await this.deliverPushes(due);

    return due.length;
  }

  /** Removes dedupe keys whose window has closed, so the table stays the size of the live set. */
  async purgeExpiredDedupeKeys(now = new Date()): Promise<number> {
    const result = await this.dedupe.delete({ expiresAt: LessThanOrEqual(now) });

    return result.affected ?? 0;
  }

  /**
   * Writes the dedupe key and reports whether this caller is the one that got it.
   *
   * The insert *is* the claim: two workers racing the same sweep both try, one loses on the
   * primary key, and only the winner notifies. Reading first and inserting after would leave a
   * window wide enough for exactly the double-notify this exists to prevent.
   */
  async claimDedupeKey(key: string, ttlMs = DEDUPE_TTL_MS): Promise<boolean> {
    const rows = await this.dedupe.query<{ key: string }[]>(
      `INSERT INTO notification_dedupe ("key", "expires_at") VALUES ($1, $2)
         ON CONFLICT ("key") DO NOTHING
         RETURNING "key"`,
      [key, new Date(Date.now() + ttlMs)],
    );

    return rows.length > 0;
  }

  /**
   * Decides the push leg before the row is written, so a row is never momentarily wrong.
   *
   * The order of the checks is the order in which a reason stops being interesting:
   *
   * 1. the recipient turned push off — nothing else matters;
   * 2. no transport is configured, so nothing was going anywhere. This is ahead of both the
   *    flood check and quiet hours on purpose: `DIGESTED` would claim a summary was sent in its
   *    place and `DEFERRED` would claim it is still coming, and both are things this module
   *    exists not to say;
   * 3. he is being flooded, so this one is folded into a summary;
   * 4. he has no device to send to;
   * 5. it is the middle of the night.
   */
  private async planPush(
    recipient: Recipient,
    template: ResolvedTemplate,
    pushWanted: boolean,
  ): Promise<PushPlan> {
    if (!pushWanted) return skipped(PushSkipReason.PREFERENCE_OFF);
    if (!this.push.available) return skipped(PushSkipReason.TRANSPORT_DISABLED);

    // A digest of digests would be a summary of summaries, so the flood check exempts itself.
    if (template.code !== NotificationTemplateCode.DIGEST) {
      const recent = await this.countRecent(recipient.id, template.code);

      if (shouldDigest(recent, this.config.digestThreshold)) {
        return { ...skipped(PushSkipReason.DIGESTED), digestCount: recent + 1 };
      }
    }

    if ((await this.tokensFor(recipient.id)).length === 0) {
      return skipped(PushSkipReason.NO_ACTIVE_DEVICE);
    }

    const now = new Date();
    if (!template.ignoresQuietHours && isWithinQuietHours(now, this.quietHours)) {
      return {
        status: PushStatus.DEFERRED,
        reason: PushSkipReason.QUIET_HOURS,
        deferredUntil: nextSendableAt(now, this.quietHours),
        digestCount: null,
      };
    }

    return { status: PushStatus.PENDING, reason: null, deferredUntil: null, digestCount: null };
  }

  /**
   * `18`, delivery rule 3: one summary in place of the flood.
   *
   * Dedupe-keyed on the hour so the second, third and tenth folded notification of the same hour
   * do not each produce a summary of their own.
   */
  private async sendDigest(
    recipient: Recipient,
    code: NotificationTemplateCode,
    count: number,
  ): Promise<void> {
    const bucket = new Date().toISOString().slice(0, 13);

    await this.dispatch({
      templateCode: NotificationTemplateCode.DIGEST,
      recipients: [recipient],
      params: { count, subject: DIGEST_SUBJECTS[code][recipient.locale] },
      dedupeKey: dedupeKey(NotificationTemplateCode.DIGEST, recipient.id, `${code}:${bucket}`),
    });
  }

  /**
   * Hands the sendable rows to the transport and records what came back.
   *
   * Safe to call straight after a dispatch and from the hourly flush, because only rows the
   * planner cleared (`PENDING`) are attempted.
   */
  private async deliverPushes(rows: readonly Notification[]): Promise<void> {
    for (const notification of rows.filter((row) => row.pushStatus === PushStatus.PENDING)) {
      const tokens = (await this.tokensFor(notification.userId))
        .map((device) => device.pushToken)
        .filter((token): token is string => token !== null);

      if (tokens.length === 0) {
        await this.recordPush(notification, {
          status: PushStatus.SKIPPED,
          reason: PushSkipReason.NO_ACTIVE_DEVICE,
        });
        continue;
      }

      const message: PushMessage = {
        tokens,
        title: notification.title,
        body: notification.body,
        data: {
          templateCode: notification.templateCode,
          notificationId: notification.id,
          ...(notification.entityType ? { entityType: notification.entityType } : {}),
          ...(notification.entityId ? { entityId: notification.entityId } : {}),
          ...(notification.deepLink ? { deepLink: notification.deepLink } : {}),
        },
      };

      const result = await this.push.send(message);

      if (result.unregisteredTokens.length > 0) {
        await this.dropUnregistered(notification.userId, result.unregisteredTokens);
      }

      if (result.delivered > 0) {
        await this.recordPush(notification, {
          status: PushStatus.SENT,
          reason: null,
          delivered: result.delivered,
          sentAt: new Date(),
        });
        continue;
      }

      await this.recordPush(notification, {
        status: result.transportError ? PushStatus.FAILED : PushStatus.SKIPPED,
        reason: result.transportError
          ? PushSkipReason.TRANSPORT_ERROR
          : PushSkipReason.TOKENS_UNREGISTERED,
      });
    }
  }

  private async recordPush(
    notification: Notification,
    outcome: {
      status: PushStatus;
      reason: PushSkipReason | null;
      delivered?: number;
      sentAt?: Date;
    },
  ): Promise<void> {
    const patch = {
      pushStatus: outcome.status,
      pushSkipReason: outcome.reason,
      pushDeliveredCount: outcome.delivered ?? 0,
      pushSentAt: outcome.sentAt ?? null,
      pushDeferredUntil: null,
    };

    await this.notifications.update(notification.id, patch);
    Object.assign(notification, patch);
    pushDeliveryTotal.inc({ status: outcome.status });
  }

  private countRecent(userId: string, code: NotificationTemplateCode): Promise<number> {
    const since = new Date(Date.now() - DIGEST_WINDOW_MS);

    return this.notifications
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId })
      .andWhere('notification.template_code = :code', { code })
      .andWhere('notification.created_at >= :since', { since })
      .getCount();
  }

  private tokensFor(userId: string): Promise<UserDevice[]> {
    return this.devices.find({
      where: { userId, isActive: true, pushToken: Not(IsNull()), deletedAt: IsNull() },
    });
  }

  /** `18`, delivery rule 4: a token FCM has rejected is cleared rather than retried forever. */
  private async dropUnregistered(userId: string, tokens: readonly string[]): Promise<void> {
    await this.devices.update({ userId, pushToken: In([...tokens]) }, { pushToken: null });
    this.logger.warn(
      { userId, count: tokens.length },
      'Cleared push tokens FCM reported as unregistered',
    );
  }

  private get quietHours(): QuietHours {
    return {
      start: this.config.quietHoursStart,
      end: this.config.quietHoursEnd,
      offsetMinutes: this.config.localUtcOffsetMinutes,
    };
  }
}

interface RenderedTemplate {
  template: ResolvedTemplate;
  title: string;
  body: string;
}

interface PushPlan {
  status: PushStatus;
  reason: PushSkipReason | null;
  deferredUntil: Date | null;
  /** How many of this template the recipient has had in the window, when folding into a digest. */
  digestCount: number | null;
}

function skipped(reason: PushSkipReason): PushPlan {
  return { status: PushStatus.SKIPPED, reason, deferredUntil: null, digestCount: null };
}

/** The template table stores the entity type as text; the notification column is the same set. */
function asEntityType(value: string | null): NotificationEntityType | null {
  return value as NotificationEntityType | null;
}

function deepLinkOf(template: string | null, entityId: string | null): string | null {
  if (!template) return null;
  if (!template.includes('{entityId}')) return template;

  return entityId ? template.replace('{entityId}', entityId) : null;
}

/** The push data payload is `Record<string, string>` on both platforms. */
function stringifyParams(params: TemplateParams): Record<string, string> {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]));
}
