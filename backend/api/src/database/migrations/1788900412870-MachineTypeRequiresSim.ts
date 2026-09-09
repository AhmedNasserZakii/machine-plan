import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `machine_types.requires_sim`, which decides whether `machines.sim_serial` is required at
 * intake (`03-database-schema.md`, `07-feature-machines-batteries.md`).
 *
 * A type-level flag instead of a `NOT NULL` on the machine, because a `PIN_PAD` has no mobile
 * line while every POS variant does. Defaults to true so any type added later is treated as
 * SIM-bearing until someone says otherwise — the safer default, since a missing SIM serial is a
 * data gap you cannot recover once the machine has left the warehouse.
 */
export class MachineTypeRequiresSim1788900412870 implements MigrationInterface {
  name = 'MachineTypeRequiresSim1788900412870';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "machine_types" ADD "requires_sim" boolean NOT NULL DEFAULT true`,
    );

    // The one seeded type that carries no SIM. Written here as well as in the seed so an
    // environment that never re-runs the seeds still ends up correct.
    await queryRunner.query(
      `UPDATE "machine_types" SET "requires_sim" = false WHERE "code" = 'PIN_PAD'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "machine_types" DROP COLUMN "requires_sim"`);
  }
}
