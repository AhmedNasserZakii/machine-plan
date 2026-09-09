import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DEFAULT_LOCALE } from '../constants/locales';
import { RequestContext } from '../types/request.types';

/** Injects the locale resolved by `LocaleMiddleware`. */
export const ReqLocale = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestContext>();
  return request.locale ?? DEFAULT_LOCALE;
});
