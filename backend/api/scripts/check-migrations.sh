#!/usr/bin/env bash
#
# `5.1`: proves every migration applies AND reverts cleanly, against a scratch database created
# and dropped for exactly this run — never the dev or e2e database.
#
# Up once, revert every migration one at a time back to empty, then up again: a migration whose
# `down()` is missing/wrong, or that cannot re-apply after its own revert (e.g. a `down()` that
# drops a type an earlier `up()` needs unmodified), fails here instead of surfacing the first time
# someone actually needs to roll back in production.
#
#   ./scripts/check-migrations.sh
#
set -uo pipefail

cd "$(dirname "$0")/.."

export DB_HOST="${DB_HOST:-localhost}"
export DB_PORT="${DB_PORT:-5432}"
export DB_USERNAME="${DB_USERNAME:-postgres}"
export DB_PASSWORD="${DB_PASSWORD:-}"
export DB_NAME="machinery_migrate_check_$$"

psql_admin() {
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d postgres -v ON_ERROR_STOP=1 -c "$1"
}

psql_scratch_query() {
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -t -A -c "$1"
}

cleanup() {
  psql_admin "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE)" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "Creating scratch database $DB_NAME..."
psql_admin "CREATE DATABASE \"$DB_NAME\"" || exit 1

migration_count=$(find src/database/migrations -maxdepth 1 -name '*.ts' | wc -l | tr -d ' ')
echo "$migration_count migration(s) found."

echo "== migration:run (empty -> latest) =="
npm run migration:run || exit 1

echo "== migration:revert x $migration_count (latest -> empty) =="
for i in $(seq 1 "$migration_count"); do
  echo "-- revert $i/$migration_count --"
  npm run migration:revert || { echo "Revert $i/$migration_count failed."; exit 1; }
done

remaining=$(psql_scratch_query "SELECT count(*) FROM migrations" 2>/dev/null | tr -d '[:space:]')
if [ "${remaining:-unknown}" != "0" ]; then
  echo "Expected 0 applied migrations after reverting all of them, found: ${remaining:-<query failed>}"
  exit 1
fi
echo "Confirmed: 0 rows remain in the migrations table."

echo "== migration:run again (empty -> latest, second time) =="
npm run migration:run || exit 1

echo "All $migration_count migrations apply and revert cleanly."
