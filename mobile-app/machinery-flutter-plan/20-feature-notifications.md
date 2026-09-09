# 20 — Feature: Notifications

## Goal

The representative learns instantly that a delivery needs his signature. The Director learns that a
budget was blown or a warranty is about to lapse. Nobody has to remember to check.

## Screens

| Page | Route |
|---|---|
| `NotificationsListPage` | `/notifications` |
| `NotificationPreferencesPage` | `/settings/notifications` |

## Structure

```
features/notifications/
├── data/
│   ├── models/ (notification_model.dart, notification_preferences_model.dart, device_model.dart)
│   ├── datasources/ (notifications_remote_datasource.dart, notifications_local_datasource.dart)
│   └── repositories/notifications_repository.dart
└── presentation/
    ├── cubit/ (notifications_cubit.dart, notification_badge_cubit.dart,
    │           notification_preferences_cubit.dart) + states
    ├── pages/
    └── widgets/
        ├── notification_tile.dart
        ├── notification_icon.dart
        ├── notification_unread_dot.dart
        ├── notifications_empty_state.dart
        ├── notifications_group_header.dart      # اليوم / امبارح / الأسبوع ده
        ├── mark_all_read_button.dart
        ├── notification_badge.dart              # app bar + bottom nav
        ├── preference_group_tile.dart
        ├── preference_switch_tile.dart
        └── quiet_hours_field.dart
```

## Push setup

Firebase Cloud Messaging (or whatever the project already uses).

1. Request permission **contextually**, not at first launch. Ask after the user's first successful
   hand-off, with an explanation: "عايز نبعتلك إشعار لما تيجي تسليمة محتاجة توقيعك؟" Permission
   requested cold on launch gets denied and is then very hard to recover.
2. Register the FCM token after login (`POST /devices`), refresh on token rotation, delete on logout.
3. Handle all three app states: foreground (in-app banner, no system notification), background
   (system notification → navigate on tap), terminated (store the pending deep link, consume after
   splash + auth — see `06`).

## Payload

```json
{
  "templateCode":"TRANSFER_PENDING",
  "entityType":"transfer",
  "entityId":"…",
  "deepLink":"machinery://transfers/…",
  "notificationId":"…"
}
```

Title and body arrive pre-rendered in the **recipient's** locale from the server (backend `18`).
The app does not build notification text.

## Behaviour by type

| Template | Tapping goes to | In-app treatment |
|---|---|---|
| `TRANSFER_PENDING` | the confirm screen | high priority, also shows `PendingTransferBanner` |
| `TRANSFER_CONFIRMED` / `REJECTED` | transfer detail | normal |
| `VIOLATION_CREATED` / `CHARGED` | violation detail | normal, no alarming sound |
| `BUDGET_WARNING` / `EXCEEDED` | the budget | high priority for EXCEEDED |
| `WARRANTY_EXPIRING` | machine detail | normal |
| `SUBSCRIPTION_DUE` / `OVERDUE` | merchant detail | normal |
| `MACHINE_IDLE` | filtered machine list | low |
| `DECOMMISSION_CANDIDATE` | candidates list | low |

## NotificationsListPage

Grouped by day (`NotificationsGroupHeader`), unread first with `NotificationUnreadDot`,
`NotificationIcon` coloured by type. Tap → mark read + navigate. Swipe → mark read.
`MarkAllReadButton` in the app bar. Infinite scroll.

Cached locally so the list opens instantly and works offline.

## Badge

`NotificationBadgeCubit` is a singleton keeping the unread count fresh from: push receipt, list
read actions, and a poll on app resume. Rendered in the app bar and on the "المزيد" tab.

## Preferences

Per template group, two switches: push / in-app.

**`TRANSFER_PENDING` in-app cannot be disabled** — it is operationally critical and its switch is
shown locked with an explanation. Everything else is the user's choice.

`QuietHoursField` — default 21:00–08:00, respected by the server. Critical alerts
(`TRANSFER_STUCK`, `BUDGET_EXCEEDED`) ignore it; say so under the field so it is not a surprise.

## Rules

1. Never show a notification the user cannot act on. If they lack the permission for the target
   screen, they should not have received it — but guard anyway and route to home rather than an
   error.
2. Deduplicate by `notificationId` — the same push can arrive twice.
3. Clear the badge on the platform when the list is opened.
4. Notifications are informational; the app never takes an action from a notification payload
   without the user opening it.
