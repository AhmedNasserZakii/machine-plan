import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../audit/audit.service';
import { runWithAuditContext } from '../audit/audit-context';
import { AUDIT_FINANCE_READ_KEY } from '../decorators/audit-finance-read.decorator';
import { AuditAction, AuditEntityType } from '../enums/audit.enum';
import { RequestContext } from '../types/request.types';

/**
 * Two unrelated jobs, both global for the same reason — neither can be left to a call site to
 * remember (`21`):
 *
 * 1. Makes the request id, IP and user agent available to every `AuditService.record()` call
 *    made anywhere downstream, via `AsyncLocalStorage`, so a service three layers deep can record
 *    a semantic event without being handed the raw `Request` object.
 * 2. Records the one generic event this layer *can* fully describe on its own: a hit on an
 *    endpoint marked `@AuditFinanceRead()`. Everything else — what actually changed — is recorded
 *    by explicit `AuditService.record()` calls in the services that know it.
 *
 * Registered as an `APP_INTERCEPTOR` in `AuditModule` so it wraps the controller method call
 * itself (module-provided interceptors run before `main.ts`'s `useGlobalInterceptors`), which is
 * what lets the `AsyncLocalStorage` context reach every service call the handler makes.
 *
 * Nest composes interceptors lazily: calling `next.handle()` returns an Observable that does not
 * actually run the downstream handler until something subscribes to it, and Nest does that
 * subscribing itself, *after* every interceptor's `intercept()` has already returned. Wrapping
 * `next.handle()` in `runWithAuditContext` and simply returning it — the obvious first draft —
 * would therefore end the `AsyncLocalStorage` context's dynamic extent before the controller
 * method ever runs. Returning our own `Observable` and calling `.subscribe()` from *inside*
 * `runWithAuditContext` moves that subscription, and with it the actual handler execution, back
 * inside the context.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<RequestContext>();
    const ambientContext = {
      requestId: request.requestId ?? null,
      ipAddress: request.ip ?? null,
      userAgent: request.headers['user-agent'] ?? null,
    };

    const financeRead = this.reflector.getAllAndOverride<boolean>(AUDIT_FINANCE_READ_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return new Observable((subscriber) => {
      runWithAuditContext(ambientContext, () => {
        const handled = financeRead
          ? next.handle().pipe(
              tap(() => {
                const userId = request.user?.id;
                if (!userId) return;

                void this.audit.record({
                  userId,
                  action: AuditAction.FINANCE_READ_ACCESSED,
                  entityType: AuditEntityType.FINANCE,
                });
              }),
            )
          : next.handle();

        handled.subscribe(subscriber);
      });
    });
  }
}
