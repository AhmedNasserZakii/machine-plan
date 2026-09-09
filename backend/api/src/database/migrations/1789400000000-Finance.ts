import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 7 — the finance ledger: the category tree, suppliers, transactions and budgets.
 *
 * `ltree` is already enabled by `1757000000000-InitExtensions`; the guard here is repeated so this
 * migration can be applied to a database that was built before that baseline existed.
 *
 * `violations.finance_transaction_id` has existed since Phase 5 with nothing to reference, so its
 * foreign key is added at the end of this file rather than in a migration of its own.
 */
export class Finance1789400000000 implements MigrationInterface {
  name = 'Finance1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "ltree"`);

    await queryRunner.query(`
      CREATE TABLE "finance_categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "code" character varying(60),
        "parent_id" uuid,
        "path" ltree NOT NULL,
        "depth" integer NOT NULL DEFAULT 0,
        "kind" character varying(10) NOT NULL,
        "is_system" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "pk_finance_categories" PRIMARY KEY ("id"),
        CONSTRAINT "chk_finance_categories_kind" CHECK ("kind" IN ('EXPENSE', 'INCOME')),
        CONSTRAINT "chk_finance_categories_depth" CHECK ("depth" = nlevel("path") - 1),
        -- A code is the identity other modules post against, so only the seeded system rows
        -- carry one. A user-created category with a code would be indistinguishable from a
        -- system one to the auto-posting lookups.
        CONSTRAINT "chk_finance_categories_system_code" CHECK (
          ("is_system" = false AND "code" IS NULL) OR ("is_system" = true AND "code" IS NOT NULL)
        )
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_finance_categories_code" ON "finance_categories" ("code")
         WHERE "deleted_at" IS NULL AND "code" IS NOT NULL`,
    );
    /*
     * The whole reason for the LTREE column: a roll-up at any depth is one indexed probe of
     * `path <@ :ancestor` rather than a recursive walk per report row, and the reports in `17`
     * ask for exactly that on every category on the screen.
     */
    await queryRunner.query(
      `CREATE INDEX "idx_fc_path_gist" ON "finance_categories" USING GIST ("path")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_finance_categories_parent" ON "finance_categories" ("parent_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_finance_categories_kind" ON "finance_categories" ("kind")`,
    );

    await queryRunner.query(`
      CREATE TABLE "finance_category_translations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "finance_category_id" uuid NOT NULL,
        "locale" character varying(5) NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text,
        CONSTRAINT "pk_finance_category_translations" PRIMARY KEY ("id"),
        CONSTRAINT "uq_finance_category_locale" UNIQUE ("finance_category_id", "locale")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_fct_locale" ON "finance_category_translations" ("locale")`,
    );

    await queryRunner.query(`
      CREATE TABLE "suppliers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "name" character varying(150) NOT NULL,
        "phone" character varying(20),
        "notes" text,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "pk_suppliers" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_suppliers_name" ON "suppliers" ("name")`);

    await queryRunner.query(`
      CREATE TABLE "finance_transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "reference_no" character varying(30) NOT NULL,
        "kind" character varying(10) NOT NULL,
        "amount" numeric(14,2) NOT NULL,
        "category_id" uuid NOT NULL,
        "transaction_date" date NOT NULL,
        "payment_method_id" uuid NOT NULL,
        "branch_id" uuid,
        "supplier_id" uuid,
        "invoice_media_id" uuid,
        "notes" text,
        "source" character varying(20) NOT NULL DEFAULT 'MANUAL',
        "source_ref_type" character varying(30),
        "source_ref_id" uuid,
        "client_uuid" uuid,
        "is_voided" boolean NOT NULL DEFAULT false,
        "voided_by_user_id" uuid,
        "voided_at" TIMESTAMP WITH TIME ZONE,
        "void_reason" text,
        CONSTRAINT "pk_finance_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "uq_finance_transactions_reference_no" UNIQUE ("reference_no"),
        CONSTRAINT "uq_finance_transactions_client_uuid" UNIQUE ("client_uuid"),
        CONSTRAINT "chk_ft_kind" CHECK ("kind" IN ('EXPENSE', 'INCOME')),
        CONSTRAINT "chk_ft_amount" CHECK ("amount" > 0),
        CONSTRAINT "chk_ft_source" CHECK ("source" IN (
          'MANUAL', 'AUTO_MAINTENANCE', 'AUTO_VIOLATION', 'AUTO_SUBSCRIPTION'
        )),
        -- An auto-posted row without its back-link could never be traced to the record that
        -- owns it, which is the only thing allowed to reverse it.
        CONSTRAINT "chk_ft_source_ref" CHECK (
          "source" = 'MANUAL'
          OR ("source_ref_type" IS NOT NULL AND "source_ref_id" IS NOT NULL)
        ),
        -- A void with no reason is indistinguishable from a quiet deletion, which is the one
        -- thing a ledger must never allow.
        CONSTRAINT "chk_ft_void_reason" CHECK (
          "is_voided" = false OR ("void_reason" IS NOT NULL AND "voided_at" IS NOT NULL)
        )
      )
    `);

