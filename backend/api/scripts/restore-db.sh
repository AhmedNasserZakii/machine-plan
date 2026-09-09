#!/usr/bin/env bash
#
# `5.4`: restores an encrypted backup (from `backup-db.sh`) into a **new** target database only —
# refuses outright if a database by that name already exists, so a restore rehearsal or a real
# incident recovery can never clobber a database still in use by mistake. Pick a fresh name (a
# timestamped one for a rehearsal, or the real name only after the broken database has been
# renamed/dropped deliberately by hand).
#
# Usage:
#   ./scripts/restore-db.sh <encrypted-backup-file> <target-db-name>
#
set -uo pipefail

cd "$(dirname "$0")/.."

BACKUP_FILE="${1:?Usage: restore-db.sh <encrypted-backup-file> <target-db-name>}"
TARGET_DB="${2:?Usage: restore-db.sh <encrypted-backup-file> <target-db-name>}"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="${DB_USERNAME:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "BACKUP_ENCRYPTION_KEY must be set to decrypt the backup." >&2
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "No such file: $BACKUP_FILE" >&2
  exit 1
fi

psql_admin() {
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d postgres -v ON_ERROR_STOP=1 -tAc "$1"
}

existing=$(psql_admin "SELECT 1 FROM pg_database WHERE datname = '$TARGET_DB'")
if [ "$existing" = "1" ]; then
  echo "Database \"$TARGET_DB\" already exists — refusing to restore over it." >&2
  echo "Choose a different target name (e.g. a timestamped one) for a rehearsal." >&2
  exit 1
fi

decrypted_file=$(mktemp)
trap 'rm -f "$decrypted_file"' EXIT

echo "Decrypting $BACKUP_FILE ..."
openssl enc -d -aes-256-cbc -pbkdf2 \
  -pass env:BACKUP_ENCRYPTION_KEY \
  -in "$BACKUP_FILE" -out "$decrypted_file" || { echo "decryption failed — wrong key?"; exit 1; }

echo "Creating database \"$TARGET_DB\" ..."
psql_admin "CREATE DATABASE \"$TARGET_DB\""

echo "Restoring into \"$TARGET_DB\" ..."
PGPASSWORD="$DB_PASSWORD" pg_restore \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$TARGET_DB" \
  --no-owner --no-privileges \
  "$decrypted_file"
restore_status=$?

if [ $restore_status -ne 0 ]; then
  echo "pg_restore reported errors — inspect output above before trusting this database." >&2
fi

echo "Restore complete: \"$TARGET_DB\"."
