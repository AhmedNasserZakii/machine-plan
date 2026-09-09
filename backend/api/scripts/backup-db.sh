#!/usr/bin/env bash
#
# `5.4`: nightly PostgreSQL backup, encrypted at rest.
#
# A full logical backup (`pg_dump -Fc`, PostgreSQL's own compressed custom format — supports
# selective/parallel restore, unlike a plain SQL dump), then encrypted with a passphrase that
# never touches this repo (`BACKUP_ENCRYPTION_KEY`, an env var only — refuses to run without one,
# the same fail-closed pattern this session used for `METRICS_TOKEN` in production).
#
# Usage:
#   BACKUP_ENCRYPTION_KEY=... ./scripts/backup-db.sh
#
# Scheduling (host-specific — this script only does the backup itself):
#   cron:      0 2 * * *  BACKUP_ENCRYPTION_KEY=... /path/to/backup-db.sh >> /var/log/machinery-backup.log 2>&1
#   systemd:   a .timer unit calling this script as a .service ExecStart
#   managed Postgres (RDS/Cloud SQL/Supabase/etc.): prefer the platform's own automated backups
#              and point-in-time recovery over this script entirely — see backend/BACKUP_RECOVERY.md.
#
set -uo pipefail

cd "$(dirname "$0")/.."

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="${DB_USERNAME:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-machinery}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-35}"

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "BACKUP_ENCRYPTION_KEY must be set — refusing to write an unencrypted backup." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump_file="$BACKUP_DIR/machinery_${DB_NAME}_${timestamp}.dump"
encrypted_file="${dump_file}.enc"

echo "Dumping $DB_NAME@$DB_HOST:$DB_PORT to $dump_file ..."
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" \
  -Fc -Z 9 -f "$dump_file" || { echo "pg_dump failed"; rm -f "$dump_file"; exit 1; }

echo "Encrypting ..."
openssl enc -aes-256-cbc -pbkdf2 -salt \
  -pass env:BACKUP_ENCRYPTION_KEY \
  -in "$dump_file" -out "$encrypted_file" || { echo "encryption failed"; rm -f "$dump_file" "$encrypted_file"; exit 1; }

# The plaintext dump only ever exists on disk for the few seconds between the two commands above.
rm -f "$dump_file"

size=$(du -h "$encrypted_file" | cut -f1)
echo "Backup written: $encrypted_file ($size)"

echo "Pruning backups older than ${BACKUP_RETENTION_DAYS} days in $BACKUP_DIR ..."
find "$BACKUP_DIR" -name 'machinery_*.dump.enc' -mtime "+${BACKUP_RETENTION_DAYS}" -print -delete

echo "Done."
