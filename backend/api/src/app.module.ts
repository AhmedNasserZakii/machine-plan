import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { ulid } from 'ulid';
import { AppConfig, configurations, DatabaseConfig, validateEnv } from './config';
import { AuditModule } from './common/audit';
import { CacheModule } from './common/cache';
import { IdempotencyModule } from './common/idempotency';
import { AppThrottlerGuard, AppThrottlerModule } from './common/throttler';
import { AuditLogsModule } from './modules/audit/audit-logs.module';
import {
  BranchScopeGuard,
  ClientVersionGuard,
  JwtAuthGuard,
  PasswordChangeGuard,
  PermissionsGuard,
} from './common/guards';
import { AuthModule } from './modules/auth/auth.module';
import { DecommissionsModule } from './modules/decommissions/decommissions.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HealthModule } from './modules/health/health.module';
import { LookupsModule } from './modules/lookups/lookups.module';
import { MachinesModule } from './modules/machines/machines.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { MediaModule } from './modules/media/media.module';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { ReplacementsModule } from './modules/replacements/replacements.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RolesModule } from './modules/roles/roles.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SyncModule } from './modules/sync/sync.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { UsersModule } from './modules/users/users.module';
import { ViolationsModule } from './modules/violations/violations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: configurations,
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const app = config.getOrThrow<AppConfig>('app');
        return {
          // nestjs-pino defaults to the legacy `*` wildcard, which path-to-regexp v8 warns on.
          forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
          pinoHttp: {
            level: app.logLevel,
            genReqId: (req) => (req.headers['x-request-id'] as string) ?? ulid(),
            autoLogging: { ignore: (req) => req.url === '/health' },
            // Request/response *bodies* are never logged at all (the default serializer only
            // ever includes method/url/query/headers/status/timing — see `backend/LOGGING.md`),
            // so this only has to redact what actually reaches a log line: the two headers that
            // are themselves credentials.
            redact: {
              paths: ['req.headers.authorization', 'req.headers.cookie'],
              censor: '[redacted]',
            },
            // Pretty-printing spawns a worker thread per app instance. That is fine for a
            // dev console, but under test it outlives the run and stops Jest from exiting.
            transport:
              app.isProduction || app.isTest
                ? undefined
                : {
                    target: 'pino-pretty',
                    options: { singleLine: true, translateTime: 'HH:MM:ss' },
                  },
          },
        };
      },
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.getOrThrow<DatabaseConfig>('database');
        return {
          type: 'postgres' as const,
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          ssl: db.ssl ? { rejectUnauthorized: db.sslRejectUnauthorized } : false,
          logging: db.logging,
          // Schema changes ship as migrations only — never let TypeORM touch the schema.
          synchronize: false,
          uuidExtension: 'pgcrypto' as const,
          autoLoadEntities: true,
          // Every report/business-rule date filter is computed in the app as a UTC calendar
          // date (`toDateOnly()`, `report-filters.ts`) and then cast to `::date` in raw SQL —
          // if the session's own timezone is not UTC, that cast lands at midnight in *that*
          // zone instead, silently shifting every date-range boundary by the zone's UTC offset.
          // Discovered for real: a report's `to` boundary excluded rows from the last few hours
          // of "today" whenever the wall clock was past midnight in this machine's local zone
          // (Africa/Cairo, UTC+3) but UTC had not yet ticked over. Forcing every pooled
          // connection to UTC removes the ambiguity at the source rather than chasing it through
          // every date computation in the app.
          extra: { max: db.poolSize, options: '-c timezone=UTC' },
        };
      },
    }),

    CacheModule,
    AppThrottlerModule,
    // Global; provides `AuditService` to every feature module below and registers the request
    // context interceptor ahead of the ones `main.ts` adds.
    AuditModule,
    // Registers the interceptor behind `@Idempotent()`, so it has to be loaded before the
    // feature modules whose endpoints carry the decorator.
    IdempotencyModule,
    HealthModule,
    RolesModule,
    UsersModule,
    AuthModule,
    OrganizationModule,
    LookupsModule,
    MachinesModule,
    MediaModule,
    FinanceModule,
    // Global, so it is loaded before the feature modules whose services inject the dispatcher.
    NotificationsModule,
    MerchantsModule,
    ViolationsModule,
    TransfersModule,
    SettingsModule,
    ReplacementsModule,
    MaintenanceModule,
    DecommissionsModule,
    SyncModule,
    ReportsModule,
    AuditLogsModule,
    MetricsModule,
  ],
  providers: [
    // Order matters: reject a forced-upgrade-eligible client before spending any work on it
    // (including auth — `/auth/login` is where a months-stale app is guaranteed to show up),
    // then authenticate (so a rate-limit key can use the caller's id), then throttle (reject
    // excess traffic before spending work on the checks below it), then force a pending
    // password change, then check permissions, then resolve the branch scope.
    { provide: APP_GUARD, useClass: ClientVersionGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: BranchScopeGuard },
  ],
})
export class AppModule {}
