import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 — merchants, their subscriptions, and the violations register.
 *
 * `violations.finance_transaction_id` and `merchant_subscriptions` both point at money that does
 * not exist yet: `finance_transactions` arrives in Phase 7. The columns are created now, without
 * their foreign keys, so charging and collecting can record the amount today and the posting can
 * be wired later without a second migration touching these tables.
 */
export class MerchantsAndViolations1789300000000 implements MigrationInterface {
  name = 'MerchantsAndViolations1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "merchants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "name" character varying(150) NOT NULL,
        "phone" character varying(20) NOT NULL,
        "shop_name" character varying(150) NOT NULL,
        "address" text NOT NULL,
        "national_id" character varying(20),
        "branch_id" uuid,
        "created_by_user_id" uuid NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "notes" text,
        CONSTRAINT "pk_merchants" PRIMARY KEY ("id"),
        CONSTRAINT "chk_merchants_national_id" CHECK (
          "national_id" IS NULL OR "national_id" ~ '^[0-9]{14}$'
        )
      )
    `);

    /*
     * The national ID is the one field that must not repeat: two merchants sharing one is either a
     * typo or the same man registered twice by two representatives. The phone deliberately gets a
     * plain index instead — a shop and its owner share a line often enough that blocking it would
     * only teach the field to invent numbers.
     */
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_merchants_national_id" ON "merchants" ("national_id") WHERE "deleted_at" IS NULL AND "national_id" IS NOT NULL`,
    );
    await queryRunner.query(`CREATE INDEX "idx_merchants_phone" ON "merchants" ("phone")`);
    await queryRunner.query(`CREATE INDEX "idx_merchants_branch_id" ON "merchants" ("branch_id")`);
    await queryRunner.query(
      `CREATE INDEX "idx_merchants_created_by_user" ON "merchants" ("created_by_user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "merchant_subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "merchant_id" uuid NOT NULL,
        "machine_id" uuid,
        "plan_type" character varying(20) NOT NULL,
        "amount" numeric(14,2) NOT NULL DEFAULT 0,
        "start_date" date NOT NULL,
        "end_date" date,
        "next_due_date" date,
        "total_collected" numeric(14,2) NOT NULL DEFAULT 0,
        "collection_count" integer NOT NULL DEFAULT 0,
        "last_collected_at" TIMESTAMP WITH TIME ZONE,
        "is_active" boolean NOT NULL DEFAULT true,
        "notes" text,
        CONSTRAINT "pk_merchant_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "chk_subscriptions_plan_type" CHECK ("plan_type" IN (
          'NONE', 'ONE_TIME_FEE', 'WEEKLY', 'MONTHLY'
        )),
        CONSTRAINT "chk_subscriptions_amount" CHECK ("amount" >= 0 AND "total_collected" >= 0),
        -- A free arrangement that carries a price is a data-entry slip, not a plan.
        CONSTRAINT "chk_subscriptions_none_is_free" CHECK (
          "plan_type" <> 'NONE' OR "amount" = 0
        ),
        CONSTRAINT "chk_subscriptions_window" CHECK (
          "end_date" IS NULL OR "end_date" >= "start_date"
        )
      )
    `);

    /*
     * One live plan per merchant, and one per machine when the plan is per-machine. Two active
     * subscriptions would silently double-bill on the nightly due sweep, and the merchant would be
     * the one to discover it.
     */
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_subscription_active_merchant" ON "merchant_subscriptions" ("merchant_id")
         WHERE "deleted_at" IS NULL AND "is_active" = true AND "machine_id" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_subscription_active_machine" ON "merchant_subscriptions" ("machine_id")
         WHERE "deleted_at" IS NULL AND "is_active" = true AND "machine_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_subscriptions_next_due" ON "merchant_subscriptions" ("next_due_date")
         WHERE "next_due_date" IS NOT NULL AND "is_active" = true`,
    );

    await queryRunner.query(`
      CREATE TABLE "violations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "violation_type_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "machine_id" uuid,
        "transfer_id" uuid,
        "transfer_item_id" uuid,
        "branch_id" uuid,
        "severity" character varying(10) NOT NULL,
        "description" text NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'OPEN',
        "charged_amount" numeric(14,2),
        "payment_method_id" uuid,
        "charged_at" TIMESTAMP WITH TIME ZONE,
        "finance_transaction_id" uuid,
        "waiver_reason" text,
        "acknowledged_at" TIMESTAMP WITH TIME ZONE,
        "resolved_by_user_id" uuid,
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        "auto_generated" boolean NOT NULL DEFAULT false,
        CONSTRAINT "pk_violations" PRIMARY KEY ("id"),
        CONSTRAINT "chk_violations_severity" CHECK ("severity" IN ('LOW', 'MEDIUM', 'HIGH')),
        CONSTRAINT "chk_violations_status" CHECK ("status" IN (
          'OPEN', 'ACKNOWLEDGED', 'WAIVED', 'CHARGED', 'CLOSED'
        )),
        CONSTRAINT "chk_violations_charge" CHECK (
          "charged_amount" IS NULL OR "charged_amount" > 0
        ),
        -- A waiver with no reason is indistinguishable from a quiet deletion, which is the one
        -- thing a disciplinary record must never allow.
        CONSTRAINT "chk_violations_waiver_reason" CHECK (
          "status" <> 'WAIVED' OR "waiver_reason" IS NOT NULL
        )
      )
    `);

    /*
     * The auto-detector runs on every confirm, and a confirm can be replayed by a retrying device.
     * This index is what makes the second run a no-op instead of a second entry on a
     * representative's file. Manual violations carry no item and are not covered by it.
     */
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_violation_auto_per_item_type" ON "violations" ("transfer_item_id", "violation_type_id")
         WHERE "deleted_at" IS NULL AND "transfer_item_id" IS NOT NULL AND "auto_generated" = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_violations_user_status" ON "violations" ("user_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_violations_machine_id" ON "violations" ("machine_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_violations_created_at" ON "violations" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_violations_branch_id" ON "violations" ("branch_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "merchants"
        ADD CONSTRAINT "fk_merchants_branch" FOREIGN KEY ("branch_id")
          REFERENCES "branches"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_merchants_registered_by" FOREIGN KEY ("created_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_merchants_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_merchants_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "merchant_subscriptions"
        ADD CONSTRAINT "fk_subscriptions_merchant" FOREIGN KEY ("merchant_id")
          REFERENCES "merchants"("id") ON DELETE CASCADE,
        ADD CONSTRAINT "fk_subscriptions_machine" FOREIGN KEY ("machine_id")
          REFERENCES "machines"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_subscriptions_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_subscriptions_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "violations"
        ADD CONSTRAINT "fk_violations_type" FOREIGN KEY ("violation_type_id")
          REFERENCES "violation_types"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_violations_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_violations_machine" FOREIGN KEY ("machine_id")
          REFERENCES "machines"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_violations_transfer" FOREIGN KEY ("transfer_id")
          REFERENCES "transfers"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_violations_transfer_item" FOREIGN KEY ("transfer_item_id")
          REFERENCES "transfer_items"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_violations_branch" FOREIGN KEY ("branch_id")
          REFERENCES "branches"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_violations_payment_method" FOREIGN KEY ("payment_method_id")
          REFERENCES "payment_methods"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_violations_resolved_by" FOREIGN KEY ("resolved_by_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_violations_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_violations_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "violations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "merchant_subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "merchants"`);
  }
}
