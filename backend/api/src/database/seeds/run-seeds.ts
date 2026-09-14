import 'reflect-metadata';
import dataSource from '../data-source';
import { seedDev } from './seed-dev';
import { seedFinance } from './seed-finance';
import { seedIdentity } from './seed-identity';
import { seedNotifications } from './seed-notifications';
import { seedOrganization } from './seed-organization';
import { seedPagination } from './seed-pagination';
import { SeedLogger } from './seed-logger';

/**
 * Entry point for `npm run seed`. Every seeder must be idempotent, because this runs on
 * every deploy to keep lookup tables and both locales in sync with the code.
 *
 * `npm run seed:dev` adds branches and fixed-password accounts on top. Those are gated on
 * `NODE_ENV` so a known password can never reach production.
 *
 * `npm run seed:pagination` (or `--pagination` with `--dev`) adds ~55 rows per list so
 * default `limit=20` paging and Flutter `fetchAll` walks are forced past one page.
 */
async function run(): Promise<void> {
  const log = new SeedLogger();
  const withDevData = process.argv.includes('--dev');
  const withPagination = process.argv.includes('--pagination');

  // Allowlisted, not blocklisted. Blocking only `production` means an unset, misspelled or
  // newly-added NODE_ENV (`staging`, `prod`, `Production`) silently gets fixed-password
  // accounts — and the one environment where that matters is the one most likely to be
  // configured differently from the developer's laptop.
  if (
    (withDevData || withPagination) &&
    !['development', 'test'].includes(process.env.NODE_ENV ?? '')
  ) {
    throw new Error(
      `Refusing to seed development accounts with NODE_ENV=${process.env.NODE_ENV ?? '(unset)'}; ` +
        'expected development or test',
    );
  }

  await dataSource.initialize();

  try {
    log.section('Identity (permissions, roles, director)');
    await seedIdentity(dataSource, log);

    log.section('Organization (lookups in ar + en, company warehouses)');
    await seedOrganization(dataSource, log);

    log.section('Finance (protected categories in ar + en)');
    await seedFinance(dataSource, log);

    log.section('Notifications (event templates in ar + en)');
    await seedNotifications(dataSource, log);

    if (withDevData || withPagination) {
      log.section('Development data (branches, one account per role)');
      await seedDev(dataSource, log);
    }

    if (withPagination) {
      log.section('Pagination stress data (~55 rows per list)');
      await seedPagination(dataSource, log);
    }

    log.done('Seeding complete');
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  new SeedLogger().fail(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
