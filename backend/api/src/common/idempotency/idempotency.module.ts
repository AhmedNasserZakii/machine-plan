import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';
import { IdempotencyKeyRecord } from './idempotency-key.entity';
import { IdempotencyService } from './idempotency.service';

/**
 * The interceptor is bound here rather than in `main.ts` because it needs injection. Binding it
 * through the module also lands it ahead of `TimeoutInterceptor` and `ResponseInterceptor` —
 * module-provided interceptors are registered while the app is being created, before `main.ts`
 * calls `useGlobalInterceptors` — which is the position it needs: outermost, seeing the response
 * exactly as the client will.
 */
@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyKeyRecord])],
  providers: [IdempotencyService, { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor }],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
