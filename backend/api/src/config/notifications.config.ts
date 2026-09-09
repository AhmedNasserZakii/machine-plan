import { registerAs } from '@nestjs/config';

export interface NotificationsConfig {
  /**
   * False when no service account is configured. The push transport then refuses to pretend:
   * every notification records `TRANSPORT_DISABLED` instead of a delivery that never happened.
   */
  fcmEnabled: boolean;
  fcmProjectId: string | null;
  fcmClientEmail: string | null;
  fcmPrivateKey: string | null;
  /** Local hour push is held from, inclusive (`18`, delivery rule 2). */
  quietHoursStart: number;
  /** Local hour push resumes at. */
  quietHoursEnd: number;
  /** Minutes east of UTC used to read the recipient's wall clock. Egypt is UTC+2/+3. */
  localUtcOffsetMinutes: number;
  /** More than this many of one template inside an hour is summarised instead (`18`, rule 3). */
  digestThreshold: number;
  /** How long past its due window a subscription counts as overdue. */
  subscriptionOverdueDays: number;
  /** Days before `warranty_end` the two warning waves go out. */
  warrantyWarningDays: readonly number[];
  /** `IDLE_ALERT_DAYS` of `18` — how long a machine may sit before the supervisor hears. */
  idleAlertDays: number;
  /** Whether the cron sweeps are registered. Off under test so no clock drives assertions. */
  schedulerEnabled: boolean;
}

export const notificationsConfig = registerAs('notifications', (): NotificationsConfig => {
  const projectId = process.env.FCM_PROJECT_ID ?? null;
  const clientEmail = process.env.FCM_CLIENT_EMAIL ?? null;
  // Service-account keys are PEM blocks, and a `.env` file cannot hold a real newline — every
  // deployment guide tells operators to escape them, so they are unescaped back here.
  const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? null;

  return {
    fcmEnabled: Boolean(projectId && clientEmail && privateKey),
    fcmProjectId: projectId,
    fcmClientEmail: clientEmail,
    fcmPrivateKey: privateKey,
    quietHoursStart: Number(process.env.NOTIFICATION_QUIET_HOURS_START ?? 21),
    quietHoursEnd: Number(process.env.NOTIFICATION_QUIET_HOURS_END ?? 8),
    localUtcOffsetMinutes: Number(process.env.NOTIFICATION_LOCAL_UTC_OFFSET_MINUTES ?? 120),
    digestThreshold: Number(process.env.NOTIFICATION_DIGEST_THRESHOLD ?? 5),
    subscriptionOverdueDays: Number(process.env.SUBSCRIPTION_OVERDUE_DAYS ?? 7),
    warrantyWarningDays: [30, 7],
    idleAlertDays: Number(process.env.IDLE_ALERT_DAYS ?? 90),
    schedulerEnabled:
      process.env.NOTIFICATION_SCHEDULER_ENABLED === 'true' ||
      (process.env.NODE_ENV !== 'test' && process.env.NOTIFICATION_SCHEDULER_ENABLED !== 'false'),
  };
});
