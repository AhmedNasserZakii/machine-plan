import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  /** TLS without certificate validation is MITM-able; only disable as an explicit opt-out. */
  sslRejectUnauthorized: boolean;
  logging: boolean;
  poolSize: number;
}

export const databaseConfig = registerAs('database', (): DatabaseConfig => ({
  host: process.env.DB_HOST as string,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME as string,
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME as string,
  ssl: process.env.DB_SSL === 'true',
  sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  logging: process.env.DB_LOGGING === 'true',
  poolSize: Number(process.env.DB_POOL_SIZE ?? 20),
}));
