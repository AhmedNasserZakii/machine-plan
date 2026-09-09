# Audit Log — Retention, Partitioning & Archival

Operational notes for `audit_logs` (plan `21`). This is documentation, not code — nothing here
is enforced automatically yet; see "Not yet automated" below for what that implies operationally.

## Retention

- **Online retention: 5 years.** A partition (a calendar month) stays in the primary database for
  60 months after the month it covers ends.
- **Never delete a row for an entity that still exists.** If a 5-year-old row's subject (a
  machine, a user, a transfer) is still active in the system, keep the partition online past the
  nominal cutoff rather than archive it away.
- Audit rows are insert-only (`REVOKE UPDATE, DELETE` in migration `1789900000000-AuditLog.ts`).
  Archival therefore only ever *moves* a partition, never edits its rows.

## Partitioning

`audit_logs` is `PARTITION BY RANGE (created_at)`, one partition per calendar month, plus a
`DEFAULT` partition (`audit_logs_default`) that catches anything outside the explicitly created
range so a write is never rejected for landing on an un-provisioned month.

The migration creates partitions for a rolling window computed when it runs: 6 months back through
30 months forward. That window is **not** self-extending — nothing in the codebase currently
creates next month's partition automatically.

### Not yet automated

Until a scheduled job exists, an operator must periodically:

1. Create partitions further out before the window runs out, e.g.:
   ```sql
   CREATE TABLE audit_logs_2029_01 PARTITION OF audit_logs
     FOR VALUES FROM ('2029-01-01') TO ('2029-02-01');
   ```
2. Watch `audit_logs_default` — any row landing there means the explicit window ran out. It is a
   safety net, not a place rows should accumulate; if it starts growing, provisioning is overdue.

A `pg_cron` job that runs `CREATE TABLE ... PARTITION OF ...` for "current month + N" on a
schedule is the natural way to close this gap and is tracked as follow-up work (see backend plan
`23`'s roadmap and the "Backend delivery and production operations" section of
`IMPLEMENTATION_TODO.md`), not implemented as part of this pass.

## Archival

When a partition ages out of the 5-year online window (and nothing it references is still live):

1. `pg_dump` the specific partition table (it is a normal table as far as `pg_dump` is concerned):
   ```sh
   pg_dump -t audit_logs_2026_09 --data-only machinery > audit_logs_2026_09.sql
   ```
2. Store the dump in cold storage (object storage with lifecycle rules, not local disk).
3. Detach and drop the partition from the live table:
   ```sql
   ALTER TABLE audit_logs DETACH PARTITION audit_logs_2026_09;
   DROP TABLE audit_logs_2026_09;
   ```
4. Record what was archived, where, and when — a line in an ops log is enough; the point is that
   "we archived Sept 2026, it's in bucket X" is answerable later without spelunking.

Detach-then-drop rather than a direct `DROP` on the partition-of-a-partitioned-table: detaching
first makes the removal an explicit two-step decision rather than something a careless `DROP TABLE
IF EXISTS` script could do to the wrong partition in one line.

## Tamper resistance

The application database role has `INSERT`/`SELECT` on `audit_logs` and nothing else — `UPDATE`
and `DELETE` are revoked by the migration. This was verified against Postgres's actual stored ACL
(`pg_class.relacl` via `aclexplode`) rather than by attempting a live `UPDATE`/`DELETE`, because a
**superuser bypasses ACL checks entirely** — on a local/dev database (where the connection role is
typically the Postgres superuser created by `initdb`), a real `UPDATE` would misleadingly succeed
even after the `REVOKE`. `test/audit-logs.e2e-spec.ts` asserts the ACL state directly for this
reason. In a production deployment, the application must connect as a **non-superuser** role for
this control to mean anything — if the app's database user is ever granted superuser, this
protection is silently void.

The table owner (whichever role ran the migration) can always `GRANT` the privileges back to
itself — Postgres ownership is not itself revocable this way. The control's value is in removing
the privilege from the *day-to-day application connection*, so an application-level bug or a
compromised app credential cannot silently rewrite history; it does not defend against a database
administrator acting deliberately.
