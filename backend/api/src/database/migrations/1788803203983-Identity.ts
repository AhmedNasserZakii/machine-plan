import { MigrationInterface, QueryRunner } from 'typeorm';
import { SUPPORTED_LOCALES } from 'src/common/constants/locales';
import { PERMISSION_EFFECTS } from 'src/common/enums';
import { DEVICE_PLATFORMS } from 'src/modules/users/entities/user-device.entity';
import { RevokeReason } from 'src/modules/auth/entities/refresh-token.entity';

const quote = (values: readonly string[]): string => values.map((v) => `'${v}'`).join(', ');

const LOCALE_VALUES = quote(SUPPORTED_LOCALES);
const PERMISSION_EFFECT_VALUES = quote(PERMISSION_EFFECTS);
const DEVICE_PLATFORM_VALUES = quote(DEVICE_PLATFORMS);
const REVOKE_REASON_VALUES = quote(Object.values(RevokeReason));

/** Every table in this migration that carries the BaseEntity audit columns. */
const AUDITED_TABLES = [
  'permissions',
  'roles',
  'users',
  'user_permission_overrides',
  'user_devices',
  'refresh_tokens',
] as const;

/**
 * Phase 1 — Identity. Users, roles, the permission catalogue, per-user permission
 * overrides, devices and rotating refresh tokens (`04` and `05`).
 *
 * `users.branch_id` is created without a foreign key here; the constraint is added by the
 * Phase 2 migration that introduces `branches`.
 */
export class Identity1788803203983 implements MigrationInterface {
  name = 'Identity1788803203983';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "permission_translations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "locale" character varying(5) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "permission_id" uuid NOT NULL, "display_name" character varying(255) NOT NULL, "description" text, CONSTRAINT "uq_permission_locale" UNIQUE ("permission_id", "locale"), CONSTRAINT "PK_81e50337773337560ce53147991" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_permission_translations_locale" ON "permission_translations" ("locale") `,
    );
    await queryRunner.query(
      `CREATE TABLE "permissions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "updated_by" uuid, "code" character varying(80) NOT NULL, "group" character varying(50) NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_permissions_code" ON "permissions" ("code") `);
    await queryRunner.query(`CREATE INDEX "idx_permissions_group" ON "permissions" ("group") `);
    await queryRunner.query(
      `CREATE TABLE "role_translations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "locale" character varying(5) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "role_id" uuid NOT NULL, "display_name" character varying(255) NOT NULL, "description" text, CONSTRAINT "uq_role_locale" UNIQUE ("role_id", "locale"), CONSTRAINT "PK_d4b291a34e4535e472c6c42500a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_role_translations_locale" ON "role_translations" ("locale") `,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "updated_by" uuid, "code" character varying(50) NOT NULL, "is_system" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_roles_code" ON "roles" ("code") `);
    await queryRunner.query(
      `CREATE TABLE "user_permission_overrides" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "updated_by" uuid, "user_id" uuid NOT NULL, "permission_id" uuid NOT NULL, "effect" character varying(10) NOT NULL, CONSTRAINT "uq_user_permission_override" UNIQUE ("user_id", "permission_id"), CONSTRAINT "PK_8630d6e8e9664d946595eb6d86a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_permission_overrides_user_id" ON "user_permission_overrides" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "updated_by" uuid, "full_name" character varying(150) NOT NULL, "phone" character varying(20) NOT NULL, "email" character varying(150), "password_hash" character varying(255) NOT NULL, "role_id" uuid NOT NULL, "branch_id" uuid, "is_active" boolean NOT NULL DEFAULT true, "must_change_password" boolean NOT NULL DEFAULT true, "biometric_enabled" boolean NOT NULL DEFAULT false, "signature_image_url" text, "last_login_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_phone" ON "users" ("phone") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email") `);
    await queryRunner.query(`CREATE INDEX "idx_users_role_id" ON "users" ("role_id") `);
    await queryRunner.query(`CREATE INDEX "idx_users_branch_id" ON "users" ("branch_id") `);
    await queryRunner.query(
      `CREATE TABLE "user_devices" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "updated_by" uuid, "user_id" uuid NOT NULL, "device_id" character varying(120) NOT NULL, "device_model" character varying(120), "platform" character varying(10), "push_token" text, "biometric_enrolled" boolean NOT NULL DEFAULT false, "biometric_enrolled_at" TIMESTAMP WITH TIME ZONE, "last_seen_at" TIMESTAMP WITH TIME ZONE, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "uq_user_device" UNIQUE ("user_id", "device_id"), CONSTRAINT "PK_c9e7e648903a9e537347aba4371" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_devices_user_id" ON "user_devices" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "updated_by" uuid, "user_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "device_id" character varying(120), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "revoked_reason" character varying(40), "replaced_by_id" uuid, CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "role_permissions" ("role_id" uuid NOT NULL, "permission_id" uuid NOT NULL, CONSTRAINT "PK_25d24010f53bb80b78e412c9656" PRIMARY KEY ("role_id", "permission_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_178199805b901ccd220ab7740e" ON "role_permissions" ("role_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_17022daf3f885f7d35423e9971" ON "role_permissions" ("permission_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "permission_translations" ADD CONSTRAINT "FK_56c88d8f32bb06434ff662ae873" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_translations" ADD CONSTRAINT "FK_35c7a5c1552d24e8a9503a61244" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "FK_1d942b6fc3eeefb988291fb1286" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "FK_b23ab6a57668ecca2e2398287ea" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_devices" ADD CONSTRAINT "FK_28bd79e1b3f7c1168f0904ce241" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_178199805b901ccd220ab7740ec" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_17022daf3f885f7d35423e9971e" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    // --- CHECK constraints ---
    // Enums are stored as varchar + CHECK rather than native PG enums, so new values
    // ship as a constraint swap instead of an ALTER TYPE (01-architecture-and-conventions).
    for (const table of ['permission_translations', 'role_translations']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "chk_${table}_locale" CHECK ("locale" IN (${LOCALE_VALUES}))`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "chk_user_permission_overrides_effect" CHECK ("effect" IN (${PERMISSION_EFFECT_VALUES}))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_devices" ADD CONSTRAINT "chk_user_devices_platform" CHECK ("platform" IN (${DEVICE_PLATFORM_VALUES}))`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "chk_refresh_tokens_revoked_reason" CHECK ("revoked_reason" IN (${REVOKE_REASON_VALUES}))`,
    );

