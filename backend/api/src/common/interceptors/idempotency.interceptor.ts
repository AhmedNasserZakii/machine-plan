import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Observable, catchError, concatMap, from, of, throwError } from 'rxjs';
import { ErrorCode } from '../constants/error-codes';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';
import { AppException } from '../errors';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { RequestContext } from '../types/request.types';

/** Long enough for a UUID, tight enough that a key cannot be used to smuggle a payload. */
const KEY_PATTERN = /^[\w.:-]{8,120}$/;

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * The only mutation-shaped routes that deliberately bypass response idempotency.
 *
 * Login/refresh cannot scope a key to an authenticated user. The two validation routes do not
 * mutate state. The signed blob PUT is already idempotent by object key and has no authenticated
 * principal; the subsequent authenticated `/media/confirm` call is protected normally.
 */
export const IDEMPOTENCY_EXEMPTIONS: ReadonlyArray<{
  method: string;
  path: RegExp;
  reason: string;
}> = [
  { method: 'POST', path: /\/auth\/login$/, reason: 'public authentication' },
  { method: 'POST', path: /\/auth\/refresh$/, reason: 'public token rotation' },
  { method: 'POST', path: /\/merchants\/check$/, reason: 'read-only duplicate check' },
  { method: 'POST', path: /\/transfers\/validate$/, reason: 'read-only transfer dry run' },
  { method: 'PUT', path: /\/media\/blob$/, reason: 'signed object-key upload without a user' },
];

/**
 * Replays the first response recorded for an `Idempotency-Key` on every authenticated mutation
 * (`20`, mechanism 2). `@Idempotent()` remains available as an explicit marker, but mutation
 * methods are protected by default so a newly added controller cannot silently omit the rule.
 *
 * Registered as an `APP_INTERCEPTOR` in `IdempotencyModule`, which puts it ahead of the
 * interceptors `main.ts` adds and therefore outermost: what it stores is the finished response
 * envelope, so a replay is byte-identical to the original rather than re-derived from a service
 * result that may since have moved on.
 *
 * The header is optional. A client that does not send one gets the ordinary path — the entities
 * that matter carry a `clientUuid` as well, and the two mechanisms are independent on purpose.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotency: IdempotencyService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') return next.handle();

    const explicitlyEnabled = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<RequestContext>();
    const method = request.method.toUpperCase();
    const path = request.path;
    const exempt = IDEMPOTENCY_EXEMPTIONS.some(
      (entry) => entry.method === method && entry.path.test(path),
    );
    const enabled = explicitlyEnabled || (MUTATION_METHODS.has(method) && !exempt);
    if (!enabled) return next.handle();

    const key = request.idempotencyKey?.trim();
    const userId = request.user?.id;
    if (!key || !userId) return next.handle();

    if (!KEY_PATTERN.test(key)) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'Idempotency-Key', constraint: 'must be 8-120 characters' }],
      });
    }

    const outcome = await this.idempotency.begin({
      key,
      userId,
      endpoint: `${request.method} ${request.path}`,
      body: request.body,
    });

    if (outcome.kind === 'REPLAY') {
      return of(outcome.body);
    }

    const statusCode = this.statusCodeOf(context);

    return next.handle().pipe(
      // `concatMap` rather than `tap`: the record has to be `COMPLETED` before the response
      // leaves, or a device retrying the instant it reconnects races its own first attempt and
      // is told the request is still in progress.
      concatMap((body: unknown) =>
        from(this.record(outcome.recordId, statusCode, body)).pipe(concatMap(() => of(body))),
      ),
      catchError((error: unknown) =>
        from(this.idempotency.release(outcome.recordId)).pipe(
          concatMap(() => throwError(() => error)),
        ),
      ),
    );
  }

  /**
   * Every response this interceptor sees has been through `ResponseInterceptor` and is therefore
   * an envelope object. Anything else — a route that answers with no content — is released
   * rather than recorded: a stored `null` would replay as an empty body, and re-running the
   * handler is the more honest answer.
   */
  private async record(recordId: string, statusCode: number, body: unknown): Promise<void> {
    if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
      await this.idempotency.complete(recordId, statusCode, body);
      return;
    }

    await this.idempotency.release(recordId);
  }

  /**
   * What the router will send. Read from the route rather than the response object, which has
   * not been given a status yet at this point in the chain.
   */
  private statusCodeOf(context: ExecutionContext): number {
    const declared = this.reflector.get<number | undefined>(
      HTTP_CODE_METADATA,
      context.getHandler(),
    );
    if (declared) return declared;

    return context.switchToHttp().getRequest<RequestContext>().method === 'POST' ? 201 : 200;
  }
}
