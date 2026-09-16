import { ErrorCode, type ErrorCodeValue } from './error-codes';
import { buildQuery, type QueryParams } from './query';

export type ApiSuccess<T, M = unknown> = { success: true; data: T; meta?: M };

export type FieldError = { field?: string; value?: unknown; constraint?: string };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: FieldError[],
    readonly requestId?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ErrorTreatment =
  | 'field'
  | 'form'
  | 'logout'
  | 'no-access'
  | 'not-found'
  | 'conflict'
  | 'illegal'
  | 'rate-limit'
  | 'server'
  | 'network'
  | 'upgrade';

export function errorTreatment(error: ApiError): ErrorTreatment {
  if (error.code === ErrorCode.NETWORK_ERROR || error.status === 0) return 'network';
  if (error.code === ErrorCode.CLIENT_UPGRADE_REQUIRED || error.status === 426) return 'upgrade';
  if (error.status === 401) return 'logout';
  if (error.status === 403) return 'no-access';
  if (error.status === 404) return 'not-found';
  if (error.status === 409) return 'conflict';
  if (error.status === 422) return 'illegal';
  if (error.status === 429) return 'rate-limit';
  if (error.status >= 500) return 'server';
  if (error.status === 400 && error.details?.length) return 'field';
  if (error.status === 400) return 'form';
  return 'server';
}

type ApiInit = RequestInit & {
  query?: QueryParams;
  idempotencyKey?: string;
};

function isMutation(method: string): boolean {
  return !['GET', 'HEAD'].includes(method.toUpperCase());
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const asNumber = Number(header);
  if (!Number.isNaN(asNumber)) return asNumber;
  const date = Date.parse(header);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

async function parseBody(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(response.status, ErrorCode.UNEXPECTED_RESPONSE, raw.slice(0, 200));
  }
}

function toApiError(status: number, body: unknown, retryAfter?: number): ApiError {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as { error: Record<string, unknown> }).error;
    return new ApiError(
      status,
      String(error.code ?? ErrorCode.UNEXPECTED_RESPONSE),
      String(error.message ?? ''),
      Array.isArray(error.details) ? (error.details as FieldError[]) : undefined,
      typeof error.requestId === 'string' ? error.requestId : undefined,
      retryAfter,
    );
  }
  return new ApiError(status, ErrorCode.UNEXPECTED_RESPONSE, 'Unexpected response', undefined, undefined, retryAfter);
}

export async function apiFetch<T, M = unknown>(
  path: string,
  init: ApiInit = {},
): Promise<ApiSuccess<T, M>> {
  const method = (init.method ?? 'GET').toUpperCase();
  const url = `/api/bff/${path}${buildQuery(init.query)}`;
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (isMutation(method) && init.idempotencyKey) {
    headers.set('Idempotency-Key', init.idempotencyKey);
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, method, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, ErrorCode.NETWORK_ERROR, 'Network error');
  }

  if (response.status === 204) {
    return { success: true, data: null as T };
  }

  const body = await parseBody(response);
  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (!path.includes('/login')) {
        const locale = path.match(/^\/(ar|en)/)?.[1] ?? 'ar';
        const next = `${path}${window.location.search}`;
        window.location.assign(
          `/${locale}/login?reason=expired&next=${encodeURIComponent(next)}`,
        );
      }
    }
    throw toApiError(response.status, body, parseRetryAfter(response.headers.get('Retry-After')));
  }

  if (body && typeof body === 'object' && 'success' in body) {
    const envelope = body as { success: boolean; data?: T; meta?: M; error?: { message?: string; code?: string } };
    if (envelope.success === false) {
      throw toApiError(response.status, body);
    }
    return { success: true, data: envelope.data as T, meta: envelope.meta };
  }

  throw new ApiError(response.status, ErrorCode.UNEXPECTED_RESPONSE, 'Missing success envelope');
}

export const api = {
  get: <T, M = unknown>(path: string, query?: QueryParams) =>
    apiFetch<T, M>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
    apiFetch<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
      idempotencyKey,
    }),
  put: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
    apiFetch<T>(path, {
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
      idempotencyKey,
    }),
  patch: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
    apiFetch<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
      idempotencyKey,
    }),
  delete: <T>(path: string, idempotencyKey?: string) =>
    apiFetch<T>(path, { method: 'DELETE', idempotencyKey }),
};

export type { ErrorCodeValue };
