import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { ErrorCode } from '../constants/error-codes';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AppException } from '../errors';
import { AuthUser } from '../types/request.types';

/**
 * Applied globally. Routes opt out with `@Public()`.
 *
 * Translates Passport's generic failures into the stable error codes the Flutter client
 * switches on — `TOKEN_EXPIRED` in particular, since the app silently refreshes on it.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }

  handleRequest<TUser = AuthUser>(err: unknown, user: TUser, info: unknown): TUser {
    if (err) {
      throw err instanceof Error
        ? err
        : new AppException(ErrorCode.UNAUTHENTICATED, { cause: err });
    }

    if (!user) {
      // Checked by name rather than `instanceof` to avoid importing from a transitive
      // dependency of @nestjs/jwt.
      const failureName = (info as { name?: string } | undefined)?.name;
      throw new AppException(
        failureName === 'TokenExpiredError' ? ErrorCode.TOKEN_EXPIRED : ErrorCode.UNAUTHENTICATED,
      );
    }

    return user;
  }
}
