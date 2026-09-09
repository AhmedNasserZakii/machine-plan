import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 — branches, warehouses and the seeded lookup tables with their translation siblings.
 *
 * Hand-written rather than left as generated: `migration:generate` proposed dropping every
 * CHECK constraint, audit FK and partial index added by hand in the Identity migration, because
 * none of those are expressible as entity metadata. Only the additive statements are kept here,
 * plus the constraints TypeORM cannot infer.
 */
export class Organization1788806625250 implements MigrationInterface {
  name = 'Organization1788806625250';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------------------------------------------------------------- organization
    await queryRunner.query(`
      CREATE TABLE "branches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "code" character varying(30) NOT NULL,
        "name" character varying(150) NOT NULL,
        "address" text,
        "phone" character varying(20),
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "pk_branches" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_branches_code" ON "branches" ("code")`);

    await queryRunner.query(`
      CREATE TABLE "warehouses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "branch_id" uuid,
        "type" character varying(30) NOT NULL,
        "name" character varying(150) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "pk_warehouses" PRIMARY KEY ("id"),
        CONSTRAINT "chk_warehouses_type" CHECK ("type" IN ('COMPANY_MAIN', 'BRANCH', 'SCRAP', 'MAINTENANCE'))
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_warehouses_type" ON "warehouses" ("type")`);
    await queryRunner.query(
      `CREATE INDEX "idx_warehouses_branch_id" ON "warehouses" ("branch_id")`,
    );

