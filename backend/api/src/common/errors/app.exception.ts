import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorCodeValue } from '../constants/error-codes';
import { MessageParams } from './error-messages';

export interface ErrorDetail {
  field?: string;
  value?: unknown;
  constraint?: string;
}

export interface AppExceptionOptions {
  status?: HttpStatus;
  params?: MessageParams;
  details?: ErrorDetail[];
  /** Extra top-level keys merged into the error object, e.g. `minVersion`. */
  extra?: Record<string, unknown>;
  cause?: unknown;
  /** Extra response headers, e.g. `Retry-After` on a 429 — `AllExceptionsFilter` applies these
   * to the response, since it otherwise builds the response fresh from `code`/`params` alone. */
  headers?: Record<string, string>;
}

/**
 * The only exception type services should throw. Carries a stable error code plus the
 * params needed to render a localized message in `AllExceptionsFilter`.
 */
export class AppException extends HttpException {
  readonly code: ErrorCodeValue;
  readonly params?: MessageParams;
  readonly details?: ErrorDetail[];
  readonly extra?: Record<string, unknown>;
  readonly headers?: Record<string, string>;

  constructor(code: ErrorCodeValue, options: AppExceptionOptions = {}) {
    const status = options.status ?? DEFAULT_STATUS_BY_CODE[code] ?? HttpStatus.BAD_REQUEST;
    super(code, status, { cause: options.cause });
    this.code = code;
    this.params = options.params;
    this.details = options.details;
    this.extra = options.extra;
    this.headers = options.headers;
  }

  static notFound(
    code: ErrorCodeValue = ErrorCode.NOT_FOUND,
    params?: MessageParams,
  ): AppException {
    return new AppException(code, { status: HttpStatus.NOT_FOUND, params });
  }

  /** 409 — collides with something that already exists. */
  static conflict(code: ErrorCodeValue, params?: MessageParams): AppException {
    return new AppException(code, { status: HttpStatus.CONFLICT, params });
  }

  /** 422 — the operation is not legal in the current state. */
  static unprocessable(code: ErrorCodeValue, params?: MessageParams): AppException {
    return new AppException(code, { status: HttpStatus.UNPROCESSABLE_ENTITY, params });
  }

  static forbidden(code: ErrorCodeValue, params?: MessageParams): AppException {
    return new AppException(code, { status: HttpStatus.FORBIDDEN, params });
  }

  static unauthorized(code: ErrorCodeValue, params?: MessageParams): AppException {
    return new AppException(code, { status: HttpStatus.UNAUTHORIZED, params });
  }

  static badRequest(code: ErrorCodeValue, params?: MessageParams): AppException {
    return new AppException(code, { status: HttpStatus.BAD_REQUEST, params });
  }

  /** 429, with the `Retry-After` header the response is required to carry alongside it. */
  static tooManyRequests(
    code: ErrorCodeValue,
    retryAfterSeconds: number,
    params?: MessageParams,
  ): AppException {
    return new AppException(code, {
      status: HttpStatus.TOO_MANY_REQUESTS,
      params,
      headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSeconds))) },
    });
  }
}

/**
 * Default HTTP status per code, following the 409/422 split documented in
 * `22-api-conventions-errors.md`: 409 = collides with existing state,
 * 422 = operation not legal right now.
 */
