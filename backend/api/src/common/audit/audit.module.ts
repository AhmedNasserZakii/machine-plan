import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AuditLog } from './audit-log.entity';
import { AuditQueueService } from './audit-queue.service';
import { AuditService } from './audit.service';

/**
 * `@Global()` so every feature module can inject `AuditService` without importing this module
 * itself — nearly all of them need to. Also registers `AuditInterceptor` as an `APP_INTERCEPTOR`,
 * which needs to sit ahead of `main.ts`'s global interceptors (same reason `IdempotencyModule`
 * does this), and imported once from `AppModule` regardless.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [
    AuditQueueService,
    AuditService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService, AuditQueueService],
})
export class AuditModule {}