    /*
     * The warehouse cardinality rules from `06-feature-branches-warehouses.md`. These are
     * partial unique indexes because the uniqueness is conditional on `type`, and they are the
     * real guard: the service pre-checks only exist to turn a violation into a typed error.
     *
     * `deleted_at IS NULL` is added to the plan's definition so that soft-deleting a warehouse
     * frees the slot — without it, a retired company warehouse would permanently block its
     * replacement.
     */
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_single_company_main" ON "warehouses" ("type")
      WHERE "type" = 'COMPANY_MAIN' AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_single_scrap" ON "warehouses" ("type")
      WHERE "type" = 'SCRAP' AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_branch_warehouse" ON "warehouses" ("branch_id")
      WHERE "type" = 'BRANCH' AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "warehouses"
      ADD CONSTRAINT "fk_warehouses_branch_id" FOREIGN KEY ("branch_id")
      REFERENCES "branches"("id") ON DELETE RESTRICT
    `);

    // ---------------------------------------------------------------- lookups
    await this.createLookup(queryRunner, 'machine_types', 'uq_machine_types_code');
    await this.createTranslations(queryRunner, {
      table: 'machine_type_translations',
      parentTable: 'machine_types',
      parentColumn: 'machine_type_id',
      uniqueName: 'uq_machine_type_locale',
      localeIndex: 'idx_mtt_locale',
      withDescription: false,
    });

    await this.createLookup(
      queryRunner,
      'machine_models',
      'uq_machine_models_code',
      `
      "machine_type_id" uuid NOT NULL,
      "manufacturer" character varying(150),
    `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_machine_models_type_id" ON "machine_models" ("machine_type_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "machine_models"
      ADD CONSTRAINT "fk_machine_models_machine_type_id" FOREIGN KEY ("machine_type_id")
      REFERENCES "machine_types"("id") ON DELETE RESTRICT
    `);
    await this.createTranslations(queryRunner, {
      table: 'machine_model_translations',
      parentTable: 'machine_models',
      parentColumn: 'machine_model_id',
      uniqueName: 'uq_machine_model_locale',
      localeIndex: 'idx_mmt_locale',
      withDescription: true,
    });

    await this.createLookup(queryRunner, 'payment_methods', 'uq_payment_methods_code');
    await this.createTranslations(queryRunner, {
      table: 'payment_method_translations',
      parentTable: 'payment_methods',
      parentColumn: 'payment_method_id',
      uniqueName: 'uq_payment_method_locale',
      localeIndex: 'idx_pmt_locale',
      withDescription: false,
    });

    await this.createLookup(
      queryRunner,
      'violation_types',
      'uq_violation_types_code',
      `
      "default_severity" character varying(10) NOT NULL DEFAULT 'MEDIUM',
    `,
    );
    await queryRunner.query(`
      ALTER TABLE "violation_types"
      ADD CONSTRAINT "chk_violation_types_default_severity"
      CHECK ("default_severity" IN ('LOW', 'MEDIUM', 'HIGH'))
    `);
    await this.createTranslations(queryRunner, {
      table: 'violation_type_translations',
      parentTable: 'violation_types',
      parentColumn: 'violation_type_id',
      uniqueName: 'uq_violation_type_locale',
      localeIndex: 'idx_vtt_locale',
      withDescription: true,
    });

    await this.createLookup(queryRunner, 'maintenance_locations', 'uq_maintenance_locations_code');
    await this.createTranslations(queryRunner, {
      table: 'maintenance_location_translations',
      parentTable: 'maintenance_locations',
      parentColumn: 'maintenance_location_id',
      uniqueName: 'uq_maintenance_location_locale',
      localeIndex: 'idx_mlt_locale',
      withDescription: false,
    });

    await this.createLookup(queryRunner, 'decommission_reasons', 'uq_decommission_reasons_code');
    await this.createTranslations(queryRunner, {
      table: 'decommission_reason_translations',
      parentTable: 'decommission_reasons',
      parentColumn: 'decommission_reason_id',
      uniqueName: 'uq_decommission_reason_locale',
      localeIndex: 'idx_drt_locale',
      withDescription: false,
    });

    // ------------------------------------------------- audit FKs for the new tables
    for (const table of AUDITED_TABLES) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ADD CONSTRAINT "fk_${table}_created_by" FOREIGN KEY ("created_by")
        REFERENCES "users"("id") ON DELETE SET NULL
      `);
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ADD CONSTRAINT "fk_${table}_updated_by" FOREIGN KEY ("updated_by")
        REFERENCES "users"("id") ON DELETE SET NULL
      `);
    }

    /*
     * `users.branch_id` has existed since the Identity migration but could not reference
     * `branches` until now. RESTRICT rather than SET NULL: silently unscoping a representative
     * would hand them company-wide visibility.
     */
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "fk_users_branch_id" FOREIGN KEY ("branch_id")
      REFERENCES "branches"("id") ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "fk_users_branch_id"`);

    for (const table of AUDITED_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "fk_${table}_updated_by"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "fk_${table}_created_by"`);
    }

    // Translations first: each has a cascading FK to its parent lookup.
    for (const table of [
      'decommission_reason_translations',
      'maintenance_location_translations',
      'violation_type_translations',
      'payment_method_translations',
      'machine_model_translations',
      'machine_type_translations',
    ]) {
      await queryRunner.query(`DROP TABLE "${table}"`);
    }

    for (const table of [
      'decommission_reasons',
      'maintenance_locations',
      'violation_types',
      'payment_methods',
      'machine_models',
      'machine_types',
      'warehouses',
      'branches',
    ]) {
      await queryRunner.query(`DROP TABLE "${table}"`);
    }
  }

  /** The shared `LookupEntity` shape, plus any table-specific columns. */
  private async createLookup(
    queryRunner: QueryRunner,
    table: string,
    codeIndexName: string,
    extraColumns = '',
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "${table}" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "code" character varying(60) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        ${extraColumns}
        CONSTRAINT "pk_${table}" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "${codeIndexName}" ON "${table}" ("code")`);
  }

  /** The sibling translation table from `02-database-localization-strategy.md`. */
  private async createTranslations(
    queryRunner: QueryRunner,
    options: {
      table: string;
      parentTable: string;
      parentColumn: string;
      uniqueName: string;
      localeIndex: string;
      withDescription: boolean;
    },
  ): Promise<void> {
    const description = options.withDescription ? '"description" text,' : '';

    await queryRunner.query(`
      CREATE TABLE "${options.table}" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "locale" character varying(5) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "name" character varying(255) NOT NULL,
        ${description}
        "${options.parentColumn}" uuid NOT NULL,
        CONSTRAINT "pk_${options.table}" PRIMARY KEY ("id"),
        CONSTRAINT "${options.uniqueName}" UNIQUE ("${options.parentColumn}", "locale"),
        CONSTRAINT "chk_${options.table}_locale" CHECK ("locale" IN ('ar', 'en'))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "${options.localeIndex}" ON "${options.table}" ("locale")`,
    );

    await queryRunner.query(`
      ALTER TABLE "${options.table}"
      ADD CONSTRAINT "fk_${options.table}_parent" FOREIGN KEY ("${options.parentColumn}")
      REFERENCES "${options.parentTable}"("id") ON DELETE CASCADE
    `);
  }
}

/** New tables carrying `created_by` / `updated_by`, which need FKs back to `users`. */
const AUDITED_TABLES = [
  'branches',
  'warehouses',
  'machine_types',
  'machine_models',
  'payment_methods',
  'violation_types',
  'maintenance_locations',
  'decommission_reasons',
] as const;
