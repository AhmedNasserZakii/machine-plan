import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { CursorResult, PaginatedResult } from '../dto/paginated-result';

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

const RAW_RESPONSE_PATHS = ['/health', '/health/ready', '/metrics'];

/**
 * Wraps every successful response in `{ success, data, meta? }`. When a service returns a
 * `PaginatedResult`/`CursorResult`, its items become `data` and its meta becomes `meta`.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiEnvelope<unknown> | T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiEnvelope<unknown> | T> {
    const request = context.switchToHttp().getRequest<{ path?: string; url?: string }>();
    const path = request.path ?? request.url ?? '';
    if (RAW_RESPONSE_PATHS.some((raw) => path.endsWith(raw))) {
      return next.handle();
    }

    return next.handle().pipe(
      map((payload): ApiEnvelope<unknown> => {
        if (payload instanceof PaginatedResult || payload instanceof CursorResult) {
          return {
            success: true,
            data: payload.items,
            meta: payload.meta as unknown as Record<string, unknown>,
          };
        }
        return { success: true, data: payload ?? null };
      }),
    );
  }
}
