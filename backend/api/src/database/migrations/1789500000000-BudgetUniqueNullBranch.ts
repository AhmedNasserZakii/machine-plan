import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes the budget uniqueness backstop actually cover company-wide budgets.
 *
 * `budgets.branch_id` is nullable, and null means "the whole company". In a plain unique
 * index two nulls are never equal, so `uq_budgets_category_branch_period` silently permitted
 * any number of identical company-wide budgets for the same category and window — exactly
 * the duplicate the index was added to prevent, and the case a Director is most likely to
 * create twice.
 *
 * `NULLS NOT DISTINCT` (Postgres 15+) treats them as equal, which is what the business rule
 * always meant.
 */
export class BudgetUniqueNullBranch1789500000000 implements MigrationInterface {
  name = 'BudgetUniqueNullBranch1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_budgets_category_branch_period"`);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_budgets_category_branch_period" ON "budgets"
         ("category_id", "branch_id", "period_start", "period_end")
         NULLS NOT DISTINCT
         WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_budgets_category_branch_period"`);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_budgets_category_branch_period" ON "budgets"
         ("category_id", "branch_id", "period_start", "period_end")
         WHERE "deleted_at" IS NULL`,
    );
  }
}
