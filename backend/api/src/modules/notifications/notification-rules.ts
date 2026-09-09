import { NotificationTemplateCode } from 'src/common/enums/notification.enum';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export interface QuietHours {
  /** Local hour push stops at, inclusive. */
  start: number;
  /** Local hour push resumes at. */
  end: number;
  /** Minutes east of UTC of the operating locale. */
  offsetMinutes: number;
}

export type TemplateParams = Record<string, string | number>;

/** Every `{token}` the text contains, in order of appearance and without duplicates. */
export function placeholdersIn(text: string): string[] {
  const found = text.match(/\{[A-Za-z][A-Za-z0-9]*\}/g) ?? [];
  return [...new Set(found.map((token) => token.slice(1, -1)))];
}

/**
 * Fills `{token}` from `params`.
 *
 * Throws on a token nothing was supplied for rather than shipping the literal `{spent}` to
 * somebody's phone: a trigger that forgot a placeholder is a bug in this repository, and the
 * dispatcher treats a failed render as a failed notification rather than sending nonsense.
 */
export function renderTemplate(text: string, params: TemplateParams): string {
  const missing = placeholdersIn(text).filter((token) => params[token] === undefined);

  if (missing.length > 0) {
    throw new Error(`Notification template is missing placeholders: ${missing.join(', ')}`);
  }

  return text.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (_match, token: string) =>
    String(params[token]),
  );
}

/** The recipient's wall-clock hour, which is what quiet hours are expressed in. */
export function localHourOf(at: Date, offsetMinutes: number): number {
  return new Date(at.getTime() + offsetMinutes * MINUTE_MS).getUTCHours();
}

/**
 * Quiet hours normally wrap midnight (21:00–08:00), so the comparison cannot be a plain range.
 * A non-wrapping window (e.g. 13:00–15:00) is still handled, because nothing stops an operator
 * configuring one and a rule that silently inverted it would be worse than one that did not work.
 */
export function isWithinQuietHours(at: Date, quiet: QuietHours): boolean {
  if (quiet.start === quiet.end) return false;

  const hour = localHourOf(at, quiet.offsetMinutes);

  return quiet.start < quiet.end
    ? hour >= quiet.start && hour < quiet.end
    : hour >= quiet.start || hour < quiet.end;
}

/**
 * When a deferred push becomes sendable: the next time the local clock reads `quiet.end`.
 *
 * Computed on the local hour rather than by adding a fixed offset, so a message deferred at 21:05
 * and one deferred at 03:00 both land at 08:00 instead of arriving nine hours apart.
 */
export function nextSendableAt(at: Date, quiet: QuietHours): Date {
  const shifted = at.getTime() + quiet.offsetMinutes * MINUTE_MS;
  const local = new Date(shifted);
  const target = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    quiet.end,
    0,
    0,
    0,
  );
  const resolved = target > shifted ? target : target + DAY_MS;

  return new Date(resolved - quiet.offsetMinutes * MINUTE_MS);
}

/**
 * The dedupe key of a scheduled notification (`18`, Scheduled jobs).
 *
 * The bucket is what makes it re-fireable on the next window: `TRANSFER_REMINDER:…:24h` and
 * `TRANSFER_REMINDER:…:48h` are different notifications about the same transfer, while a second
 * run of the same hour is not.
 */
export function dedupeKey(
  templateCode: NotificationTemplateCode,
  entityId: string,
  bucket: string,
): string {
  return `${templateCode}:${entityId}:${bucket}`;
}

/** `2026-09-08` — the bucket for a job that runs once a day. */
export function dayBucket(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** `2026-W36` — the bucket for a weekly job, ISO week so a year boundary does not collide. */
export function weekBucket(at: Date): string {
  const date = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  // ISO weeks are Monday-based and belong to the year containing their Thursday.
  const dayOfWeek = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayOfWeek + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayOfWeek = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayOfWeek + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * DAY_MS));

  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** How many whole hours a pending hand-off has been waiting. */
export function hoursSince(from: Date, now: Date): number {
  return Math.floor((now.getTime() - from.getTime()) / HOUR_MS);
}

/** How many whole days apart two instants are, floored. */
export function daysSince(from: Date, now: Date): number {
  return Math.floor((now.getTime() - from.getTime()) / DAY_MS);
}

/**
 * Whole days from `today` until `date`, both date-only strings. Negative once `date` has passed.
 */
export function daysUntil(date: string, today: string): number {
  return Math.round(
    (Date.parse(`${date}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / DAY_MS,
  );
}

/**
 * `18`, delivery rule 3: past the threshold, one summary replaces the individual pushes.
 *
 * The count passed in is how many of this template the recipient has *already* received in the
 * window, so the one being dispatched is the `count + 1`-th.
 */
export function shouldDigest(recentCount: number, threshold: number): boolean {
  return recentCount >= threshold;
}

/** The window a digest counts over — one hour, per the rule. */
export const DIGEST_WINDOW_MS = HOUR_MS;

/** Reminder waves and the escalation, in hours since the hand-off was created (`18`). */
export const REMINDER_HOURS: readonly number[] = [24, 48];
export const ESCALATION_HOURS = 72;
