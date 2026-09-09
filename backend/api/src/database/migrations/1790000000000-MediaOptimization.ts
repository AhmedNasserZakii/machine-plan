import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 10 — server-side media optimization (`19`, `3.2`).
 *
 * `width`/`height`/`checksum` already existed on `media` (unused until now). This adds the two
 * columns the optimize worker needs to hand back a thumbnail without a second `media` row:
 * `thumbnail_key` points at the 320px WebP variant, and `is_optimized`/`optimized_at` record
 * whether — and when — the worker has run. `storage_key` and `size_bytes` are overwritten in
 * place when optimization succeeds, so no separate "optimized size" column is needed; the
 * pre-optimization values are simply superseded, matching what the row's `updated_at` already
 * implies happened.
 */
export class MediaOptimization1790000000000 implements MigrationInterface {
  name = 'MediaOptimization1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "media"
        ADD "thumbnail_key" text,
        ADD "is_optimized" boolean NOT NULL DEFAULT false,
        ADD "optimized_at" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "media"
        DROP COLUMN IF EXISTS "optimized_at",
        DROP COLUMN IF EXISTS "is_optimized",
        DROP COLUMN IF EXISTS "thumbnail_key"
    `);
  }
}
