import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { Response } from 'express';
import { AppConfig } from 'src/config';
import { RequestContext } from '../types/request.types';

/**
 * `@nestjs/throttler`'s guard, adjusted on three points (`4.2`):
 *
 * 1. Skips entirely when `app.throttleEnabled` is off (see `app.config.ts` for why that is the
 *    default under test).
 * 2. Tracks by authenticated user id rather than IP, which is what "300 requests/minute/**user**"
 *    actually means — two representatives sharing an office network must not throttle each other.
 *    Falls back to IP for the rare unauthenticated route this guard still runs on.
 * 3. Always sets the *unsuffixed* `Retry-After` header. The base guard already sets one, but for
 *    a named (non-`'default'`) throttler it suffixes the header (`Retry-After-media-presign`) so
 *    several named throttlers never collide on one response — correct for its own `X-RateLimit-*`
 *    headers, but `Retry-After` is a registered HTTP header every client and proxy already knows
 *    how to read, and a suffixed name is invisible to all of them.
 *
 * Request IP is what `trust proxy` (`main.ts`) already resolves it to, so this is correct behind
 * the configured proxy for free.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    super(options, storage, reflector);
  }

  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    const app = this.config.getOrThrow<AppConfig>('app');
    return app.throttleEnabled ? super.shouldSkip(context) : Promise.resolve(true);
  }

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as RequestContext;
    return Promise.resolve(request.user?.id ?? request.ip ?? 'unknown');
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const response = context.switchToHttp().getResponse<Response>();
    const retryAfter = throttlerLimitDetail.timeToBlockExpire || throttlerLimitDetail.timeToExpire;
    response.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfter))));

    return super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
