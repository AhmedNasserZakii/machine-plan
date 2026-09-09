import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'node:path';

loadEnv();

const extension = __filename.endsWith('.js') ? 'js' : 'ts';
const rootDir = join(__dirname, '..');

/**
 * Shared options for both the Nest runtime connection and the TypeORM CLI.
 * `synchronize` is hard-coded to false — schema changes only ever ship as migrations.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'machinery',
  ssl:
    process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : false,
  synchronize: false,
  // Use pgcrypto's gen_random_uuid() for id defaults rather than uuid-ossp.
  uuidExtension: 'pgcrypto',
  logging: process.env.DB_LOGGING === 'true',
  entities: [join(rootDir, `modules/**/entities/*.entity.${extension}`)],
  migrations: [join(rootDir, `database/migrations/*.${extension}`)],
  migrationsTableName: 'migrations',
  extra: {
    max: Number(process.env.DB_POOL_SIZE ?? 20),
    // Keep this in sync with `app.module.ts`'s runtime connection — see the comment there for
    // why every connection needs to agree the session is UTC, not the host's local zone.
    options: '-c timezone=UTC',
  },
};

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
