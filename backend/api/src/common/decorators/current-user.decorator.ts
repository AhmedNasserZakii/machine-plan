import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthUser, RequestContext } from '../types/request.types';

/**
 * Injects the authenticated principal. Throws if used on a `@Public()` route, since
 * that is a programming error rather than a client error.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestContext>();
    if (!request.user) {
      throw new InternalServerErrorException(
        '@CurrentUser() used on a route without authentication',
      );
    }
    return field ? request.user[field] : request.user;
  },
);
