import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3 — machines and their batteries.
 *
 * Hand-written for the same reason as the earlier migrations: the CHECK constraints, the audit
 * FKs and the partial unique indexes are not expressible as entity metadata, and letting
 * `migration:generate` write this file would drop them on the next run.
 */
export class Machines1789100000000 implements MigrationInterface {
  name = 'Machines1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "machines" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "serial" character varying(100) NOT NULL,
        "sim_serial" character varying(100),
        "box_serial" character varying(100),
        "qr_payload" text,
        "machine_model_id" uuid NOT NULL,
        "machine_type_id" uuid NOT NULL,
        "purchase_price" numeric(14,2),
        "purchase_date" date,
        "factory_invoice_no" character varying(80),
        "warranty_start" date,
        "warranty_end" date,
        "status" character varying(40) NOT NULL DEFAULT 'IN_COMPANY_WAREHOUSE',
        "current_branch_id" uuid,
        "current_warehouse_id" uuid,
        "current_holder_type" character varying(20),
        "current_holder_id" uuid,
        "has_box" boolean NOT NULL DEFAULT false,
        "total_repair_cost" numeric(14,2) NOT NULL DEFAULT 0,
        "repair_count" integer NOT NULL DEFAULT 0,
        "replaced_by_machine_id" uuid,
        "replaces_machine_id" uuid,
        "decommissioned_at" TIMESTAMP WITH TIME ZONE,
        "notes" text,
        CONSTRAINT "pk_machines" PRIMARY KEY ("id"),
        CONSTRAINT "chk_machines_status" CHECK ("status" IN (
          'IN_COMPANY_WAREHOUSE', 'IN_BRANCH_WAREHOUSE', 'WITH_SUPERVISOR', 'WITH_REPRESENTATIVE',
          'WITH_MERCHANT', 'IN_TRANSIT', 'UNDER_MAINTENANCE', 'AT_FACTORY', 'AT_SERVICE_CENTER',
          'DECOMMISSIONED', 'REPLACED'
        )),
        CONSTRAINT "chk_machines_holder_type" CHECK ("current_holder_type" IS NULL OR "current_holder_type" IN (
          'FACTORY', 'WAREHOUSE', 'SUPERVISOR', 'REPRESENTATIVE', 'MERCHANT', 'SERVICE_CENTER'
        )),
        CONSTRAINT "chk_machines_holder_pair" CHECK (
          ("current_holder_type" IS NULL AND "current_holder_id" IS NULL)
          OR ("current_holder_type" IS NOT NULL AND "current_holder_id" IS NOT NULL)
          OR ("current_holder_type" = 'FACTORY')
        ),
        CONSTRAINT "chk_machines_warranty_window" CHECK (
          "warranty_start" IS NULL OR "warranty_end" IS NULL OR "warranty_end" >= "warranty_start"
        ),
        CONSTRAINT "chk_machines_repair_totals" CHECK (
          "total_repair_cost" >= 0 AND "repair_count" >= 0
        )
      )
    `);

    /*
     * Serial uniqueness is partial on `deleted_at IS NULL` for the same reason the warehouse
     * indexes are: a soft-deleted row must not reserve a serial that the factory has since
     * reprinted. `sim_serial` and `box_serial` add `IS NOT NULL` on top — Postgres already treats
     * NULLs as distinct, but stating it keeps the index off every SIM-less PIN_PAD.
     */
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_machines_serial" ON "machines" ("serial") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_machines_sim_serial" ON "machines" ("sim_serial") WHERE "deleted_at" IS NULL AND "sim_serial" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_machines_box_serial" ON "machines" ("box_serial") WHERE "deleted_at" IS NULL AND "box_serial" IS NOT NULL`,
    );

    await queryRunner.query(`CREATE INDEX "idx_machines_status" ON "machines" ("status")`);
    await queryRunner.query(
      `CREATE INDEX "idx_machines_holder" ON "machines" ("current_holder_type", "current_holder_id")`,
    );
    // Paired rather than single-column: every branch-scoped fleet list filters on both.
    await queryRunner.query(
      `CREATE INDEX "idx_machines_branch_status" ON "machines" ("current_branch_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_machines_model_id" ON "machines" ("machine_model_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_machines_warranty_end" ON "machines" ("warranty_end") WHERE "warranty_end" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "batteries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "serial" character varying(100) NOT NULL,
        "machine_id" uuid NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "notes" text,
        CONSTRAINT "pk_batteries" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_batteries_serial" ON "batteries" ("serial") WHERE "deleted_at" IS NULL`,
    );
    // The 1↔1 bond: one live battery per machine, enforced here rather than in the service.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_batteries_machine_id" ON "batteries" ("machine_id") WHERE "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      ALTER TABLE "machines"
        ADD CONSTRAINT "fk_machines_model" FOREIGN KEY ("machine_model_id")
          REFERENCES "machine_models"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_machines_type" FOREIGN KEY ("machine_type_id")
          REFERENCES "machine_types"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_machines_branch" FOREIGN KEY ("current_branch_id")
          REFERENCES "branches"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_machines_warehouse" FOREIGN KEY ("current_warehouse_id")
          REFERENCES "warehouses"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_machines_replaced_by" FOREIGN KEY ("replaced_by_machine_id")
          REFERENCES "machines"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_machines_replaces" FOREIGN KEY ("replaces_machine_id")
          REFERENCES "machines"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_machines_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_machines_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "batteries"
        ADD CONSTRAINT "fk_batteries_machine" FOREIGN KEY ("machine_id")
          REFERENCES "machines"("id") ON DELETE CASCADE,
        ADD CONSTRAINT "fk_batteries_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_batteries_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "batteries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "machines"`);
  }
}
