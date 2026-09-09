import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline migration: the Postgres extensions the schema depends on.
 *
 * - `pgcrypto`  — `gen_random_uuid()` defaults on every table
 * - `ltree`     — `finance_categories.path` for unlimited nesting (`14`)
 * - `pg_trgm`   — trigram indexes for partial serial / name search (`07`)
 */
export class InitExtensions1757000000000 implements MigrationInterface {
  name = 'InitExtensions1757000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "ltree"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
  }

  public async down(): Promise<void> {
    // Deliberately empty.
    //
    // The comment this replaces claimed to "only drop what we added", but an extension is
    // database-wide, not owned by us: `CREATE EXTENSION IF NOT EXISTS` is a no-op when
    // something else already installed it, and the DROP then removes it anyway. On a shared
    // database, rolling this migration back would take `gen_random_uuid()` out from under
    // every other schema using it.
    //
    // Leaving three extensions installed costs nothing. Dropping them can break neighbours.
  }
}
