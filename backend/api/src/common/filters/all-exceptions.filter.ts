import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ErrorCode } from '../constants/error-codes';
import { DEFAULT_LOCALE } from '../constants/locales';
import { AppException, ErrorDetail } from '../errors/app.exception';
import { resolveErrorMessage } from '../errors/error-messages';
import { captureError } from '../observability/sentry';
import { RequestContext } from '../types/request.types';

interface ResolvedError {
  status: HttpStatus;
  code: string;
  message?: string;
  params?: Record<string, string | number | undefined>;
  details?: ErrorDetail[];
  extra?: Record<string, unknown>;
  headers?: Record<string, string>;
}

interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
    requestId: string;
    timestamp: string;
  } & Record<string, unknown>;
}

/** Postgres error codes we can translate into a meaningful client error. */
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_CHECK_VIOLATION = '23514';

/** The router's own phrasing when no handler matches, e.g. `Cannot GET /api/v1/nope`. */
const UNMATCHED_ROUTE = /^Cannot [A-Z]+ \//;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestContext>();
    const response = ctx.getResponse<Response>();
    const locale = request.locale ?? DEFAULT_LOCALE;
    const requestId = request.requestId ?? 'unknown';

    const resolved = this.resolve(exception);

    if (resolved.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { requestId, path: request.url, code: resolved.code, err: exception },
        'Unhandled exception',
      );
      // Only genuine 5xx — a validation failure or a permission denial is expected traffic,
      // not an incident, and would drown a real error report in noise if reported alongside it.
      captureError(exception, { requestId, path: request.url, code: resolved.code });
    } else {
      this.logger.debug({ requestId, path: request.url, code: resolved.code }, 'Handled exception');
    }

    const envelope: ErrorEnvelope = {
      success: false,
      error: {
        code: resolved.code,
        message: resolved.message ?? resolveErrorMessage(resolved.code, locale, resolved.params),
        ...(resolved.details?.length ? { details: resolved.details } : {}),
        ...(resolved.extra ?? {}),
        requestId,
        timestamp: new Date().toISOString(),
      },
    };

    if (resolved.headers) {
      for (const [name, value] of Object.entries(resolved.headers)) {
        response.setHeader(name, value);
      }
    }

    response.status(resolved.status).json(envelope);
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        params: exception.params,
        details: exception.details,
        extra: exception.extra,
        headers: exception.headers,
      };
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (exception instanceof QueryFailedError) {
      const driverCode = (exception as { code?: string }).code;
      return this.fromDriverCode(driverCode, exception.message);
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, code: ErrorCode.INTERNAL_ERROR };
  }

  private fromHttpException(exception: HttpException): ResolvedError {
    const status = exception.getStatus();
    const body = exception.getResponse();

    // The global ValidationPipe produces `{ message: string[] , ... }`.
    if (typeof body === 'object' && body !== null) {
      const record = body as Record<string, unknown>;
      const rawMessage = record.message;

      if (Array.isArray(rawMessage)) {
        return {
          status,
          code: ErrorCode.VALIDATION_FAILED,
          details: rawMessage.map((constraint) => ({ constraint: String(constraint) })),
        };
      }

      // An `AppException` code thrown as a plain string body by a guard.
      if (typeof record.code === 'string') {
        return { status, code: record.code };
      }
    }

    if (typeof body === 'string' && /^[A-Z][A-Z0-9_]*$/.test(body)) {
      return { status, code: body };
    }

    const code = this.codeForStatus(status);

    // Localized copy exists for our own codes; only pass the framework's raw text through
    // when we have nothing better to say. An unmatched route is one of those cases: it is a
    // wrong URL, not a missing record, and answering it with "the requested item does not
    // exist" sends whoever typed the path looking for a row that was never the problem.
    const passThrough =
      code === ErrorCode.INTERNAL_ERROR || UNMATCHED_ROUTE.test(exception.message);

    return passThrough ? { status, code, message: exception.message } : { status, code };
  }

  private fromDriverCode(driverCode: string | undefined, dbMessage: string): ResolvedError {
    switch (driverCode) {
      case PG_UNIQUE_VIOLATION:
        return { status: HttpStatus.CONFLICT, code: ErrorCode.CODE_EXISTS };
      case PG_FOREIGN_KEY_VIOLATION:
      case PG_CHECK_VIOLATION:
        return { status: HttpStatus.BAD_REQUEST, code: ErrorCode.VALIDATION_FAILED };
      default:
        this.logger.error({ driverCode, dbMessage }, 'Unmapped database error');
        return { status: HttpStatus.INTERNAL_SERVER_ERROR, code: ErrorCode.INTERNAL_ERROR };
    }
  }

  private codeForStatus(status: HttpStatus): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHENTICATED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.INSUFFICIENT_PERMISSIONS;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_FAILED;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED;
      case HttpStatus.REQUEST_TIMEOUT:
        return ErrorCode.REQUEST_TIMEOUT;
      // Multer rejects oversized multipart uploads with a plain PayloadTooLargeException;
      // without this the client would see INTERNAL_ERROR for a perfectly explicable refusal.
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return ErrorCode.UPLOAD_TOO_LARGE;
      case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
        return ErrorCode.UNSUPPORTED_MEDIA_TYPE;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
