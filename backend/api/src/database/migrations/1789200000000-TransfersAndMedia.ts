import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 4 — the transfer engine, plus the media table signatures and item photos hang off.
 *
 * Two things here cannot be expressed as entity metadata and are the reason this file is
 * hand-written:
 *
 * 1. `uq_machine_pending_transfer`. The plan writes it as a partial index whose predicate
 *    sub-selects `transfers.status`, which Postgres does not allow — index predicates must be
 *    immutable and reference only the indexed row. The denormalized `is_pending` flag plus two
 *    triggers give the same guarantee inside the database, where a race between two phones
 *    dispatching the same machine actually gets decided. Application checks alone would not.
 *
 * 2. `transfer_signatures` has UPDATE and DELETE revoked. A signature that can be edited after
 *    the fact is not evidence.
 */
export class TransfersAndMedia1789200000000 implements MigrationInterface {
  name = 'TransfersAndMedia1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "media" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "storage_key" text NOT NULL,
        "purpose" character varying(30) NOT NULL,
        "mime_type" character varying(100) NOT NULL,
        "size_bytes" bigint NOT NULL,
        "width" integer,
        "height" integer,
        "checksum" character varying(64),
        "is_confirmed" boolean NOT NULL DEFAULT false,
        "confirmed_at" TIMESTAMP WITH TIME ZONE,
        "uploaded_by_user_id" uuid NOT NULL,
        CONSTRAINT "pk_media" PRIMARY KEY ("id"),
        CONSTRAINT "uq_media_storage_key" UNIQUE ("storage_key"),
        CONSTRAINT "chk_media_purpose" CHECK ("purpose" IN (
          'TRANSFER_PHOTO', 'SIGNATURE', 'INVOICE', 'AVATAR'
        ))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_media_purpose_confirmed" ON "media" ("purpose", "is_confirmed")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_media_uploaded_by" ON "media" ("uploaded_by_user_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "media"
        ADD CONSTRAINT "fk_media_uploaded_by" FOREIGN KEY ("uploaded_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_media_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_media_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "transfers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "reference_no" character varying(30) NOT NULL,
        "type" character varying(40) NOT NULL,
        "direction" character varying(10) NOT NULL,
        "from_party_type" character varying(20) NOT NULL,
        "from_party_id" uuid,
        "to_party_type" character varying(20) NOT NULL,
        "to_party_id" uuid,
        "branch_id" uuid,
        "status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "initiated_by_user_id" uuid NOT NULL,
        "confirmed_by_user_id" uuid,
        "confirmed_at" TIMESTAMP WITH TIME ZONE,
        "rejection_reason" text,
        "notes" text,
        "client_uuid" uuid,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "pk_transfers" PRIMARY KEY ("id"),
        CONSTRAINT "uq_transfers_reference_no" UNIQUE ("reference_no"),
        CONSTRAINT "uq_transfers_client_uuid" UNIQUE ("client_uuid"),
        CONSTRAINT "chk_transfers_type" CHECK ("type" IN (
          'FACTORY_TO_COMPANY', 'COMPANY_TO_BRANCH', 'BRANCH_TO_REPRESENTATIVE',
          'REPRESENTATIVE_TO_MERCHANT', 'MERCHANT_TO_REPRESENTATIVE', 'REPRESENTATIVE_TO_BRANCH',
          'BRANCH_TO_COMPANY', 'COMPANY_TO_MAINTENANCE', 'MAINTENANCE_TO_COMPANY',
          'COMPANY_TO_FACTORY', 'FACTORY_TO_COMPANY_RETURN', 'COMPANY_TO_SERVICE_CENTER',
          'SERVICE_CENTER_TO_COMPANY', 'COMPANY_TO_SCRAP'
        )),
        CONSTRAINT "chk_transfers_status" CHECK ("status" IN (
          'PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED'
        )),
        CONSTRAINT "chk_transfers_direction" CHECK ("direction" IN ('OUT', 'RETURN')),
        CONSTRAINT "chk_transfers_from_party" CHECK ("from_party_type" IN (
          'FACTORY', 'WAREHOUSE', 'SUPERVISOR', 'REPRESENTATIVE', 'MERCHANT', 'SERVICE_CENTER'
        )),
        CONSTRAINT "chk_transfers_to_party" CHECK ("to_party_type" IN (
          'FACTORY', 'WAREHOUSE', 'SUPERVISOR', 'REPRESENTATIVE', 'MERCHANT', 'SERVICE_CENTER'
        )),
        CONSTRAINT "chk_transfers_confirmed_fields" CHECK (
          ("status" <> 'CONFIRMED') OR ("confirmed_at" IS NOT NULL AND "confirmed_by_user_id" IS NOT NULL)
        )
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_transfers_status_created" ON "transfers" ("status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_transfers_to_party" ON "transfers" ("to_party_type", "to_party_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_transfers_from_party" ON "transfers" ("from_party_type", "from_party_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_transfers_branch" ON "transfers" ("branch_id", "status")`,
    );
    // Every report reads `occurred_at`, never `created_at`: a hand-off signed in a village on the
    // 30th and synced on the 2nd belongs to the 30th.
    await queryRunner.query(
      `CREATE INDEX "idx_transfers_occurred_at" ON "transfers" ("occurred_at" DESC)`,
    );

    await queryRunner.query(`
      ALTER TABLE "transfers"
        ADD CONSTRAINT "fk_transfers_branch" FOREIGN KEY ("branch_id")
          REFERENCES "branches"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_transfers_initiated_by" FOREIGN KEY ("initiated_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_transfers_confirmed_by" FOREIGN KEY ("confirmed_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_transfers_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_transfers_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "transfer_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "transfer_id" uuid NOT NULL,
        "machine_id" uuid NOT NULL,
        "battery_serial_scanned" character varying(100),
        "battery_matches" boolean,
        "sim_serial_scanned" character varying(100),
        "sim_matches" boolean,
        "box_serial_scanned" character varying(100),
        "box_matches" boolean,
        "has_charger" boolean NOT NULL DEFAULT true,
        "has_box" boolean NOT NULL DEFAULT false,
        "condition" character varying(20) NOT NULL DEFAULT 'GOOD',
        "previous_status" character varying(40) NOT NULL,
        "notes" text,
        "is_pending" boolean NOT NULL DEFAULT true,
        CONSTRAINT "pk_transfer_items" PRIMARY KEY ("id"),
        CONSTRAINT "uq_transfer_item_machine" UNIQUE ("transfer_id", "machine_id"),
        CONSTRAINT "chk_transfer_items_condition" CHECK ("condition" IN (
          'GOOD', 'DAMAGED', 'NOT_WORKING'
        ))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_transfer_items_machine" ON "transfer_items" ("machine_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "transfer_items"
        ADD CONSTRAINT "fk_transfer_items_transfer" FOREIGN KEY ("transfer_id")
          REFERENCES "transfers"("id") ON DELETE CASCADE,
        ADD CONSTRAINT "fk_transfer_items_machine" FOREIGN KEY ("machine_id")
          REFERENCES "machines"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_transfer_items_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_transfer_items_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // The double-dispatch guard. One machine, at most one pending transfer, enforced where two
    // concurrent transactions can actually be serialized.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_machine_pending_transfer"
        ON "transfer_items" ("machine_id")
        WHERE "is_pending" AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE FUNCTION "transfer_items_set_pending"() RETURNS trigger AS $$
      BEGIN
        NEW."is_pending" := (
          SELECT t."status" = 'PENDING' FROM "transfers" t WHERE t."id" = NEW."transfer_id"
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER "trg_transfer_items_set_pending"
        BEFORE INSERT ON "transfer_items"
        FOR EACH ROW EXECUTE FUNCTION "transfer_items_set_pending"()
    `);

    await queryRunner.query(`
      CREATE FUNCTION "transfers_clear_pending"() RETURNS trigger AS $$
      BEGIN
        IF NEW."status" <> 'PENDING' AND OLD."status" = 'PENDING' THEN
          UPDATE "transfer_items" SET "is_pending" = false WHERE "transfer_id" = NEW."id";
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER "trg_transfers_clear_pending"
        AFTER UPDATE OF "status" ON "transfers"
        FOR EACH ROW EXECUTE FUNCTION "transfers_clear_pending"()
    `);

    await queryRunner.query(`
      CREATE TABLE "transfer_item_photos" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "transfer_item_id" uuid NOT NULL,
        "media_id" uuid NOT NULL,
        CONSTRAINT "pk_transfer_item_photos" PRIMARY KEY ("id"),
        CONSTRAINT "uq_transfer_item_photo" UNIQUE ("transfer_item_id", "media_id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "transfer_item_photos"
        ADD CONSTRAINT "fk_transfer_item_photos_item" FOREIGN KEY ("transfer_item_id")
          REFERENCES "transfer_items"("id") ON DELETE CASCADE,
        ADD CONSTRAINT "fk_transfer_item_photos_media" FOREIGN KEY ("media_id")
          REFERENCES "media"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_transfer_item_photos_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_transfer_item_photos_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "transfer_signatures" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "transfer_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "party_role" character varying(20) NOT NULL,
        "method" character varying(20) NOT NULL,
        "signature_media_id" uuid,
        "biometric_verified_at" TIMESTAMP WITH TIME ZONE,
        "device_id" character varying(120),
        "device_model" character varying(120),
        "ip_address" inet,
        "signed_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "payload_hash" character varying(128) NOT NULL,
        CONSTRAINT "pk_transfer_signatures" PRIMARY KEY ("id"),
        CONSTRAINT "chk_transfer_signatures_role" CHECK ("party_role" IN ('SENDER', 'RECEIVER')),
        CONSTRAINT "chk_transfer_signatures_method" CHECK ("method" IN (
          'DRAWN_SIGNATURE', 'BIOMETRIC'
        ))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_transfer_signatures_transfer" ON "transfer_signatures" ("transfer_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "transfer_signatures"
        ADD CONSTRAINT "fk_transfer_signatures_transfer" FOREIGN KEY ("transfer_id")
          REFERENCES "transfers"("id") ON DELETE CASCADE,
        ADD CONSTRAINT "fk_transfer_signatures_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_transfer_signatures_media" FOREIGN KEY ("signature_media_id")
          REFERENCES "media"("id") ON DELETE RESTRICT
    `);

    // Insert-only, at the database level rather than by convention. The role the API connects as
    // simply cannot rewrite history here.
    await queryRunner.query(`
      REVOKE UPDATE, DELETE ON "transfer_signatures" FROM PUBLIC
    `);
    await queryRunner.query(`
      REVOKE UPDATE, DELETE ON "transfer_signatures" FROM CURRENT_USER
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "transfer_signatures"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transfer_item_photos"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_transfers_clear_pending" ON "transfers"`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "trg_transfer_items_set_pending" ON "transfer_items"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "transfer_items"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "transfers_clear_pending"()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "transfer_items_set_pending"()`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transfers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "media"`);
  }
}
