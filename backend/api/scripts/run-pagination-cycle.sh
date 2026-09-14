#!/usr/bin/env bash
#
# Full pagination verification cycle:
#   1. Bring up Postgres/Redis/MinIO if needed
#   2. Run the pagination stress e2e (seeds >1 page of every critical list)
#   3. Run the Flutter pagination unit/contract tests
#
# Usage (from repo root or backend/api):
#   ./backend/api/scripts/run-pagination-cycle.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
API="$ROOT/backend/api"
APP="$ROOT/mobile-app"
FLUTTER="${FLUTTER:-$ROOT/../flutter_sdk/flutter/bin/flutter}"
if [[ ! -x "$FLUTTER" ]]; then
  FLUTTER="${FLUTTER:-/Users/ahmednasser/Documents/flutter_sdk/flutter/bin/flutter}"
fi

echo "==> Checking Postgres"
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  if command -v docker >/dev/null 2>&1; then
    echo "==> Starting docker dependencies"
    cd "$ROOT/backend"
    docker compose up -d postgres redis minio minio-init
    for _ in $(seq 1 30); do
      if docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
  else
    echo "Postgres is not reachable on localhost:5432 and docker is unavailable." >&2
    exit 1
  fi
fi

echo "==> Backend pagination e2e"
cd "$API"
export NODE_ENV="${NODE_ENV:-development}"
npm run test:e2e:pagination

echo "==> Flutter pagination tests"
cd "$APP"
"$FLUTTER" test \
  test/paginated_fetch_test.dart \
  test/finance_contract_parsing_test.dart \
  test/sync_contract_parsing_test.dart \
  test/machines_contract_parsing_test.dart \
  test/users_contract_parsing_test.dart \
  test/machine_maintenance_history_cubit_test.dart \
  test/machine_timeline_cubit_test.dart \
  test/merchants_contract_parsing_test.dart

echo "==> Pagination cycle passed"
