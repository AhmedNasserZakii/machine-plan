#!/usr/bin/env bash
# Build or run a flavored Machinery client.
#
# Usage:
#   scripts/run_flavor.sh development
#   scripts/run_flavor.sh staging apk
#   scripts/run_flavor.sh production appbundle
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FLAVOR="${1:-development}"
ACTION="${2:-run}"
CONFIG="$ROOT/config/${FLAVOR}.env.json"

if [[ ! -f "$CONFIG" ]]; then
  echo "Unknown flavor '$FLAVOR'. Expected one of: development, staging, production" >&2
  exit 1
fi

cd "$ROOT"
DEFINES=(--dart-define-from-file="$CONFIG" --flavor "$FLAVOR")

case "$ACTION" in
  run)
    exec flutter run "${DEFINES[@]}"
    ;;
  apk)
    exec flutter build apk --release "${DEFINES[@]}"
    ;;
  appbundle|aab)
    exec flutter build appbundle --release "${DEFINES[@]}"
    ;;
  ios)
    exec flutter build ios --release "${DEFINES[@]}"
    ;;
  ipa)
    exec flutter build ipa --release "${DEFINES[@]}"
    ;;
  *)
    echo "Unknown action '$ACTION'. Use: run | apk | appbundle | ios | ipa" >&2
    exit 1
    ;;
esac
