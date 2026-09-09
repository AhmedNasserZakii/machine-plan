# 18 — Feature: Notifications

## Goal

Push and in-app notifications so people act without being chased: a representative learns a delivery
is waiting for his signature, a supervisor learns a machine has been sitting untouched for months,
the Director learns a category blew its budget or a warranty is about to lapse.

## Channels

| Channel | Transport |
|---|---|
| `PUSH` | Firebase Cloud Messaging (Android + iOS) |
| `IN_APP` | stored in `notifications`, fetched by the app, badge count |

Every notification is stored in-app; push is best-effort on top.

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/notifications` | user |
| GET | `/notifications/unread-count` | user |
| PATCH | `/notifications/:id/read` | user |
| PATCH | `/notifications/read-all` | user |
| POST | `/devices` | user — register FCM token |
| DELETE | `/devices/:deviceId` | user |
| GET | `/notification-preferences` | user |
| PUT | `/notification-preferences` | user |

## Event catalogue

| Template code | Trigger | Recipients |
|---|---|---|
| `TRANSFER_PENDING` | transfer created | the receiver |
| `TRANSFER_CONFIRMED` | receiver signed | the sender |
| `TRANSFER_REJECTED` | receiver rejected | the sender + branch supervisor |
| `TRANSFER_REMINDER` | pending 24h / 48h | the receiver |
| `TRANSFER_STUCK` | pending 72h | branch supervisor + Director |
| `VIOLATION_CREATED` | auto or manual violation | the representative + his supervisor |
| `VIOLATION_CHARGED` | amount assigned | the representative |
| `MAINTENANCE_OPENED` | order created | Director |
| `MAINTENANCE_RETURNED` | machine came back | Director + branch supervisor |
| `MACHINE_REPLACED` | factory swap recorded | Director |
| `WARRANTY_EXPIRING` | 30 / 7 days before `warranty_end` | Director + branch supervisor |
| `WARRANTY_EXPIRED` | on `warranty_end` | Director |
| `BUDGET_WARNING` | threshold crossed | finance readers + Director |
| `BUDGET_EXCEEDED` | 100% crossed | finance readers + Director |
| `SUBSCRIPTION_DUE` | `next_due_date` reached | the registering rep + supervisor |
| `SUBSCRIPTION_OVERDUE` | 7 days past due | supervisor + Director |
| `MACHINE_IDLE` | no movement in N days | branch supervisor |
| `DECOMMISSION_CANDIDATE` | cost ratio threshold crossed | Director |

## Templates

Stored in `notification_templates` + translations (`02`). Body supports `{placeholders}`:

```
BUDGET_EXCEEDED:
  ar  title: "تعدي الميزانية"
      body:  "قسم {categoryName} تعدى ميزانية {periodLabel} — صرف {spent} من {amount}"
  en  title: "Budget exceeded"
      body:  "{categoryName} exceeded the {periodLabel} budget — {spent} of {amount} spent"
```

The rendering service picks the **recipient's** locale, not the actor's. Store the rendered
`title`/`body` on the notification row so history stays readable even if the template changes later.

## Scheduled jobs (BullMQ repeatable)

| Job | Cron | Does |
|---|---|---|
| `transfer-reminders` | hourly | reminders at 24h/48h, escalation at 72h |
| `warranty-check` | daily 03:00 | 30-day and 7-day warnings, expiry notices |
| `budget-sweep` | daily 02:00 | catches thresholds crossed by date passage |
| `subscription-dues` | daily 06:00 | due and overdue subscriptions |
| `idle-machines` | weekly Sun 04:00 | machines untouched > `IDLE_ALERT_DAYS` (default 90) |
| `decommission-candidates` | weekly Sun 05:00 | machines crossing cost thresholds |

All jobs are **idempotent**: each writes a `notification_dedupe` key
(`{templateCode}:{entityId}:{bucket}`) with a TTL matching the job period, so a re-run or a worker
restart cannot double-notify.

## Preferences

Per user, per template code: `push` on/off, `inApp` on/off (in-app cannot be disabled for
`TRANSFER_PENDING` — it is operationally critical). Stored as a JSONB column on `users` or a small
`notification_preferences` table.

## Delivery rules

1. **Never notify the actor about their own action.** The person who created the transfer does not
   get `TRANSFER_PENDING`.
2. **Quiet hours** (default 21:00–08:00 local): push is deferred to the next window; in-app is
   stored immediately. `TRANSFER_STUCK` and `BUDGET_EXCEEDED` ignore quiet hours.
3. **Batch digests:** if a user would receive more than 5 notifications of the same template within
   an hour, send one summary instead ("3 عمليات تسليم في انتظار توقيعك").
4. Failed FCM tokens (`UNREGISTERED`) are deleted from `devices` immediately.

## Payload shape (push data)

```json
{
  "templateCode":"TRANSFER_PENDING",
  "entityType":"transfer",
  "entityId":"…",
  "deepLink":"machinery://transfers/…",
  "notificationId":"…"
}
```

The Flutter app routes on `deepLink` (see Flutter `20`).
