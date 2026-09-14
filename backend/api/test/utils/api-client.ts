import request from 'supertest';
import type { App } from 'supertest/types';

export interface ErrorDetail {
  field?: string;
  value?: unknown;
  constraint: string;
}

export interface ErrorBody {
  code: string;
  message: string;
  details?: ErrorDetail[];
  requestId: string;
  timestamp: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  /** Present on keyset endpoints only. */
  nextCursor?: string | null;
}

/**
 * Thin wrapper over supertest that carries the bearer token and the request locale, so
 * specs read as `director.get('/branches')` instead of repeating headers everywhere.
 */
export class Api {
  constructor(
    private readonly server: App,
    private readonly token: string | null = null,
    private readonly locale: string | null = null,
  ) {}

  /** Same server, different principal. Pass `null` for an anonymous caller. */
  as(token: string | null): Api {
    return new Api(this.server, token, this.locale);
  }

  /** Same principal, different `Accept-Language`. */
  withLocale(locale: string | null): Api {
    return new Api(this.server, this.token, locale);
  }

  get(path: string): request.Test {
    return this.prepare(request(this.server).get(this.url(path)));
  }

  post(path: string, body?: unknown): request.Test {
    return this.prepare(
      request(this.server)
        .post(this.url(path))
        .send(body ?? {}),
    );
  }

  patch(path: string, body?: unknown): request.Test {
    return this.prepare(
      request(this.server)
        .patch(this.url(path))
        .send(body ?? {}),
    );
  }

  put(path: string, body?: unknown): request.Test {
    return this.prepare(
      request(this.server)
        .put(this.url(path))
        .send(body ?? {}),
    );
  }

  delete(path: string): request.Test {
    return this.prepare(request(this.server).delete(this.url(path)));
  }

  /** Paths are written relative to the versioned API root. */
  private url(path: string): string {
    return path.startsWith('/api/') || path === '/health' || path.startsWith('/health/')
      ? path
      : `/api/v1${path.startsWith('/') ? path : `/${path}`}`;
  }

  private prepare(test: request.Test): request.Test {
    if (this.token) test.set('Authorization', `Bearer ${this.token}`);
    if (this.locale) test.set('Accept-Language', this.locale);
    return test;
  }
}

/**
 * Asserts a successful envelope and returns `data`. Failures include the response body,
 * which is what you actually need when a permission or validation rule bites.
 */
export async function ok<T>(test: request.Test, status = 200): Promise<T> {
  const response = await test;

  if (response.status !== status) {
    throw new Error(`expected ${status}, got ${describe(response)}`);
  }
  if (response.body?.success !== true) {
    throw new Error(`expected a success envelope, got ${describe(response)}`);
  }

  return response.body.data as T;
}

/** Same as `ok`, for the paginated endpoints that also return a `meta` block. */
export async function okPage<T>(test: request.Test): Promise<{ items: T[]; meta: PageMeta }> {
  const response = await test;

  if (response.status !== 200) {
    throw new Error(`expected 200, got ${describe(response)}`);
  }
  if (!Array.isArray(response.body?.data) || response.body?.meta === undefined) {
    throw new Error(`expected a paginated envelope, got ${describe(response)}`);
  }

  return { items: response.body.data as T[], meta: response.body.meta as PageMeta };
}

/** Asserts the unified error envelope and returns it for further assertions. */
export async function fails(test: request.Test, status: number, code: string): Promise<ErrorBody> {
  const response = await test;

  if (response.status !== status || response.body?.error?.code !== code) {
    throw new Error(`expected ${status} ${code}, got ${describe(response)}`);
  }
  if (response.body.success !== false) {
    throw new Error(`expected a failure envelope, got ${describe(response)}`);
  }

  return response.body.error as ErrorBody;
}

/** True when the error carries a constraint for the given field path. */
export function hasFieldError(error: ErrorBody, field: string): boolean {
  return (error.details ?? []).some((detail) => detail.field === field);
}

/** Names the request as well as the response — a bare status code is rarely enough. */
function describe(response: request.Response): string {
  const target = (response as { req?: { method?: string; path?: string } }).req;
  const where = `${target?.method ?? '?'} ${target?.path ?? '?'}`;
  const body = stringify(response.body);

  return `${response.status} on ${where}: ${body === '{}' ? response.text || '<empty body>' : body}`;
}

function stringify(body: unknown): string {
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}
