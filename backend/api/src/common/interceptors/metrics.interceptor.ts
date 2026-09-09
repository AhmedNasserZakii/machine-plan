import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { httpRequestDuration, httpRequestErrorsTotal, httpRequestsTotal } from '../metrics/metrics';

/**
 * Records every HTTP request's duration/count/error status (`4.4`). Global, ahead of
 * `AllExceptionsFilter`: an interceptor's `next.handle()` observable errors *before* the filter
 * ever runs, so a thrown `AppException` is still counted here even though the response object it
 * carries hasn't been written yet — the status comes from the exception itself in that case.
 *
 * The route label is the matched Express **template** (`/api/v1/machines/:id`), never the raw
 * URL — a raw path would let one caller hammering random URLs create unbounded label
 * cardinality. A request Express never matched a handler for (a 404) has no `req.route` at all
 * and is bucketed under the fixed label `'unmatched'` for the same reason.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const method = request.method;
    const start = process.hrtime.bigint();

    const record = (statusCode: number): void => {
      const route = routeLabel(request);
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const labels = { method, route, status_code: String(statusCode) };

      httpRequestDuration.observe(labels, durationSeconds);
      httpRequestsTotal.inc(labels);
      if (statusCode >= 400) httpRequestErrorsTotal.inc(labels);
    };

    return next.handle().pipe(
      tap({
        next: () => record(response.statusCode),
        error: (error: unknown) => record(error instanceof HttpException ? error.getStatus() : 500),
      }),
    );
  }
}

function routeLabel(request: Request): string {
  const path = (request.route as { path?: string } | undefined)?.path;
  if (!path) return 'unmatched';

  return `${request.baseUrl}${path}`;
}
