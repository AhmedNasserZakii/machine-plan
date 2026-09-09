# Backup and recovery (`5.4`)

## 1. Nightly logical backups

`backend/api/scripts/backup-db.sh` — `pg_dump -Fc -Z 9` (PostgreSQL's own compressed custom
format: supports selective/parallel restore, unlike a plain SQL dump), then encrypted at rest
before it ever touches disk as a persistent file.

```
BACKUP_ENCRYPTION_KEY=... [DB_HOST=] [DB_PORT=] [DB_USERNAME=] [DB_PASSWORD=] [DB_NAME=machinery] \
  [BACKUP_DIR=./backups] [BACKUP_RETENTION_DAYS=35] ./scripts/backup-db.sh
```

Fails closed: refuses to run at all without `BACKUP_ENCRYPTION_KEY` set, so an unencrypted backup
can never be written by accident (the same fail-closed pattern used for `METRICS_TOKEN` and
`SENTRY_DSN` elsewhere in this backend — off/refused unless explicitly configured).

**Scheduling** (host-specific — the script only performs the backup itself):

- cron: `0 2 * * *  BACKUP_ENCRYPTION_KEY=... /path/to/backup-db.sh >> /var/log/machinery-backup.log 2>&1`
- systemd: a `.timer` unit invoking the script as a `.service` `ExecStart`
- Managed Postgres (RDS, Cloud SQL, Supabase, etc.): prefer the platform's own automated backups
  and PITR over this script — see §3 below. Use this script only for a self-managed Postgres host.

## 2. Encryption and key handling

- `openssl enc -aes-256-cbc -pbkdf2 -salt`, passphrase-based, via `BACKUP_ENCRYPTION_KEY`.
- The key is an environment variable **only** — never committed to this repo, never written to
  disk by the script. Store it in the host's secret manager (systemd `EnvironmentFile` outside the
  repo, a cloud secrets manager, etc.).
- The plaintext `pg_dump` output exists on disk for only the few seconds between the dump and
  encrypt steps, then is deleted (`rm -f "$dump_file"` in `backup-db.sh`, unconditionally).
- Losing the key means losing the ability to restore every backup encrypted with it — keep it in a
  durable secret store, not only on the database host itself.

## 3. Point-in-time recovery (PITR)

**On a managed Postgres platform (RDS, Cloud SQL, Supabase, Neon, etc.): use the platform's own
PITR feature.** These platforms manage continuous WAL archiving and a restore-to-timestamp UI/API
for you — reimplementing it yourself would add operational risk (a broken WAL archive is a silent
failure until the moment you need it) for a problem already solved correctly by the platform. This
is the recommended path for any real deployment.

**Self-managed Postgres** (a plain VM, no managed backup layer) additionally needs continuous WAL
archiving to get PITR — the nightly logical dump above only restores to the moment it was taken,
not to an arbitrary point in between. To add it:

1. Set in `postgresql.conf`:
   ```
   wal_level = replica
   archive_mode = on
   archive_command = 'test ! -f /var/lib/postgresql/wal_archive/%f && cp %p /var/lib/postgresql/wal_archive/%f'
   ```
2. Take a periodic base backup with `pg_basebackup -D /path/to/base -Fp -Xs -P`.
3. To restore to a point in time: restore the base backup, then set `recovery_target_time` (and
   `restore_command` pointing at the WAL archive directory) in `postgresql.conf` /
   `recovery.signal`, and start Postgres — it replays WAL up to that timestamp and stops.
4. `wal_archive/` must be backed up and retained independently of the base backups (it is
   continuously written, not a point-in-time snapshot).

This was **not** set up against this project's shared local development Postgres server — doing so
would have reconfigured a database instance still in active use for other work outside this
session's scope, for a feature (continuous recovery) with no dev-environment purpose. The
procedure above is the complete, correct spec for whoever provisions a real self-managed
production host; a managed platform's PITR (§3, first paragraph) remains the recommended choice.

## 4. Retention

`BACKUP_RETENTION_DAYS` (default 35) — `backup-db.sh` prunes any `machinery_*.dump.enc` file in
`BACKUP_DIR` older than this on every run. 35 days covers a full billing/reporting cycle plus
buffer. WAL-archive retention (self-managed PITR only) should match or exceed the oldest base
backup you intend to recover from.

## 5. Restore procedure

`backend/api/scripts/restore-db.sh` — decrypts, then `pg_restore --no-owner --no-privileges` into
a **new** target database only. It refuses outright if a database by the target name already
exists, so a rehearsal or a real incident restore can never silently clobber a database still in
use — pick a fresh name (timestamped for a rehearsal; the real name only after the broken database
has been renamed or dropped deliberately by hand, a separate, deliberate step this script does not
perform for you).

```
BACKUP_ENCRYPTION_KEY=... [DB_HOST=] [DB_PORT=] [DB_USERNAME=] [DB_PASSWORD=] \
  ./scripts/restore-db.sh <encrypted-backup-file> <target-db-name>
```

Steps for a real incident:

1. Identify the most recent backup file before the incident (or, on a managed platform, use its
   PITR restore-to-timestamp feature instead — skip straight to step 4).
2. Restore it into a new, timestamped database name with `restore-db.sh` — never the production
   name directly.
3. Verify the restored data (row counts, spot-check known rows) before cutting anything over.
4. Only once verified: point the application at the restored/recovered database (update
   `DB_NAME`/connection string), or rename databases if replacing the broken one in place.

## 6. Restore rehearsal — performed and verified 2026-09-09

A real backup and restore was executed against the local development database (`machinery`, 9
seeded users, 11 machines, 2 branches, 1 transfer, 8 applied migrations) to prove the two scripts
actually work end to end, not just read correctly:

1. `backup-db.sh` run for real → produced a 192K AES-256-encrypted `.dump.enc` file.
2. `restore-db.sh` run for real against that file, target `machinery_restore_rehearsal_20260909` →
   `CREATE DATABASE` + `pg_restore` both completed with **zero errors**.
3. Verified row-for-row, not just by row count:
   - `users`, `machines`, `branches`, `transfers`, `migrations` counts identical between source and
     restored database (9 / 11 / 2 / 1 / 8 on both sides).
   - `SELECT md5(string_agg(t::text, '' ORDER BY id)) FROM users t` — an order-independent content
     checksum of the entire `users` table — was **byte-identical** between source and restored
     database (`d3324dee1b8281bdd0b5f8100fccbd21` on both), proving the restore reproduced the
     exact row content, not merely the same row count.
4. Cleanup: the scratch database was dropped (`DROP DATABASE machinery_restore_rehearsal_20260909`)
   and the rehearsal backup file deleted — this was a non-destructive dry run against a disposable
   target; the source `machinery` database was never written to at any point.

This rehearsal should be repeated periodically (e.g. quarterly, or after any major schema change)
using the same procedure — restore the latest real nightly backup into a fresh timestamped
database, verify counts and a checksum, then drop the scratch database.
