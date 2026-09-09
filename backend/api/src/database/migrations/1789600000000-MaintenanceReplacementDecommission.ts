import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 6 — maintenance orders, the replacement chain, decommission, and the settings table
 * the decommission thresholds live in.
 *
 * The three tables share one migration because they are one story: an order closes as
 * `REPLACED` and writes a `machine_replacements` row, or as `UNREPAIRABLE` and the Director
 * later writes a `decommissions` row. Splitting them would put a foreign key in one file and
 * the table it points at in another.
 */
export class MaintenanceReplacementDecommission1789600000000 implements MigrationInterface {
  name = 'MaintenanceReplacementDecommission1789600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "settings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "key" character varying(80) NOT NULL,
        "value" text NOT NULL,
        CONSTRAINT "pk_settings" PRIMARY KEY ("id")
      )
    `);

    /*
     * Only overrides are stored. A key with no row reads its default from the catalogue in
     * `settings.catalogue.ts`, so a fresh database needs no seeding and a key added in a later
     * release starts working the moment the code ships.
     */
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_settings_key" ON "settings" ("key") WHERE "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "maintenance_orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "reference_no" character varying(30) NOT NULL,
        "machine_id" uuid NOT NULL,
        "maintenance_location_id" uuid NOT NULL,
        "branch_id" uuid,
        "reported_fault" text NOT NULL,
        "sent_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "returned_at" TIMESTAMP WITH TIME ZONE,
        "status" character varying(20) NOT NULL DEFAULT 'OPEN',
        "result" character varying(20),
        "cost" numeric(14,2),
        "is_free_under_warranty" boolean NOT NULL DEFAULT false,
        "suggested_free_under_warranty" boolean NOT NULL DEFAULT false,
        "responsible_party" character varying(20),
        "responsible_user_id" uuid,
        "responsible_merchant_id" uuid,
        "payment_method_id" uuid,
        "supplier_id" uuid,
        "invoice_media_id" uuid,
        "out_transfer_id" uuid,
        "in_transfer_id" uuid,
        -- Workshop technicians are not system users in v1 (11, rule 3). Free text now so the
        -- upgrade to a real account later is a backfill rather than a schema break.
        "performed_by_name" character varying(150),
        "finance_transaction_id" uuid,
        "violation_id" uuid,
        "subscription_id" uuid,
        "closed_by_user_id" uuid,
        "closed_at" TIMESTAMP WITH TIME ZONE,
        "cancelled_at" TIMESTAMP WITH TIME ZONE,
        "cancel_reason" text,
        "notes" text,
        CONSTRAINT "pk_maintenance_orders" PRIMARY KEY ("id"),
        CONSTRAINT "uq_maintenance_orders_reference_no" UNIQUE ("reference_no"),
        CONSTRAINT "chk_mo_status" CHECK ("status" IN (
          'OPEN', 'IN_PROGRESS', 'RETURNED', 'CLOSED', 'CANCELLED'
        )),
        CONSTRAINT "chk_mo_result" CHECK (
          "result" IS NULL OR "result" IN ('REPAIRED', 'REPLACED', 'UNREPAIRABLE')
        ),
        CONSTRAINT "chk_mo_responsible_party" CHECK (
          "responsible_party" IS NULL
          OR "responsible_party" IN ('COMPANY', 'REPRESENTATIVE', 'MERCHANT', 'FACTORY')
        ),
        CONSTRAINT "chk_mo_cost" CHECK ("cost" IS NULL OR "cost" >= 0),
        -- 11, rule 2. A closed order that is neither free nor priced is a repair nobody paid
        -- for, which is the one outcome the finance posting cannot represent.
        CONSTRAINT "chk_mo_closed_is_priced" CHECK (
          "status" <> 'CLOSED'
          OR "is_free_under_warranty" = true
          OR "cost" IS NOT NULL
        ),
        CONSTRAINT "chk_mo_closed_has_result" CHECK (
          "status" <> 'CLOSED' OR ("result" IS NOT NULL AND "responsible_party" IS NOT NULL)
        ),
        -- Who owes the money has to be nameable when it is a person or a shop, or the
        -- violation and the one-off fee have nothing to attach to.
        CONSTRAINT "chk_mo_responsible_subject" CHECK (
          ("responsible_party" <> 'REPRESENTATIVE' OR "responsible_user_id" IS NOT NULL)
          AND ("responsible_party" <> 'MERCHANT' OR "responsible_merchant_id" IS NOT NULL)
        )
      )
    `);

    /*
     * 11, rule 1. The service takes a row lock on the machine before it inserts, so two phones
     * opening an order for the same unit serialize; this index is what holds when they do not
     * go through the service at all — a replayed sync, a script, a future bulk import.
     */
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_machine_open_maintenance" ON "maintenance_orders" ("machine_id")
         WHERE "deleted_at" IS NULL AND "status" IN ('OPEN', 'IN_PROGRESS', 'RETURNED')`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_mo_machine_id" ON "maintenance_orders" ("machine_id")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_mo_status" ON "maintenance_orders" ("status")`);
    await queryRunner.query(
      `CREATE INDEX "idx_mo_branch_id" ON "maintenance_orders" ("branch_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_mo_location_id" ON "maintenance_orders" ("maintenance_location_id")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_mo_sent_at" ON "maintenance_orders" ("sent_at")`);

    await queryRunner.query(`
      CREATE TABLE "machine_replacements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "old_machine_id" uuid NOT NULL,
        "new_machine_id" uuid NOT NULL,
        "maintenance_order_id" uuid,
        "reason" text NOT NULL,
        "replaced_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "pk_machine_replacements" PRIMARY KEY ("id"),
        -- 12, rule 1: the chain is linear, never branching. Both sides are unique, so a unit can
        -- be replaced once and can itself be the replacement for one other unit.
        CONSTRAINT "uq_replacements_old_machine" UNIQUE ("old_machine_id"),
        CONSTRAINT "uq_replacements_new_machine" UNIQUE ("new_machine_id"),
        CONSTRAINT "chk_replacements_distinct" CHECK ("old_machine_id" <> "new_machine_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_replacements_order" ON "machine_replacements" ("maintenance_order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_replacements_replaced_at" ON "machine_replacements" ("replaced_at")`,
    );

    /*
     * The link columns on `machines` carry the same linearity, because the recursive chain query
     * walks them rather than the join table. Without these a bad write could fork the chain and
     * the CTE would return two futures for one serial.
     */
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_machines_replaces" ON "machines" ("replaces_machine_id")
         WHERE "replaces_machine_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_machines_replaced_by" ON "machines" ("replaced_by_machine_id")
         WHERE "replaced_by_machine_id" IS NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "machines"
        ADD CONSTRAINT "chk_machines_replacement_not_self" CHECK (
          "replaces_machine_id" <> "id" AND "replaced_by_machine_id" <> "id"
        )
    `);

    await queryRunner.query(`
      CREATE TABLE "decommissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "machine_id" uuid NOT NULL,
        "decommission_reason_id" uuid NOT NULL,
        "notes" text NOT NULL,
        "decommissioned_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "decommissioned_by_user_id" uuid NOT NULL,
        -- Frozen copies (13, step 4). A later correction to a maintenance cost must not rewrite
        -- the numbers the decision was taken on.
        "purchase_price_at_decision" numeric(14,2),
        "cumulative_repair_cost_at_decision" numeric(14,2) NOT NULL,
        "repair_count_at_decision" integer NOT NULL,
        "chain_length_at_decision" integer NOT NULL DEFAULT 1,
        "transfer_id" uuid,
        "signature_media_id" uuid,
        "reverted_at" TIMESTAMP WITH TIME ZONE,
        "reverted_by_user_id" uuid,
        "revert_reason" text,
        CONSTRAINT "pk_decommissions" PRIMARY KEY ("id"),
        CONSTRAINT "chk_decommissions_snapshot" CHECK (
          "cumulative_repair_cost_at_decision" >= 0 AND "repair_count_at_decision" >= 0
        ),
        -- 13, rule 3: reverting is a loud, reasoned act, never a silent flag flip.
        CONSTRAINT "chk_decommissions_revert_reason" CHECK (
          "reverted_at" IS NULL OR "revert_reason" IS NOT NULL
        )
      )
    `);

    /*
     * One live decommission per machine. Partial on `reverted_at` so a machine brought back into
     * service can be scrapped again later, with both attempts kept on the record.
     */
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_decommissions_live_machine" ON "decommissions" ("machine_id")
         WHERE "deleted_at" IS NULL AND "reverted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_decommissions_at" ON "decommissions" ("decommissioned_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_decommissions_reason" ON "decommissions" ("decommission_reason_id")`,
    );

    /*
     * A repair charged to a merchant is booked as a `ONE_TIME_FEE` (11, step 4), and a shop can
     * owe for two repairs at once — or owe for a repair while a monthly plan is running. The
     * original indexes exist to stop the nightly due sweep double-billing a *recurring* plan,
     * which a one-off settled by a single collection never joins, so it is excluded from both.
     */
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_subscription_active_merchant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_subscription_active_machine"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_subscription_active_merchant" ON "merchant_subscriptions" ("merchant_id")
         WHERE "deleted_at" IS NULL AND "is_active" = true AND "machine_id" IS NULL
           AND "plan_type" <> 'ONE_TIME_FEE'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_subscription_active_machine" ON "merchant_subscriptions" ("machine_id")
         WHERE "deleted_at" IS NULL AND "is_active" = true AND "machine_id" IS NOT NULL
           AND "plan_type" <> 'ONE_TIME_FEE'`,
    );

    await queryRunner.query(`
      ALTER TABLE "settings"
        ADD CONSTRAINT "fk_settings_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_settings_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "maintenance_orders"
        ADD CONSTRAINT "fk_mo_machine" FOREIGN KEY ("machine_id")
          REFERENCES "machines"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_mo_location" FOREIGN KEY ("maintenance_location_id")
          REFERENCES "maintenance_locations"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_mo_branch" FOREIGN KEY ("branch_id")
          REFERENCES "branches"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_mo_responsible_user" FOREIGN KEY ("responsible_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_mo_responsible_merchant" FOREIGN KEY ("responsible_merchant_id")
          REFERENCES "merchants"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_mo_payment_method" FOREIGN KEY ("payment_method_id")
          REFERENCES "payment_methods"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_mo_supplier" FOREIGN KEY ("supplier_id")
          REFERENCES "suppliers"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_mo_invoice_media" FOREIGN KEY ("invoice_media_id")
          REFERENCES "media"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_mo_out_transfer" FOREIGN KEY ("out_transfer_id")
          REFERENCES "transfers"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_mo_in_transfer" FOREIGN KEY ("in_transfer_id")
          REFERENCES "transfers"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_mo_finance_transaction" FOREIGN KEY ("finance_transaction_id")
          REFERENCES "finance_transactions"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_mo_violation" FOREIGN KEY ("violation_id")
          REFERENCES "violations"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_mo_subscription" FOREIGN KEY ("subscription_id")
          REFERENCES "merchant_subscriptions"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_mo_closed_by" FOREIGN KEY ("closed_by_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_mo_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_mo_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "machine_replacements"
        ADD CONSTRAINT "fk_replacements_old_machine" FOREIGN KEY ("old_machine_id")
          REFERENCES "machines"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_replacements_new_machine" FOREIGN KEY ("new_machine_id")
          REFERENCES "machines"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_replacements_order" FOREIGN KEY ("maintenance_order_id")
          REFERENCES "maintenance_orders"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_replacements_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_replacements_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "decommissions"
        ADD CONSTRAINT "fk_decommissions_machine" FOREIGN KEY ("machine_id")
          REFERENCES "machines"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_decommissions_reason" FOREIGN KEY ("decommission_reason_id")
          REFERENCES "decommission_reasons"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_decommissions_by" FOREIGN KEY ("decommissioned_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_decommissions_transfer" FOREIGN KEY ("transfer_id")
          REFERENCES "transfers"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_decommissions_signature_media" FOREIGN KEY ("signature_media_id")
          REFERENCES "media"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_decommissions_reverted_by" FOREIGN KEY ("reverted_by_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_decommissions_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_decommissions_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "machines" DROP CONSTRAINT IF EXISTS "chk_machines_replacement_not_self"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_machines_replaces"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_machines_replaced_by"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "uq_subscription_active_merchant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_subscription_active_machine"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_subscription_active_merchant" ON "merchant_subscriptions" ("merchant_id")
         WHERE "deleted_at" IS NULL AND "is_active" = true AND "machine_id" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_subscription_active_machine" ON "merchant_subscriptions" ("machine_id")
         WHERE "deleted_at" IS NULL AND "is_active" = true AND "machine_id" IS NOT NULL`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "decommissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "machine_replacements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "maintenance_orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "settings"`);
  }
}
