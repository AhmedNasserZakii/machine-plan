# 07 — Local Database & Offline Sync

> The single most important file in this plan. A representative must be able to open the app in a
> shop with no signal, scan machines, capture a signature and four photos, and record the hand-off —
> then have all of it arrive correctly hours later.

## Principle: the app talks to the local database, never directly to the network

```
UI → Cubit → Repository ─┬─► LocalDatasource  (always, immediately)
                         └─► RemoteDatasource (when online, or later via SyncService)
```

Reads come from local. Writes go to local **first**, then to the queue. The UI never waits on the
network to show a result.

## Tables

Use whatever the project already has (drift, isar, sembast, sqflite). Structure:

### Cached reference data (read-only mirrors)
`machines`, `batteries`, `merchants`, `branches`, `users_lite`, `machine_types`, `machine_models`,
`payment_methods`, `violation_types`, `maintenance_locations`, `finance_categories`,
`pending_transfers`.

Each carries `updated_at` and a `synced_at` so `/sync/delta` can be incremental.

### The operation queue — the heart of it

```dart
class SyncQueueItem {
  String clientUuid;        // primary key, generated on device
  SyncOperationType type;   // createTransfer, confirmTransfer, createMerchant, createFinanceTx, uploadMedia
  String payloadJson;
  DateTime occurredAt;      // real-world time of the action
  DateTime createdAt;
  int attemptCount;
  DateTime? lastAttemptAt;
  SyncItemStatus status;    // pending, inProgress, failed, conflict, done
  String? errorCode;
  String? errorMessage;
  int priority;             // media uploads = 0 (first), operations = 1
  List<String> dependsOn;   // clientUuids that must succeed first
}
```

`dependsOn` is what makes photos work: a `createTransfer` depends on the `uploadMedia` items for its
photos and signature. The queue processor never sends an operation whose dependencies are unresolved.

### Local media staging

```dart
class PendingMedia {
  String clientUuid;
  String localPath;         // compressed file on device
  MediaPurpose purpose;     // transferPhoto, signature, invoice
  String? serverMediaId;    // filled after upload
  int sizeBytes;
  String checksum;
}
```

## Write path

```dart
Future<ApiResult<TransferModel>> createTransfer(CreateTransferRequest req) async {
  final clientUuid = const Uuid().v4();

  // 1. write locally — the UI updates instantly
  await _local.insertPendingTransfer(req.toLocal(clientUuid));

  // 2. optimistically mark the machines as in-transit locally
  await _local.markMachinesInTransit(req.machineIds);

  // 3. queue the media, then the operation that depends on them
  final mediaUuids = await _local.stagePendingMedia(req.photos, req.signature);
  await _queue.enqueue(SyncQueueItem(
    clientUuid: clientUuid,
    type: SyncOperationType.createTransfer,
    payloadJson: jsonEncode(req.toJson(clientUuid)),
    occurredAt: req.occurredAt,
    dependsOn: mediaUuids,
    priority: 1,
  ));

  // 4. try immediately if online; otherwise it waits
  unawaited(_sync.flush());

  return Success(req.toOptimisticModel(clientUuid));
}
```

**`clientUuid` is generated on the device, before anything else.** It is the identity of the
operation for its whole life and is what makes replays safe (backend `20`).

## SyncService

```dart
class SyncService {
  Future<void> flush() async {
    if (_syncing || !_connectivity.isOnline) return;
    _syncing = true;
    try {
      await _uploadPendingMedia();      // priority 0 first, always
      await _pushOperations();          // in FIFO order, respecting dependsOn
      await _pullDelta();               // then refresh local caches
    } finally {
      _syncing = false;
    }
  }
}
```

**Triggers:**
| Trigger | Why |
|---|---|
| connectivity restored | the obvious one |
| app resumed from background | rep opened the app after leaving the shop |
| after every local write | opportunistic, cheap when online |
| periodic timer (15 min) while foregrounded | catches flaky connections |
| `workmanager` periodic task (~30 min) | flushes even if the app is closed |
| manual pull-to-refresh | the user's escape hatch |

