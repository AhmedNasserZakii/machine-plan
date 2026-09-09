import { NextFunction, RequestHandler, Response } from 'express';
import { DEFAULT_LOCALE, isSupportedLocale, Locale } from '../constants/locales';
import { RequestContext } from '../types/request.types';

/**
 * Resolves the request locale, in priority order:
 *   1. `?locale=` query param (used by reports and exports)
 *   2. `Accept-Language` header
 *   3. `DEFAULT_LOCALE`
 */
export function localeMiddleware(): RequestHandler {
  return (req, res: Response, next: NextFunction): void => {
    const request = req as RequestContext;
    request.locale = resolveLocale(request);
    res.setHeader('Content-Language', request.locale);
    next();
  };
}

function resolveLocale(req: RequestContext): Locale {
  const fromQuery = req.query?.locale;
  if (isSupportedLocale(fromQuery)) return fromQuery;

  const header = req.headers['accept-language'];
  if (typeof header === 'string') {
    for (const part of header.split(',')) {
      const tag = part.split(';')[0]?.trim().toLowerCase();
      if (!tag) continue;
      const base = tag.split('-')[0];
      if (isSupportedLocale(base)) return base;
    }
  }

  return DEFAULT_LOCALE;
}