    // --- audit columns ---
    // `created_by` / `updated_by` are declared as plain UUIDs on BaseEntity to avoid a
    // circular entity dependency; the FKs to `users` are attached here.
    for (const table of AUDITED_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "fk_${table}_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "fk_${table}_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL`,
      );
    }

    // Active refresh tokens are looked up by user for bulk revocation on logout,
    // password change and deactivation.
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_active" ON "refresh_tokens" ("user_id") WHERE "revoked_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_refresh_tokens_active"`);

    for (const table of AUDITED_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "fk_${table}_updated_by"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "fk_${table}_created_by"`);
    }

    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "chk_refresh_tokens_revoked_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_devices" DROP CONSTRAINT "chk_user_devices_platform"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_permission_overrides" DROP CONSTRAINT "chk_user_permission_overrides_effect"`,
    );
    for (const table of ['role_translations', 'permission_translations']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "chk_${table}_locale"`);
    }

    await queryRunner.query(
      `ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_17022daf3f885f7d35423e9971e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_178199805b901ccd220ab7740ec"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_devices" DROP CONSTRAINT "FK_28bd79e1b3f7c1168f0904ce241"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1"`);
    await queryRunner.query(
      `ALTER TABLE "user_permission_overrides" DROP CONSTRAINT "FK_b23ab6a57668ecca2e2398287ea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_permission_overrides" DROP CONSTRAINT "FK_1d942b6fc3eeefb988291fb1286"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_translations" DROP CONSTRAINT "FK_35c7a5c1552d24e8a9503a61244"`,
    );
    await queryRunner.query(
      `ALTER TABLE "permission_translations" DROP CONSTRAINT "FK_56c88d8f32bb06434ff662ae873"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_17022daf3f885f7d35423e9971"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_178199805b901ccd220ab7740e"`);
    await queryRunner.query(`DROP TABLE "role_permissions"`);
    await queryRunner.query(`DROP INDEX "public"."uq_refresh_tokens_token_hash"`);
    await queryRunner.query(`DROP INDEX "public"."idx_refresh_tokens_user_id"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."idx_user_devices_user_id"`);
    await queryRunner.query(`DROP TABLE "user_devices"`);
    await queryRunner.query(`DROP INDEX "public"."idx_users_branch_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_users_role_id"`);
    await queryRunner.query(`DROP INDEX "public"."uq_users_email"`);
    await queryRunner.query(`DROP INDEX "public"."uq_users_phone"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP INDEX "public"."idx_user_permission_overrides_user_id"`);
    await queryRunner.query(`DROP TABLE "user_permission_overrides"`);
    await queryRunner.query(`DROP INDEX "public"."uq_roles_code"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP INDEX "public"."idx_role_translations_locale"`);
    await queryRunner.query(`DROP TABLE "role_translations"`);
    await queryRunner.query(`DROP INDEX "public"."idx_permissions_group"`);
    await queryRunner.query(`DROP INDEX "public"."uq_permissions_code"`);
    await queryRunner.query(`DROP TABLE "permissions"`);
    await queryRunner.query(`DROP INDEX "public"."idx_permission_translations_locale"`);
    await queryRunner.query(`DROP TABLE "permission_translations"`);
  }
}
