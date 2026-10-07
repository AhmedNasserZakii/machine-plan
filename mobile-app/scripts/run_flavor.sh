#!/usr/bin/env bash
# Build or run a flavored Machinery client.
#
# 1. Edit config/active_stage.env (FLAVOR + MODE)
# 2. Run:
#      scripts/run_flavor.sh           # flutter run
#      scripts/run_flavor.sh apk       # flutter build apk
#      scripts/run_flavor.sh appbundle
#
# Optional CLI overrides (anything omitted still comes from active_stage.env):
#   scripts/run_flavor.sh staging
#   scripts/run_flavor.sh staging apk
#   scripts/run_flavor.sh apk --mode=profile
#   scripts/run_flavor.sh production apk --mode=production
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE_FILE="$ROOT/config/active_stage.env"

if [[ ! -f "$STAGE_FILE" ]]; then
  echo "Missing $STAGE_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$STAGE_FILE"

FLAVOR="${FLAVOR:-development}"
MODE="${MODE:-debug}"
ACTION="run"

is_flavor() {
  case "$1" in development|staging|production) return 0 ;; *) return 1 ;; esac
}

is_action() {
  case "$1" in run|apk|appbundle|aab|ios|ipa) return 0 ;; *) return 1 ;; esac
}

flutter_mode_flag() {
  case "$1" in
    debug) echo "--debug" ;;
    profile) echo "--profile" ;;
    release|production) echo "--release" ;;
    *)
      echo "Unknown MODE '$1'. Use: debug | profile | production" >&2
      exit 1
      ;;
  esac
}

usage() {
  echo "Usage: scripts/run_flavor.sh [flavor] [action] [--mode=debug|profile|production]" >&2
  echo "Defaults come from config/active_stage.env (FLAVOR + MODE)." >&2
  exit 1
}

for arg in "$@"; do
  case "$arg" in
    --mode=*)
      MODE="${arg#--mode=}"
      ;;
    --help|-h)
      usage
      ;;
    *)
      if is_action "$arg"; then
        ACTION="$arg"
      elif is_flavor "$arg"; then
        FLAVOR="$arg"
      else
        echo "Unknown argument '$arg'." >&2
        usage
      fi
      ;;
  esac
done

CONFIG="$ROOT/config/${FLAVOR}.env.json"
if [[ ! -f "$CONFIG" ]]; then
  echo "Unknown flavor '$FLAVOR'. Expected: development | staging | production" >&2
  echo "Set FLAVOR in $STAGE_FILE or pass it as an argument." >&2
  exit 1
fi

MODE_FLAG="$(flutter_mode_flag "$MODE")"

cd "$ROOT"
DEFINES=(--dart-define-from-file="$CONFIG" --flavor "$FLAVOR")

echo "==> flavor=$FLAVOR mode=$MODE action=$ACTION"
echo "==> config=$CONFIG"

case "$ACTION" in
  run)
    exec flutter run "${DEFINES[@]}" "$MODE_FLAG"
    ;;
  apk)
    exec flutter build apk "$MODE_FLAG" "${DEFINES[@]}"
    ;;
  appbundle|aab)
    exec flutter build appbundle "$MODE_FLAG" "${DEFINES[@]}"
    ;;
  ios)
    exec flutter build ios "$MODE_FLAG" "${DEFINES[@]}"
    ;;
  ipa)
    exec flutter build ipa "$MODE_FLAG" "${DEFINES[@]}"
    ;;
  *)
    echo "Unknown action '$ACTION'. Use: run | apk | appbundle | ios | ipa" >&2
    exit 1
    ;;
esac
