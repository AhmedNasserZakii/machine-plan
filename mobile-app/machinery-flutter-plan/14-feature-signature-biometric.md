# 14 — Feature: Signature & Biometric Confirmation

## Goal

Every hand-off is confirmed by the person taking custody, using a fingerprint or a drawn signature.
This replaces the paper delivery note, so it has to be at least as trustworthy as one.

## What each method actually proves

| Method | What it proves | Stored |
|---|---|---|
| **Biometric** | the enrolled device verified this user's fingerprint/face at this moment, and the request was authenticated with their token | timestamp, device id, device model, payload hash |
| **Drawn signature** | this person drew this mark while looking at this specific list | the PNG image + timestamp + payload hash |

Neither is a legal e-signature on its own. Together with the audit log and the payload hash, they
are far stronger than a scrawl on a paper form — which is the actual bar to clear.

**The payload hash is what makes it meaningful.** Without it, a signature proves someone tapped a
button; with it, it proves *what they signed for*.

## Structure

```
features/signature/
└── presentation/
    ├── cubit/ (signature_cubit.dart, signature_state.dart)
    ├── pages/signature_capture_page.dart
    └── widgets/
        ├── signature_method_selector.dart
        ├── biometric_prompt_card.dart
        ├── signature_canvas.dart
        ├── signature_canvas_toolbar.dart
        ├── signature_preview.dart
        ├── signature_legal_notice.dart
        ├── signature_payload_summary.dart
        ├── signature_confirm_button.dart
        └── signature_unavailable_fallback.dart
```

## The flow

```
SignatureCapturePage
  ├─ SignaturePayloadSummary      ← what you are signing for, always visible
  ├─ SignatureLegalNotice         ← one clear sentence
  └─ SignatureMethodSelector
       ├─ [بصمة]   → BiometricPromptCard → local_auth → done
       └─ [إمضاء]  → SignatureCanvas → preview → done
```

### `SignaturePayloadSummary` — non-negotiable

The signer must see what they are signing **on the signing screen**, not on a previous one:

```
┌────────────────────────────────────────┐
│ إنت بتوقّع على:                          │
│                                        │
│ استلام ١٢ ماكينة                        │
│ من: محمود عادل (مشرف فرع الإسكندرية)     │
│                                        │
│ ⚠ ٢ ماكينات من غير شاحن                 │
│ ⚠ ١ بطارية مختلفة                       │
│                                        │
│ [عرض التفاصيل الكاملة]                  │
└────────────────────────────────────────┘
```

Anomalies are surfaced in red **before** the signature, never buried in a list.

### Payload hash

Computed on the client from a canonical, deterministic serialisation:

```dart
String computePayloadHash(TransferPayload p) {
  final canonical = jsonEncode({
    'transferId': p.transferId,
    'type': p.type,
    'items': p.items.map((i) => {
      'machineId': i.machineId,
      'batterySerial': i.batterySerialScanned,
      'hasCharger': i.hasCharger,
      'hasBox': i.hasBox,
      'condition': i.condition,
    }).toList()..sort((a, b) => a['machineId'].compareTo(b['machineId'])),
  });
  return sha256.convert(utf8.encode(canonical)).toString();
}
```

Sorting is essential — the same content in a different order must produce the same hash. The server
recomputes it identically and rejects a mismatch with `PAYLOAD_CHANGED` (`13`).

## Biometric path

```dart
final available = await localAuth.canCheckBiometrics && await localAuth.isDeviceSupported();

final ok = await localAuth.authenticate(
  localizedReason: l10n.signatureBiometricReason,   // "أكّد استلامك للماكينات بالبصمة"
  options: const AuthenticationOptions(
    biometricOnly: true,      // no device PIN fallback — a PIN is not a signature
    stickyAuth: true,
  ),
);
```

`biometricOnly: true` matters: falling back to the phone's PIN would mean anyone who knows the PIN
can sign for a delivery.

Sent to the server:
```json
{ "method":"BIOMETRIC", "deviceId":"…", "deviceModel":"Samsung A54",
  "verifiedAt":"…", "payloadHash":"9f2c…" }
```

### When biometric is unavailable

`SignatureUnavailableFallback` explains and routes to the drawn signature. Cases: no hardware, no
enrolled biometrics, hardware locked out after failed attempts, permission denied.
**Never dead-end** — the drawn signature always works.

## Drawn signature path

`SignatureCanvas`:
- full-width, ~200 dp tall, white background, clear border
- stroke width 3, black, smoothed
- `SignatureCanvasToolbar`: مسح / تراجع
- **rejects an empty or near-empty signature** (minimum stroke count and bounding-box area) —
  a single dot is not a signature
- landscape hint on narrow screens

Export: PNG, transparent background, trimmed to the bounding box, downscaled to max 600 px wide,
target under 200 KB. Staged as `PendingMedia` with purpose `SIGNATURE` (`07`), uploaded before the
operation that references it.

## Rules

1. **The signature is always the last step.** No screen after signing except the result.
2. **You cannot sign for someone else.** The screen shows the signer's name from the session, not an
   editable field.
3. Once submitted, a signature is never editable or deletable from the app.
4. Signature capture works **fully offline** — image staged locally, uploaded later.
5. `REPRESENTATIVE_TO_MERCHANT` needs only the representative's signature (the merchant does not
   sign, per the business process). The UI says so explicitly:
   "إنت بتوقّع إنك سلّمت الماكينات للتاجر" — so the rep understands he is attesting, not collecting.
6. Store `deviceId` and `deviceModel` with every signature — it is part of the evidence.

## Viewing signatures

`SignatureDisplayTile` on the transfer detail page shows the image or a fingerprint icon, the
signer's name, the method, the timestamp and the device. Tapping opens the full-size image.
Long-press does **not** offer save or share — this is a record, not a photo.
