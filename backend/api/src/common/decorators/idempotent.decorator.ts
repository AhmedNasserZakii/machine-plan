import {
  createParamDecorator,
  CustomDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { RequestContext } from '../types/request.types';

export const IDEMPOTENT_KEY = 'idempotent';

/**
 * Marks a mutation as replay-safe: `IdempotencyInterceptor` records the first response
 * for an `Idempotency-Key` and replays it for repeats. Required on offline-client writes.
 */
export const Idempotent = (): CustomDecorator<string> => SetMetadata(IDEMPOTENT_KEY, true);

/** Injects the raw `Idempotency-Key` header value. */
export const IdempotencyKey = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestContext>();
  return request.idempotencyKey;
});
