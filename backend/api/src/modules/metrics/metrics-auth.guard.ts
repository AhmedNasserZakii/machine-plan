import { timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from 'src/config';
import { ErrorCode } from 'src/common/constants/error-codes';
import { AppException } from 'src/common/errors';
import { RequestContext } from 'src/common/types/request.types';

/**
 * `GET /metrics` sits outside the normal `Authorization: Bearer <JWT>` scheme — a Prometheus
 * scraper has no user session — so it gets its own, deliberately simple, bearer check against a
 * static `METRICS_TOKEN` (`4.4`). Required in production (`env.validation.ts`); left open when
 * unset outside it, for a local Prometheus/curl during development.
 */
@Injectable()
export class MetricsAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const app = this.config.getOrThrow<AppConfig>('app');
    if (!app.metricsToken) return true;

    const request = context.switchToHttp().getRequest<RequestContext>();
    const header = request.headers.authorization;
    const presented = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

    if (presented && safeEqual(presented, app.metricsToken)) return true;

    throw AppException.unauthorized(ErrorCode.UNAUTHENTICATED);
  }
}

/** Constant-time compare — a metrics token is a long-lived secret worth not leaking via timing. */
function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;

  return timingSafeEqual(bufferA, bufferB);
}
