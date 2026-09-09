import { NextFunction, RequestHandler, Response } from 'express';
import { ulid } from 'ulid';
import { RequestContext } from '../types/request.types';

export const REQUEST_ID_HEADER = 'x-request-id';
export const DEVICE_ID_HEADER = 'x-device-id';
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/**
 * Assigns a request id (reused from the inbound header when a proxy supplies one) and
 * lifts the mobile client headers onto the request so guards and services can read them.
 *
 * Registered via `app.use()` in `main.ts` rather than `NestModule.configure()`, so it also
 * covers the unversioned `/health` routes.
 */
export function requestContextMiddleware(): RequestHandler {
  return (req, res: Response, next: NextFunction): void => {
    const request = req as RequestContext;

    // Only well-formed inbound ids are reused; anything else (oversized, control
    // characters, header arrays) is replaced so a hostile client cannot pollute traces.
    const inbound = request.headers[REQUEST_ID_HEADER];
    request.requestId =
      typeof inbound === 'string' && /^[\w.-]{1,64}$/.test(inbound) ? inbound : ulid();

    const deviceId = request.headers[DEVICE_ID_HEADER];
    if (typeof deviceId === 'string') request.deviceId = deviceId;

    const idempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER];
    if (typeof idempotencyKey === 'string') request.idempotencyKey = idempotencyKey;

    res.setHeader(REQUEST_ID_HEADER, request.requestId);
    next();
  };
}
