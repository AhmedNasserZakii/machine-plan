import 'reflect-metadata';
// Must come first: it rewrites DB_NAME before the data source reads the environment.
import { TEST_DB_NAME } from './test-env';
import { DataSource } from 'typeorm';

/**
 * Drops the per-run e2e database. Called from `scripts/run-e2e.sh` on every exit path so an
 * interrupted run does not leave `machinery_e2e_<pid>` databases behind.
 *
 * Refuses to touch the shared default, which a developer may be using interactively to inspect
 * the state left by the last run.
 */
async function main(): Promise<void> {
  if (TEST_DB_NAME === 'machinery_e2e') {
    process.stdout.write('refusing to drop the shared e2e database\n');
    return;
  }

  const admin = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD ?? '',
    database: 'postgres',
  });

  await admin.initialize();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}" WITH (FORCE)`);
  } finally {
    await admin.destroy();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
