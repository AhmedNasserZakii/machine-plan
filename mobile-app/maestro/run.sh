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
# LIVE=1 points the APK at the NestJS API. Default host is the deployed server;
# override with LIVE_API_BASE_URL for a local process (http://127.0.0.1:3000/api/v1/).
# The mock can fake a login but it cannot tell you that a merchant actually
# persisted, so the flows that write records need the real stack behind them.

set -euo pipefail

APP_ID="com.machinery.machinery.dev"
MOCK_PORT="${MOCK_PORT:-8787}"
LIVE="${LIVE:-0}"
FLAVOR="${FLAVOR:-development}"
LIVE_API_BASE_URL="${LIVE_API_BASE_URL:-http://possystem.hrsystem.cloud/api/v1/}"
LIVE_PHONE="${LIVE_PHONE:-01000000000}"
LIVE_PASSWORD="${LIVE_PASSWORD:-PosAdmin#ChangeMe1}"
LIVE_NEW_PASSWORD="${LIVE_NEW_PASSWORD:-PosAdmin#Live2026}"

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

normalize_base() {
  local value="$1"
  case "$value" in
    */) echo "$value" ;;
    *) echo "$value/" ;;
  esac
}

login_json() {
  local base="$1"
  local password="$2"
  curl -sS -m 15 \
    -X POST "${base}auth/login" \
    -H 'Content-Type: application/json' \
    -H 'Accept-Language: ar' \
    -H 'X-Client-Version: 1.0.0' \
    -d "{\"phone\":\"${LIVE_PHONE}\",\"password\":\"${password}\"}" || true
}

login_status() {
  local base="$1"
  local password="$2"
  curl -sS -m 15 -o /dev/null -w '%{http_code}' \
    -X POST "${base}auth/login" \
    -H 'Content-Type: application/json' \
    -H 'Accept-Language: ar' \
    -H 'X-Client-Version: 1.0.0' \
    -d "{\"phone\":\"${LIVE_PHONE}\",\"password\":\"${password}\"}" || true
}

if [ "$LIVE" = "1" ]; then
  API_BASE_URL="$(normalize_base "$LIVE_API_BASE_URL")"
  echo "==> using the live API at ${API_BASE_URL}"

  seed_body="$(login_json "$API_BASE_URL" "$LIVE_PASSWORD")"
  seed_must_change="$(printf '%s' "$seed_body" | python3 -c "
import sys, json
raw = sys.stdin.read()
try:
    body = json.loads(raw)
except Exception:
    print('error')
else:
    data = body.get('data') or {}
    if body.get('success') and data.get('mustChangePassword'):
        print('must-change')
    elif body.get('success'):
        print('ok')
    else:
        print('fail')
" 2>/dev/null || echo error)"

  FLOW_PASSWORD="$LIVE_PASSWORD"
  if [ "$seed_must_change" = "must-change" ]; then
    echo "    bootstrap director must change password on first login"
  elif [ "$seed_must_change" = "ok" ]; then
    echo "    seed password still works (already changed)"
  else
    new_status="$(login_status "$API_BASE_URL" "$LIVE_NEW_PASSWORD")"
    if [ "$new_status" = "200" ]; then
      echo "    seed password already rotated; using LIVE_NEW_PASSWORD"
      FLOW_PASSWORD="$LIVE_NEW_PASSWORD"
    else
      echo "error: live API did not accept the bootstrap director at ${API_BASE_URL}" >&2
      echo "    seed login: ${seed_body:0:300}" >&2
      exit 1
    fi
  fi
else
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

  API_BASE_URL="http://${host_loopback}:${MOCK_PORT}/api/v1/"
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

maestro_env=(
  --env "PHONE=${LIVE_PHONE}"
  --env "PASSWORD=${FLOW_PASSWORD:-Password1}"
  --env "NEW_PASSWORD=${LIVE_NEW_PASSWORD}"
)

echo "==> running flows"
# One shard: given a directory Maestro otherwise fans the flows out in
# parallel, and seven sessions against a single emulator drop the ADB
# connection before the first assertion runs.
if [ "$LIVE" = "1" ] && [ "$#" -eq 0 ]; then
  set -- maestro/live/
fi

if [ "$LIVE" = "1" ] && [ "${seed_must_change:-}" = "must-change" ] && [ "$#" -eq 1 ] && [ "$1" = "maestro/live/" ]; then
  echo "==> phase 1: first login + forced password change"
  maestro test --shard-split 1 "${maestro_env[@]}" \
    maestro/live/L01_director_signs_in_against_the_real_api.yaml
  echo "==> phase 2: remaining live cycle with rotated password"
  maestro test --shard-split 1 \
    --env "PHONE=${LIVE_PHONE}" \
    --env "PASSWORD=${LIVE_NEW_PASSWORD}" \
    --env "NEW_PASSWORD=${LIVE_NEW_PASSWORD}" \
    maestro/live/L02_registering_a_merchant_persists_it.yaml \
    maestro/live/L03_a_duplicate_national_id_is_refused.yaml \
    maestro/live/L04_a_subscription_is_created_and_collected.yaml \
    maestro/live/L05_the_violations_register_opens_and_filters.yaml \
    maestro/live/L06_machines_list_search_and_detail.yaml \
    maestro/live/L07_transfers_list_and_scopes.yaml
elif [ "$#" -gt 0 ]; then
  maestro test --shard-split 1 "${maestro_env[@]}" "$@"
else
  maestro test --shard-split 1 maestro/flows/
fi
