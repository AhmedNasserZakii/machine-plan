#!/usr/bin/env bash
#
# Runs the Maestro end-to-end suite against a booted Android emulator.
#
#   ./maestro/run.sh                     # whole suite
#   ./maestro/run.sh --tags smoke        # just the smoke flows
#   SKIP_BUILD=1 ./maestro/run.sh        # reuse the installed APK
#   LIVE=1 ./maestro/run.sh maestro/live/  # drive the real API and database
#
# By default it builds a debug APK pointed at the local mock backend, installs
# it, starts the mock server, and cleans the server up on exit.
#
# LIVE=1 points the APK at the NestJS API on port 3000 instead and leaves the
# mock server out of it. The mock can fake a login but it cannot tell you that
# a merchant actually persisted, so the flows that write records need the real
# stack behind them. Start it first: `node dist/main.js` in backend/api.

set -euo pipefail

APP_ID="com.machinery.machinery.dev"
MOCK_PORT="${MOCK_PORT:-8787}"
LIVE="${LIVE:-0}"
FLAVOR="${FLAVOR:-development}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

adb="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"

# Maestro needs a JRE and does not ship one.
if ! command -v java > /dev/null 2>&1; then
  for candidate in \
    /opt/homebrew/opt/openjdk@17 \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home"; do
    if [ -x "$candidate/bin/java" ]; then
      export JAVA_HOME="$candidate"
      export PATH="$JAVA_HOME/bin:$PATH"
      break
    fi
  done
fi
export PATH="$HOME/.maestro/bin:$PATH"

if ! command -v java > /dev/null 2>&1; then
  echo "error: no Java runtime found; Maestro needs one." >&2
  exit 1
fi

if [ -z "$("$adb" devices | sed -n '2p')" ]; then
  echo "error: no device attached. Start an emulator first, e.g.:" >&2
  echo "  \$ANDROID_HOME/emulator/emulator -avd <avd-name>" >&2
  exit 1
fi

# Emulators reach the host on 10.0.2.2. Physical devices should use the
# machine's LAN IP over Wi-Fi — some OEMs block app traffic to 127.0.0.1 even
# when `adb reverse` is set (Samsung in particular), which shows up as a fake
# "no internet" login failure. Override with HOST_LOOPBACK=… if needed.
is_emulator="$("$adb" shell getprop ro.kernel.qemu | tr -d '\r')"
if [ -n "${HOST_LOOPBACK:-}" ]; then
  host_loopback="$HOST_LOOPBACK"
elif [ "$is_emulator" = "1" ]; then
  host_loopback="10.0.2.2"
else
  host_loopback="$(ipconfig getifaddr en0 2>/dev/null || true)"
  if [ -z "$host_loopback" ]; then
    host_loopback="$(ipconfig getifaddr en1 2>/dev/null || true)"
  fi
  if [ -z "$host_loopback" ]; then
    echo "error: could not resolve LAN IP for the physical device. Set HOST_LOOPBACK=…" >&2
    exit 1
  fi
fi

if [ "$LIVE" = "1" ]; then
  API_PORT="${API_PORT:-3000}"
  API_BASE_URL="http://${host_loopback}:${API_PORT}/api/v1/"
else
  API_BASE_URL="http://${host_loopback}:${MOCK_PORT}/api/v1/"
fi

if [ "$LIVE" = "1" ]; then
  echo "==> using the live API on port ${API_PORT} (device→${host_loopback})"
  # Any HTTP status means the API is up. A rejected login answers 401, which
  # is a perfectly healthy reply, so this must not use curl's -f.
  status="$(curl -s -m 5 -o /dev/null -w '%{http_code}' \
    -X POST "http://127.0.0.1:${API_PORT}/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"phone":"00000000000","password":"wrong"}' || true)"

  if [ "$status" = "000" ] || [ -z "$status" ]; then
    echo "error: nothing answering on port ${API_PORT}. Start the API first:" >&2
    echo "  (cd backend/api && npm run build && node dist/main.js)" >&2
    exit 1
  fi
  echo "    API answered ${status}"
else
  echo "==> starting mock backend on port ${MOCK_PORT} (device→${host_loopback})"
  if [ "$is_emulator" != "1" ]; then
    # Still reverse the mock port as a fallback for USB-only devices.
    "$adb" reverse "tcp:${MOCK_PORT}" "tcp:${MOCK_PORT}" > /dev/null || true
  fi
  python3 maestro/mock_server/server.py --port "$MOCK_PORT" > /tmp/machinery-mock.log 2>&1 &
  mock_pid=$!
  trap 'kill "$mock_pid" 2>/dev/null || true' EXIT

  for _ in $(seq 1 20); do
    if curl -sf -m 1 "http://127.0.0.1:${MOCK_PORT}/api/v1/health" > /dev/null; then
      break
    fi
    sleep 0.25
  done
fi

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "==> building debug APK against ${API_BASE_URL} (flavor=${FLAVOR})"
  # --split-per-abi: a universal debug APK bundles every ABI's native libs
  # and can be 2-3x the size a single emulator/device actually needs, which
  # matters on a storage-constrained AVD shared with other projects.
  flutter build apk --debug --split-per-abi \
    --flavor "$FLAVOR" \
    --dart-define=APP_ENV=development \
    --dart-define=APP_VERSION=1.0.0 \
    --dart-define=API_BASE_URL="$API_BASE_URL" \
    --dart-define=DISABLE_DEVICE_PREVIEW=true
  target_abi="$("$adb" shell getprop ro.product.cpu.abi | tr -d '\r')"
  apk="build/app/outputs/flutter-apk/app-${target_abi}-${FLAVOR}-debug.apk"
  if [ ! -f "$apk" ]; then
    apk="build/app/outputs/flutter-apk/app-${FLAVOR}-debug.apk"
  fi
  if [ ! -f "$apk" ]; then
    apk="build/app/outputs/flutter-apk/app-debug.apk"
  fi
  "$adb" install -r "$apk"
fi

# Animations make assertions racy.
"$adb" shell settings put global window_animation_scale 0
"$adb" shell settings put global transition_animation_scale 0
"$adb" shell settings put global animator_duration_scale 0

echo "==> running flows"
# One shard: given a directory Maestro otherwise fans the flows out in
# parallel, and seven sessions against a single emulator drop the ADB
# connection before the first assertion runs.
if [ "$#" -gt 0 ]; then
  maestro test --shard-split 1 "$@"
else
  maestro test --shard-split 1 maestro/flows/
fi
