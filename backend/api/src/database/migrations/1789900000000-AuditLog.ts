import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 9 — audit log (`21`).
 *
 * `audit_logs` is range-partitioned by `created_at` from day one — "retrofitting partitioning
 * later is painful" is the plan's own words, and this table is written to on nearly every
 * mutation in the system.
 *
 * Postgres requires the partition key to be part of every unique index on a partitioned table,
 * primary key included, so the key is `(id, created_at)` rather than `id` alone — `id` is still
 * the real identity, generated once per row by the application.
 *
 * Partitions are created for a rolling window around the moment this migration runs (6 months
 * back, 30 months forward) plus a `DEFAULT` partition that catches anything outside it. The
 * `DEFAULT` partition means a row is never rejected for falling outside the planned range, but an
 * operator still needs to create new monthly partitions ahead of time — see
 * `backend/AUDIT_RETENTION.md`.
 */
export class AuditLog1789900000000 implements MigrationInterface {
  name = 'AuditLog1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid,
        "action" character varying(64) NOT NULL,
        "entity_type" character varying(40),
        "entity_id" uuid,
        "before" jsonb,
        "after" jsonb,
        "request_id" character varying(64),
        "ip_address" inet,
        "user_agent" character varying(255),
        CONSTRAINT "pk_audit_logs" PRIMARY KEY ("id", "created_at")
      ) PARTITION BY RANGE ("created_at")
    `);

    // `SET NULL` rather than `RESTRICT`/`CASCADE`: a user row is never hard-deleted in this
    // system, but if that ever changes the log must survive it — an event with no attributable
    // actor is still evidence that the event happened.
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD CONSTRAINT "fk_audit_logs_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_audit_entity" ON "audit_logs" ("entity_type", "entity_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_audit_user" ON "audit_logs" ("user_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_audit_action" ON "audit_logs" ("action", "created_at" DESC)
    `);
    // The one filter above that is not a prefix of another index — `requestId` is how a
    // support/debugging query ties an audit trail back to a specific API call.
    await queryRunner.query(`
      CREATE INDEX "idx_audit_request" ON "audit_logs" ("request_id") WHERE "request_id" IS NOT NULL
    `);

    for (const { name, from, to } of monthlyPartitionRanges()) {
      await queryRunner.query(`
        CREATE TABLE "${name}" PARTITION OF "audit_logs"
          FOR VALUES FROM ('${from}') TO ('${to}')
      `);
    }

    await queryRunner.query(`
      CREATE TABLE "audit_logs_default" PARTITION OF "audit_logs" DEFAULT
    `);

    // Insert-only from here on: this is what makes the log meaningfully tamper-resistant rather
    // than just conventionally so. Applied to the parent — Postgres does not let a partition's
    // own grants be more permissive than the parent it belongs to, so this alone covers every
    // partition, present and future.
    await queryRunner.query(`
      REVOKE UPDATE, DELETE ON "audit_logs" FROM CURRENT_USER
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`GRANT UPDATE, DELETE ON "audit_logs" TO CURRENT_USER`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs" CASCADE`);
  }
}

/** One `[from, to)` monthly range per calendar month in the window, half-open per Postgres's
 * own `FOR VALUES FROM ... TO ...` convention. */
function monthlyPartitionRanges(): Array<{ name: string; from: string; to: string }> {
  const MONTHS_BACK = 6;
  const MONTHS_FORWARD = 30;

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - MONTHS_BACK, 1));

  const ranges: Array<{ name: string; from: string; to: string }> = [];
  for (let offset = 0; offset < MONTHS_BACK + MONTHS_FORWARD; offset++) {
    const from = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1));
    const to = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset + 1, 1));

    ranges.push({
      name: `audit_logs_${from.getUTCFullYear()}_${String(from.getUTCMonth() + 1).padStart(2, '0')}`,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
  }

  return ranges;
}
