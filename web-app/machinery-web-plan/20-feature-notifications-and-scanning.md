# 20 — Feature: Notifications & Web Scanning

Two small features grouped because neither justifies its own sprint.

---

# Notifications

Mobile counterpart: `mobile-app/lib/feature/notifications/`.

## Endpoints

| Method | Path | Screen |
|---|---|---|
| GET | `notifications` | list + bell dropdown |
| GET | `notifications/unread-count` | badge |
| PATCH | `notifications/{id}/read` | mark one |
| PATCH | `notifications/read-all` | mark all |
| GET/PUT | `notification-preferences` | preferences |

`POST devices` / `DELETE devices/{deviceId}` register a **push token**. The web app does **not**
call these in v1: web push needs a service worker, VAPID keys and a notification permission prompt,
and the backend's FCM setup is built around mobile device registration. The web uses polling
(`07`) instead. If web push is wanted later it is its own task, with a backend change, not a
side effect of this feature.

## Types

`TRANSFER_PENDING`, `TRANSFER_CONFIRMED`, `TRANSFER_REJECTED`, `TRANSFER_REMINDER`,
`TRANSFER_STUCK`, `VIOLATION_CREATED`, `VIOLATION_CHARGED`, `MAINTENANCE_OPENED`,
`MAINTENANCE_RETURNED`, `MACHINE_REPLACED`, `WARRANTY_EXPIRING`, `WARRANTY_EXPIRED`,
`BUDGET_WARNING`, `BUDGET_EXCEEDED`, `SUBSCRIPTION_DUE`, `SUBSCRIPTION_OVERDUE`, `MACHINE_IDLE`,
`DECOMMISSION_CANDIDATE`, `MACHINE_DECOMMISSIONED`, `DIGEST`.

Each maps to an icon, a tone and a **deep link** — the web counterpart of
`notification_deep_link_router.dart`. Keep the mapping in one file
(`features/notifications/model/notification-routes.ts`) so mobile and web route the same
notification to the same record.

## Bell dropdown

Unread count polled every 60s and on focus. Dropdown shows the 10 most recent with icon, title,
relative time and unread indicator; clicking marks read (optimistic — allowed here per `07`) and
navigates. Footer: "mark all read" and "view all".

## `/notifications`

Full list, grouped by day, filterable by type and read state, with keyset pagination. Bulk mark-read.
Each row deep-links to its record.

## `/settings/notifications`

`GET/PUT notification-preferences` — per type, per channel. Show only the channels the web can
honour, and be honest that push preferences affect the mobile app. Grouped by domain with
group-level toggles.

---

# Web scanning

Mobile counterpart: `mobile-app/lib/feature/scanning/`.

A desk user does not scan a QR code; they type or paste a serial. The **command palette**
(`Ctrl/Cmd+K`) hitting `machines/lookup` is the primary path (`08`, `11`), and it is faster than a
camera.

A camera scanner is still offered where a laptop webcam or a tablet makes sense:

- `<WebScanner>` using the native `BarcodeDetector` API where available, falling back to
  `@zxing/browser`.
- Entry points: the machine search box, and the transfer wizard's "add machine" step (`12`).
- Requires a secure context (HTTPS or localhost) and an explicit camera permission prompt.
  Handle denial gracefully and fall back to manual entry — never leave the user stuck at a dead
  camera view.
- Resolve through `machines/lookup` and report `matchedOn` (`MACHINE` / `BATTERY` / `SIM` / `BOX`)
  so the user knows which sticker matched.
- Continuous mode for the transfer wizard: scan several machines in a row without dismissing,
  with a running list and a duplicate warning.

**Manual entry is always available beside the scanner.** It is the primary input on the web, not
the fallback.

## Acceptance

- [ ] Unread count polls at 60s and on focus; badge appears on the bell and the sidebar.
- [ ] Every notification type has an icon, a tone and a deep link matching the mobile router.
- [ ] Mark-read is optimistic; nothing else in the app is.
- [ ] Preferences screen is honest about which channels apply to which client.
- [ ] Scanner degrades to manual entry on permission denial or an unsupported browser.
- [ ] `matchedOn` is shown after a lookup.
