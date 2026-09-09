import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 8 — offline support and sync (`20`).
 *
 * Three things: the table behind `Idempotency-Key` replays, `client_uuid` on the records a
 * device creates while it has no connection, and `updated_at` indexes on the tables
 * `GET /sync/delta` scans.
 *
 * `client_uuid` is plain `UNIQUE` rather than a partial index over `deleted_at IS NULL`:
 * Postgres already permits any number of NULLs in a unique column, and a soft-deleted record
 * must keep holding its id — a device replaying a submit for a merchant that was since deleted
 * should be told about the merchant it created, not quietly create a second one.
 */
export class OfflineSync1789700000000 implements MigrationInterface {
  name = 'OfflineSync1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "idempotency_keys" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "key" character varying(120) NOT NULL,
        "user_id" uuid NOT NULL,
        "endpoint" character varying(200) NOT NULL,
        "request_hash" character(64) NOT NULL,
        "status" character varying(20) NOT NULL,
        "status_code" integer,
        "response_body" jsonb,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "pk_idempotency_keys" PRIMARY KEY ("id"),
        -- Scoped to the caller, not global: a lookup by key alone would serve one user the
        -- stored response of another the moment two devices picked the same value.
        CONSTRAINT "uq_idempotency_user_key" UNIQUE ("user_id", "key"),
        CONSTRAINT "chk_idempotency_status" CHECK ("status" IN ('IN_PROGRESS', 'COMPLETED')),
        -- A completed row is only useful if it can be replayed, so the response travels with
        -- the status rather than being allowed to go missing.
        CONSTRAINT "chk_idempotency_completed" CHECK (
          "status" <> 'COMPLETED' OR ("status_code" IS NOT NULL AND "completed_at" IS NOT NULL)
        )
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "idempotency_keys"
        ADD CONSTRAINT "fk_idempotency_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_idempotency_expires_at" ON "idempotency_keys" ("expires_at")`,
    );

    for (const table of CLIENT_CREATED_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD "client_uuid" uuid`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "uq_${table}_client_uuid" UNIQUE ("client_uuid")`,
      );
    }

    // What `GET /sync/delta` orders and filters by. The lookup tables are deliberately not
    // indexed: each holds a few dozen rows that a sequential scan answers faster.
    for (const table of DELTA_TABLES) {
      await queryRunner.query(`CREATE INDEX "idx_${table}_updated" ON "${table}" ("updated_at")`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of DELTA_TABLES) {
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_${table}_updated"`);
    }

    for (const table of CLIENT_CREATED_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "uq_${table}_client_uuid"`,
      );
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "client_uuid"`);
    }

    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_keys"`);
  }
}

/**
 * `transfers` and `finance_transactions` already carry the column from phases 5 and 7. The rest
 * are the records a field user can produce with no connection: a shop registered in the street,
 * a photo taken before the upload can start, a violation filed on the spot, an order opened for
 * a dead machine, and the plan a representative starts while he is standing in the shop.
 */
const CLIENT_CREATED_TABLES = [
  'merchants',
  'media',
  'violations',
  'maintenance_orders',
  'merchant_subscriptions',
] as const;

const DELTA_TABLES = ['machines', 'merchants', 'transfers'] as const;
