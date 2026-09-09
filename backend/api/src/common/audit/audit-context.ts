import { AsyncLocalStorage } from 'node:async_hooks';

export interface AuditAmbientContext {
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

const storage = new AsyncLocalStorage<AuditAmbientContext>();

/**
 * Runs `fn` with `context` available to any `AuditService.record()` call made during it,
 * however deep the call stack — this is what lets a service call `record()` with just the
 * business fields and still have the request's id, IP and user agent land on the row.
 *
 * Called once per request, from `AuditInterceptor`, which wraps the *entire* downstream handler
 * (guards have already run; the controller method and everything it calls happens inside this).
 */
export function runWithAuditContext<T>(context: AuditAmbientContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** `undefined` outside a request — e.g. a cron job or a startup task calling `record()` directly. */
export function currentAuditContext(): AuditAmbientContext | undefined {
  return storage.getStore();
}
