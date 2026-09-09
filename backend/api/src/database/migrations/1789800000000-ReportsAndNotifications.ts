import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 9 — reports and notifications (`17`, `18`).
 *
 * Six tables. Five belong to notifications: the template catalogue and its translations, the
 * delivered rows, the per-user opt-outs, and the dedupe keys the scheduled sweeps write. The
 * sixth is `report_jobs`, the only thing a report is permitted to insert (`17`, rule 1).
 *
 * The indexes reports read are created here too. Two of them are worth naming:
 *
 * - `idx_transfer_items_machine_created` is what makes the idle-fleet and lifecycle reports one
 *   indexed probe per machine instead of a scan of every hand-off ever recorded.
 * - `idx_machines_warranty_end` is partial. Retired units never expire a warranty anybody cares
 *   about, and excluding them keeps the index the size of the live fleet rather than of history.
 */
export class ReportsAndNotifications1789800000000 implements MigrationInterface {
  name = 'ReportsAndNotifications1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notification_templates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "code" character varying(40) NOT NULL,
        "entity_type" character varying(30),
        "default_channels" text array NOT NULL,
        "in_app_locked" boolean NOT NULL DEFAULT false,
        "ignores_quiet_hours" boolean NOT NULL DEFAULT false,
        "deep_link_template" text,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "pk_notification_templates" PRIMARY KEY ("id"),
        -- A channel list has to mean something: an empty array would describe a template that
        -- reaches nobody, which is a seeding mistake rather than a configuration.
        CONSTRAINT "chk_notification_templates_channels" CHECK (
          array_length("default_channels", 1) >= 1
          AND "default_channels" <@ ARRAY['PUSH', 'IN_APP']::text[]
        )
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_notification_templates_code" ON "notification_templates" ("code")`,
    );

    await queryRunner.query(`
      CREATE TABLE "notification_template_translations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "locale" character varying(5) NOT NULL,
        "notification_template_id" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "body" text NOT NULL,
        CONSTRAINT "pk_notification_template_translations" PRIMARY KEY ("id"),
        CONSTRAINT "uq_notification_template_locale"
          UNIQUE ("notification_template_id", "locale"),
        CONSTRAINT "fk_ntt_template" FOREIGN KEY ("notification_template_id")
          REFERENCES "notification_templates"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_ntt_locale" ON "notification_template_translations" ("locale")`,
    );

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "template_code" character varying(40) NOT NULL,
        "locale" character varying(5) NOT NULL,
        "title" character varying(200) NOT NULL,
        "body" text NOT NULL,
        "entity_type" character varying(30),
        "entity_id" uuid,
        "deep_link" text,
        "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "read_at" TIMESTAMP WITH TIME ZONE,
        "push_status" character varying(20) NOT NULL,
        "push_skip_reason" character varying(30),
        "push_delivered_count" integer NOT NULL DEFAULT 0,
        "push_sent_at" TIMESTAMP WITH TIME ZONE,
        "push_deferred_until" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "pk_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "fk_notifications_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "chk_notifications_push_status" CHECK (
          "push_status" IN ('PENDING', 'SENT', 'SKIPPED', 'DEFERRED', 'FAILED')
        ),
        -- The point of the column: anything that did not go out has to say why. A row reading
        -- SKIPPED with no reason is indistinguishable from one that was quietly dropped, and
        -- PENDING is the one status that legitimately has nothing to explain yet.
        CONSTRAINT "chk_notifications_push_reason" CHECK (
          ("push_status" = 'SENT' AND "push_skip_reason" IS NULL AND "push_sent_at" IS NOT NULL)
          OR ("push_status" = 'PENDING' AND "push_skip_reason" IS NULL)
          OR ("push_status" IN ('SKIPPED', 'DEFERRED', 'FAILED') AND "push_skip_reason" IS NOT NULL)
        ),
        CONSTRAINT "chk_notifications_deferred_until" CHECK (
          "push_status" <> 'DEFERRED' OR "push_deferred_until" IS NOT NULL
        )
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_notifications_user_created" ON "notifications" ("user_id", "created_at" DESC)`,
    );
    // The badge count is the most frequently hit read in the whole feature — every app resume
    // asks for it — so it gets a partial index the size of the unread set, not of history.
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_unread" ON "notifications" ("user_id") WHERE "read_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_user_template" ON "notifications" ("user_id", "template_code", "created_at" DESC)`,
    );
    // What the hourly flush scans: the pushes quiet hours held back, plus anything left PENDING
    // by a process that died between writing the row and calling the transport.
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_push_pending" ON "notifications" ("created_at")
         WHERE "push_status" IN ('PENDING', 'DEFERRED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "user_id" uuid NOT NULL,
        "template_code" character varying(40) NOT NULL,
        "push" boolean NOT NULL DEFAULT true,
        "in_app" boolean NOT NULL DEFAULT true,
        CONSTRAINT "pk_notification_preferences" PRIMARY KEY ("id"),
        CONSTRAINT "uq_notification_preference" UNIQUE ("user_id", "template_code"),
        CONSTRAINT "fk_notification_preferences_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_notification_preferences_user" ON "notification_preferences" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "notification_dedupe" (
        "key" character varying(200) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_notification_dedupe" PRIMARY KEY ("key")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_notification_dedupe_expires" ON "notification_dedupe" ("expires_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "report_jobs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "report_key" character varying(40) NOT NULL,
        "format" character varying(10) NOT NULL,
        "requested_by_user_id" uuid NOT NULL,
        "filters" jsonb NOT NULL,
        "locale" character varying(5) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'QUEUED',
        "row_count" integer,
        "storage_key" text,
        "filename" character varying(100),
        "mime_type" character varying(120),
        "size_bytes" integer,
        "error_code" character varying(60),
        "started_at" TIMESTAMP WITH TIME ZONE,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "pk_report_jobs" PRIMARY KEY ("id"),
        CONSTRAINT "fk_report_jobs_user" FOREIGN KEY ("requested_by_user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "chk_report_jobs_status" CHECK (
          "status" IN ('QUEUED', 'RUNNING', 'READY', 'FAILED')
        ),
        -- READY is what makes the poll hand out a download URL, so it may not be reached without
        -- the file that URL would point at.
        CONSTRAINT "chk_report_jobs_ready" CHECK (
          "status" <> 'READY'
          OR ("storage_key" IS NOT NULL AND "row_count" IS NOT NULL AND "filename" IS NOT NULL)
        ),
        CONSTRAINT "chk_report_jobs_failed" CHECK (
          "status" <> 'FAILED' OR "error_code" IS NOT NULL
        )
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_report_jobs_user_created" ON "report_jobs" ("requested_by_user_id", "created_at" DESC)`,
    );
    await queryRunner.query(`CREATE INDEX "idx_report_jobs_status" ON "report_jobs" ("status")`);
    await queryRunner.query(
      `CREATE INDEX "idx_report_jobs_expires" ON "report_jobs" ("expires_at")`,
    );

    // A notification stores the text it was rendered with, in the recipient's language — so
    // unlike a request locale, which arrives in `Accept-Language`, this one has to live on the
    // account. NULL means the default locale rather than "unset".
    await queryRunner.query(`ALTER TABLE "users" ADD "preferred_locale" character varying(5)`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "chk_users_preferred_locale"
         CHECK ("preferred_locale" IS NULL OR "preferred_locale" IN ('ar', 'en'))`,
    );

    // ── indexes the reports read ────────────────────────────────────────────
    await queryRunner.query(
      `CREATE INDEX "idx_transfer_items_machine_created" ON "transfer_items" ("machine_id", "created_at" DESC)`,
    );
    // Narrows the index `1789100000000-Machines` created. Same name on purpose: it answers the
    // same question, and two overlapping partial indexes on one column is a write cost paid twice
    // for a read served once.
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_machines_warranty_end"`);
    await queryRunner.query(
      `CREATE INDEX "idx_machines_warranty_end" ON "machines" ("warranty_end")
         WHERE "warranty_end" IS NOT NULL AND "deleted_at" IS NULL
           AND "status" NOT IN ('DECOMMISSIONED', 'REPLACED')`,
    );
    // `transfers-pending` and the reminder sweep both ask "which hand-offs are still unsigned,
    // oldest first", which is this index and nothing else.
    await queryRunner.query(
      `CREATE INDEX "idx_transfers_pending_age" ON "transfers" ("occurred_at")
         WHERE "status" = 'PENDING'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ft_report_date_kind" ON "finance_transactions" ("transaction_date", "kind")
         WHERE "is_voided" = false`,
    );
    // The violations register and the maintenance log both read newest-first, which
    // `idx_violations_created_at` and `idx_mo_sent_at` already serve: a btree scans backwards as
    // cheaply as forwards, so a DESC copy of either would be a second index for no extra plan.
    await queryRunner.query(
      `CREATE INDEX "idx_user_devices_push_token" ON "user_devices" ("user_id")
         WHERE "push_token" IS NOT NULL AND "is_active" = true AND "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const index of REPORT_INDEXES) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${index}"`);
    }

    // Put back the wider version this migration replaced, so a rollback leaves the schema as
    // `1789100000000-Machines` left it rather than one index short.
    await queryRunner.query(
      `CREATE INDEX "idx_machines_warranty_end" ON "machines" ("warranty_end")
         WHERE "warranty_end" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "chk_users_preferred_locale"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "preferred_locale"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "report_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_dedupe"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_preferences"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_template_translations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_templates"`);
  }
}

/** Only the ones hung on pre-existing tables; the rest go with the tables they belong to. */
const REPORT_INDEXES = [
  'idx_transfer_items_machine_created',
  'idx_machines_warranty_end',
  'idx_transfers_pending_age',
  'idx_ft_report_date_kind',
  'idx_user_devices_push_token',
] as const;
