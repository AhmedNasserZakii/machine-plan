import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '../constants/error-codes';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AppException } from '../errors';
import { RequestContext } from '../types/request.types';

/**
 * Checks the caller's effective permission set against `@Permissions()` (all required)
 * and `@AnyPermission()` (at least one required).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, targets) ?? [];
    const anyOf = this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, targets) ?? [];

    if (required.length === 0 && anyOf.length === 0) {
      // Authenticated is enough for this route.
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestContext>();
    const held = new Set(request.user?.permissions ?? []);

    const missing = required.filter((permission) => !held.has(permission));
    if (missing.length > 0) {
      throw new AppException(ErrorCode.INSUFFICIENT_PERMISSIONS, {
        details: missing.map((permission) => ({ constraint: `requires ${permission}` })),
      });
    }

    if (anyOf.length > 0 && !anyOf.some((permission) => held.has(permission))) {
      throw new AppException(ErrorCode.INSUFFICIENT_PERMISSIONS, {
        details: [{ constraint: `requires one of: ${anyOf.join(', ')}` }],
      });
    }

    return true;
  }
}