const DEFAULT_STATUS_BY_CODE: Partial<Record<ErrorCodeValue, HttpStatus>> = {
  [ErrorCode.VALIDATION_FAILED]: HttpStatus.BAD_REQUEST,
  [ErrorCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.RATE_LIMITED]: HttpStatus.TOO_MANY_REQUESTS,
  [ErrorCode.REQUEST_TIMEOUT]: HttpStatus.REQUEST_TIMEOUT,
  [ErrorCode.CLIENT_UPGRADE_REQUIRED]: 426 as HttpStatus,

  [ErrorCode.INVALID_CREDENTIALS]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.ACCOUNT_INACTIVE]: HttpStatus.FORBIDDEN,
  [ErrorCode.ACCOUNT_LOCKED]: HttpStatus.TOO_MANY_REQUESTS,
  [ErrorCode.TOKEN_EXPIRED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.TOKEN_REVOKED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.UNAUTHENTICATED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.PASSWORD_CHANGE_REQUIRED]: HttpStatus.FORBIDDEN,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: HttpStatus.FORBIDDEN,
  [ErrorCode.BRANCH_SCOPE_VIOLATION]: HttpStatus.FORBIDDEN,
  [ErrorCode.DEVICE_NOT_ENROLLED]: HttpStatus.FORBIDDEN,

  [ErrorCode.SERIAL_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCode.BATTERY_SERIAL_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCode.SERIAL_IMMUTABLE]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.MACHINE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.MACHINE_RETIRED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.MACHINE_ALREADY_REPLACED]: HttpStatus.CONFLICT,

  [ErrorCode.INVALID_MACHINE_STATUS]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.NOT_IN_YOUR_CUSTODY]: HttpStatus.FORBIDDEN,
  [ErrorCode.MACHINE_ALREADY_IN_TRANSIT]: HttpStatus.CONFLICT,
  [ErrorCode.TRANSFER_NOT_PENDING]: HttpStatus.CONFLICT,
  [ErrorCode.PAYLOAD_CHANGED]: HttpStatus.CONFLICT,
  [ErrorCode.INVALID_TRANSFER_TYPE]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.INTER_BRANCH_DIRECT_TRANSFER_NOT_ALLOWED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.SIGNATURE_REQUIRED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.CANCEL_WINDOW_EXPIRED]: HttpStatus.UNPROCESSABLE_ENTITY,

  [ErrorCode.MACHINE_ALREADY_IN_MAINTENANCE]: HttpStatus.CONFLICT,
  [ErrorCode.ORDER_ALREADY_CLOSED]: HttpStatus.CONFLICT,
  [ErrorCode.COST_REQUIRED]: HttpStatus.BAD_REQUEST,
  [ErrorCode.REPLACEMENT_PAYLOAD_REQUIRED]: HttpStatus.BAD_REQUEST,
  [ErrorCode.MAINTENANCE_ORDER_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.INVALID_MAINTENANCE_STATUS]: HttpStatus.UNPROCESSABLE_ENTITY,

  [ErrorCode.MACHINE_NOT_IN_WAREHOUSE]: HttpStatus.UNPROCESSABLE_ENTITY,
  // 409 rather than 422: the blocker is a row that exists, exactly like MACHINE_ALREADY_IN_TRANSIT,
  // and the caller resolves it by closing that order rather than by changing this request.
  [ErrorCode.OPEN_MAINTENANCE_ORDER]: HttpStatus.CONFLICT,
  [ErrorCode.ALREADY_DECOMMISSIONED]: HttpStatus.CONFLICT,
  [ErrorCode.DECOMMISSION_NOT_FOUND]: HttpStatus.NOT_FOUND,

  [ErrorCode.SETTING_NOT_FOUND]: HttpStatus.NOT_FOUND,

  [ErrorCode.MERCHANT_HAS_MACHINES]: HttpStatus.CONFLICT,
  [ErrorCode.DUPLICATE_NATIONAL_ID]: HttpStatus.CONFLICT,

  [ErrorCode.CATEGORY_KIND_MISMATCH]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.CATEGORY_HAS_CHILDREN]: HttpStatus.CONFLICT,
  [ErrorCode.CATEGORY_HAS_TRANSACTIONS]: HttpStatus.CONFLICT,
  [ErrorCode.CIRCULAR_CATEGORY_REFERENCE]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.SYSTEM_CATEGORY_PROTECTED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.FUTURE_DATE_NOT_ALLOWED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.BACKDATE_LIMIT_EXCEEDED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.AUTO_TRANSACTION_IMMUTABLE]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.TRANSACTION_ALREADY_VOIDED]: HttpStatus.CONFLICT,
  [ErrorCode.OVERLAPPING_BUDGET]: HttpStatus.CONFLICT,
  [ErrorCode.BUDGET_ON_INCOME_CATEGORY]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.EDIT_WINDOW_EXPIRED]: HttpStatus.UNPROCESSABLE_ENTITY,

  [ErrorCode.EXPORT_FORMAT_UNAVAILABLE]: HttpStatus.NOT_IMPLEMENTED,

  [ErrorCode.ALREADY_CHARGED]: HttpStatus.CONFLICT,
  [ErrorCode.AUTO_VIOLATION_IMMUTABLE]: HttpStatus.UNPROCESSABLE_ENTITY,

  [ErrorCode.USER_HAS_CUSTODY]: HttpStatus.CONFLICT,
  [ErrorCode.LAST_DIRECTOR]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.CANNOT_EDIT_OWN_PERMISSIONS]: HttpStatus.FORBIDDEN,
  [ErrorCode.SYSTEM_ROLE_PROTECTED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.PHONE_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCode.EMAIL_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCode.BRANCH_REQUIRED_FOR_ROLE]: HttpStatus.BAD_REQUEST,

  [ErrorCode.BRANCH_HAS_MACHINES]: HttpStatus.CONFLICT,
  [ErrorCode.BRANCH_HAS_ACTIVE_STAFF]: HttpStatus.CONFLICT,
  [ErrorCode.BRANCH_CODE_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCode.WAREHOUSE_TYPE_CONFLICT]: HttpStatus.CONFLICT,

  [ErrorCode.CODE_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCode.DEFAULT_LOCALE_REQUIRED]: HttpStatus.BAD_REQUEST,
  [ErrorCode.LOOKUP_IN_USE]: HttpStatus.CONFLICT,

  [ErrorCode.IDEMPOTENCY_KEY_REUSED]: HttpStatus.CONFLICT,
  [ErrorCode.IDEMPOTENCY_KEY_REQUIRED]: HttpStatus.BAD_REQUEST,
  [ErrorCode.IDEMPOTENT_REQUEST_IN_PROGRESS]: HttpStatus.CONFLICT,
  [ErrorCode.INVALID_OCCURRED_AT]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.SCHEMA_VERSION_MISMATCH]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.TOO_MANY_PHOTOS]: HttpStatus.BAD_REQUEST,
  [ErrorCode.MEDIA_NOT_CONFIRMED]: HttpStatus.UNPROCESSABLE_ENTITY,
  // Attached evidence is immutable: replacing or deleting it is a conflict, not bad input.
  [ErrorCode.MEDIA_ALREADY_USED]: HttpStatus.CONFLICT,
  [ErrorCode.UNSUPPORTED_MEDIA_TYPE]: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  [ErrorCode.NOT_THE_RECEIVER]: HttpStatus.FORBIDDEN,
  [ErrorCode.UPLOAD_TOO_LARGE]: HttpStatus.PAYLOAD_TOO_LARGE,
};