**Backoff:** `attemptCount` drives 1m → 5m → 15m → 1h → 6h, capped. After 10 failed attempts on a
transient error the item is marked `failed` and surfaced to the user rather than retried forever.

## Batch push

Send up to 50 operations in one `POST /sync/batch`. Process the per-item results:

| Result | Local action |
|---|---|
| `SUCCESS` | mark `done`, replace the optimistic row with the server row, keep the local id mapping |
| `DUPLICATE` | mark `done` — this already landed, no error to show |
| `CONFLICT` | mark `conflict`, keep the item, notify the user (see below) |
| `FAILED` + `DISCARD` | mark `failed`, show the reason, offer delete |
| `FAILED` + `RETRY` | leave `pending`, increment `attemptCount` |

## Conflict handling — the important part

**The server always wins on machine custody.** If a rep confirmed a hand-off offline for a machine
that was meanwhile moved by someone else, the local optimistic state is wrong and must be rolled back.

When an item goes to `conflict`:
1. roll back the optimistic local changes for that operation,
2. pull fresh data for the affected machines,
3. show a **blocking, explicit** dialog — never a silent snackbar:

> **العملية دي مش قادرة تتسجل**
> الماكينة SN-00341 اتنقلت لحد تاني وإنت مش متصل بالنت.
> الوضع الحالي: مع المندوب محمد علي.
> [عرض التفاصيل] [حذف العملية]

Silently discarding a signed hand-off is unacceptable — someone physically signed for something.

## Offline UI affordances

| Widget | Behaviour |
|---|---|
| `OfflineBanner` | persistent bar under the app bar when offline: "مافيش نت — الشغل بيتحفظ محليًا" |
| `SyncStatusBadge` | in the app bar: pending count, spinner while syncing, red dot on conflicts |
| Pending item styling | any locally-created row shows a small "لسه مترفعتش" chip |
| Sync queue screen | `/settings/sync` — full list, statuses, errors, manual retry, delete failed |

The sync queue screen is not a debug tool. It is a real user-facing screen, because when a hand-off
does not appear on head office's system, the rep needs to see why.

## What works offline vs what does not

| Works offline | Requires connection |
|---|---|
| viewing cached machines, merchants, categories | first login |
| creating a transfer + signature + photos | changing your password |
| confirming a pending transfer already downloaded | user/role management |
| registering a merchant | report exports |
| recording an expense or income | opening a maintenance order at the factory |
| viewing your own violations | anything the user has not synced before |

Screens in the right column show a clear "محتاج اتصال بالإنترنت" state rather than a spinner that
never resolves.

## Bootstrap vs delta

- First login, or `schemaVersion` mismatch → `GET /sync/bootstrap` (full).
- Otherwise → `GET /sync/delta?since=<lastServerTimestamp>`.
- **Always store the server's `nextSince`**, never the device clock. Device clocks are wrong.

## Storage hygiene

- Compress photos **before** writing them to disk (`13`).
- Delete a staged media file once its `serverMediaId` is confirmed.
- Cap the local cache: keep machines relevant to this user, not all 1,000, unless they are a
  supervisor or Director.
- Show storage used in the settings screen with a "clear cache" action that never touches the queue.

## Testing checklist

- [ ] airplane mode: create a 10-machine transfer with signature and 4 photos → appears locally
- [ ] restore connection → all media uploads, then the operation, exactly once
- [ ] kill the app mid-upload, reopen → resumes without duplicating
- [ ] push the same queue twice → no duplicates (server returns `DUPLICATE`)
- [ ] custody conflict → rollback + dialog, local state matches the server afterwards
- [ ] locale switch → localized caches cleared and re-bootstrapped
- [ ] 200 queued items → sync completes without UI jank
