import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '../constants/error-codes';
import { ALLOW_PASSWORD_CHANGE_PENDING_KEY } from '../decorators/allow-password-change-pending.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AppException } from '../errors';
import { RequestContext } from '../types/request.types';

/**
 * The Director creates accounts with a temporary password, so a first login must not be
 * able to do anything until the password is changed. Enforced here rather than per
 * controller, so a newly added endpoint is closed by default.
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_PENDING_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestContext>();
    if (request.user?.mustChangePassword) {
      throw new AppException(ErrorCode.PASSWORD_CHANGE_REQUIRED);
    }

    return true;
  }
}