    /*
     * Every index below is partial on `is_voided = false`, because every aggregate the reports
     * run excludes voided rows: including them would make the index a superset of what is ever
     * scanned and cost a heap visit per row to find out.
     */
    await queryRunner.query(
      `CREATE INDEX "idx_ft_date" ON "finance_transactions" ("transaction_date")
         WHERE "is_voided" = false`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ft_cat_date" ON "finance_transactions" ("category_id", "transaction_date")
         WHERE "is_voided" = false`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ft_branch_date" ON "finance_transactions" ("branch_id", "transaction_date")
         WHERE "is_voided" = false`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ft_kind_date" ON "finance_transactions" ("kind", "transaction_date")
         WHERE "is_voided" = false`,
    );

    /*
     * The guard that makes auto-posting idempotent. A maintenance close or a violation charge
     * replayed by a retrying device finds this index in the way and posts nothing the second
     * time — without it the accounts would quietly double-count every flaky connection in the
     * field. Manual rows carry no back-link and are excluded.
     */
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_ft_source_ref" ON "finance_transactions" ("source_ref_type", "source_ref_id")
         WHERE "source" <> 'MANUAL'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ft_source_ref_id" ON "finance_transactions" ("source_ref_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ft_supplier_id" ON "finance_transactions" ("supplier_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "budgets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "category_id" uuid NOT NULL,
        "branch_id" uuid,
        "period_type" character varying(10) NOT NULL,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "amount" numeric(14,2) NOT NULL,
        "alert_threshold_percent" integer NOT NULL DEFAULT 80,
        "include_subcategories" boolean NOT NULL DEFAULT true,
        "auto_renew" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_alert_level" character varying(10),
        "last_alert_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "pk_budgets" PRIMARY KEY ("id"),
        CONSTRAINT "chk_budgets_period_type" CHECK ("period_type" IN (
          'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM'
        )),
        CONSTRAINT "chk_budgets_amount" CHECK ("amount" > 0),
        CONSTRAINT "chk_budgets_threshold" CHECK (
          "alert_threshold_percent" BETWEEN 1 AND 100
        ),
        CONSTRAINT "chk_budgets_window" CHECK ("period_end" >= "period_start"),
        CONSTRAINT "chk_budgets_alert_level" CHECK (
          "last_alert_level" IS NULL OR "last_alert_level" IN ('OK', 'WARNING', 'EXCEEDED')
        )
      )
    `);

    /*
     * Two budgets covering the same category, branch and window would each report a different
     * percentage of the same spend, and nobody could say which one the Director was looking at.
     * The service rejects any *overlap* with `OVERLAPPING_BUDGET`; this index is the backstop for
     * the exact-duplicate race that slips between the check and the insert.
     */
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_budgets_category_branch_period" ON "budgets"
         ("category_id", "branch_id", "period_start", "period_end")
         WHERE "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      ALTER TABLE "finance_categories"
        ADD CONSTRAINT "fk_finance_categories_parent" FOREIGN KEY ("parent_id")
          REFERENCES "finance_categories"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_finance_categories_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_finance_categories_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "finance_category_translations"
        ADD CONSTRAINT "fk_fct_category" FOREIGN KEY ("finance_category_id")
          REFERENCES "finance_categories"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "suppliers"
        ADD CONSTRAINT "fk_suppliers_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_suppliers_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "finance_transactions"
        ADD CONSTRAINT "fk_ft_category" FOREIGN KEY ("category_id")
          REFERENCES "finance_categories"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_ft_payment_method" FOREIGN KEY ("payment_method_id")
          REFERENCES "payment_methods"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_ft_branch" FOREIGN KEY ("branch_id")
          REFERENCES "branches"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_ft_supplier" FOREIGN KEY ("supplier_id")
          REFERENCES "suppliers"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_ft_invoice_media" FOREIGN KEY ("invoice_media_id")
          REFERENCES "media"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_ft_voided_by" FOREIGN KEY ("voided_by_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_ft_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_ft_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "budgets"
        ADD CONSTRAINT "fk_budgets_category" FOREIGN KEY ("category_id")
          REFERENCES "finance_categories"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_budgets_branch" FOREIGN KEY ("branch_id")
          REFERENCES "branches"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_budgets_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_budgets_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // The column has existed since Phase 5 so a charge could record its amount before the
    // ledger arrived; this is the point at which it can finally be trusted to resolve.
    await queryRunner.query(`
      ALTER TABLE "violations"
        ADD CONSTRAINT "fk_violations_finance_transaction" FOREIGN KEY ("finance_transaction_id")
          REFERENCES "finance_transactions"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "violations" DROP CONSTRAINT IF EXISTS "fk_violations_finance_transaction"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "budgets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "finance_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "suppliers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "finance_category_translations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "finance_categories"`);
  }
}
