import 'reflect-metadata';
// Must come first: it rewrites DB_NAME before the data source reads the environment.
import { TEST_DB_NAME } from './test-env';
import { DataSource } from 'typeorm';

/**
 * Drops and rebuilds the e2e database from migrations + seeds, giving every run an
 * identical starting point. Wired to `pretest:e2e`, and runnable on its own with
 * `npm run e2e:db:reset`.
 */
async function main(): Promise<void> {
  await recreateDatabase();

  // Imported dynamically so the module-level `dataSourceOptions` sees the patched DB_NAME.
  const { default: dataSource } = await import('src/database/data-source');
  const { seedFinance } = await import('src/database/seeds/seed-finance');
  const { seedIdentity } = await import('src/database/seeds/seed-identity');
  const { seedNotifications } = await import('src/database/seeds/seed-notifications');
  const { seedOrganization } = await import('src/database/seeds/seed-organization');
  const { SeedLogger } = await import('src/database/seeds/seed-logger');

  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
    const log = new SeedLogger();
    await seedIdentity(dataSource, log);
    await seedOrganization(dataSource, log);
    await seedFinance(dataSource, log);
    await seedNotifications(dataSource, log);
  } finally {
    await dataSource.destroy();
  }

  process.stdout.write(`e2e database ready: ${TEST_DB_NAME}\n`);
}

/**
 * Connects to the `postgres` maintenance database, since a database cannot be dropped
 * from a session attached to it.
 */
async function recreateDatabase(): Promise<void> {
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
    // FORCE terminates leftover connections from an interrupted run (Postgres 13+).
    await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  } finally {
    await admin.destroy();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
