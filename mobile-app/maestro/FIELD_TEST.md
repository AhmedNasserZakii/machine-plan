# Field test & Maestro checklist (17.4)

Run this on at least **two real phones** (one Android, one iOS if available) with a poor / intermittent connection before launch.

## Automated

```bash
# Mock API suite
./maestro/run.sh

# Live API suite (API must already be running on :3000)
LIVE=1 ./maestro/run.sh maestro/live/
```

Requires Flutter SDK matching `pubspec` (`sdk: ^3.9.2`) and a booted emulator/device.

## Manual scenarios

| # | Scenario | Pass criteria |
|---|----------|---------------|
| 1 | Arabic RTL + English LTR on Home, Finance, Transfers, Users | No clipped text; amounts/serials stay LTR |
| 2 | Offline create transfer → kill app → reconnect | Sync queue drains; **one** server transfer |
| 3 | Kill app mid photo/signature upload | After relaunch, media retries (no stuck `uploading`) |
| 4 | Low storage (fill device) then capture photo | Clear failure / retry; no silent data loss |
| 5 | Force HTTP 426 (`MIN_CLIENT_VERSION` above app) | Blocking upgrade screen; cannot dismiss into app |
| 6 | Open Arabic PDF + XLSX report export on device | Files open in target apps without garbage glyphs |
| 7 | Permission-denied deep link (revoke mid-session) | Lock screen / safe fallback, no crash |
| 8 | Text scale 1.3× + TalkBack/VoiceOver smoke | Primary actions still ≥ ~48 dp; labels announced |

## Sign-off

| Tester | Device | Date | Notes |
|--------|--------|------|-------|
| | | | |
| | | | |

Re-run failed rows after fixes. Do not ship until rows 1–6 pass on both testers.
