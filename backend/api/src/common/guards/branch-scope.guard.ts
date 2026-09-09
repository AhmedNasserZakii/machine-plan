import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '../constants/error-codes';
import { BRANCH_SCOPE_PERMISSION_KEY } from '../decorators/branch-scope.decorator';
import { AppException } from '../errors';
import { RequestContext } from '../types/request.types';

/**
 * Resolves `req.branchScope` for routes marked `@BranchScoped('<resource>.read.all')`.
 *
 * A caller without the `*.read.all` permission is pinned to their own branch. If such a
 * caller explicitly asks for a different `branchId`, that is rejected rather than silently
 * overridden — a silent override would make the client believe it received other-branch data.
 */
@Injectable()
export class BranchScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const readAllPermission = this.reflector.getAllAndOverride<string>(
      BRANCH_SCOPE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!readAllPermission) return true;

    const request = context.switchToHttp().getRequest<RequestContext>();
    const user = request.user;

    if (!user) {
      throw new AppException(ErrorCode.UNAUTHENTICATED);
    }

    if (user.permissions.includes(readAllPermission)) {
      const requested = readRequestedBranchId(request);
      request.branchScope = { branchId: requested ?? null, unrestricted: true };
      return true;
    }

    const requested = readRequestedBranchId(request);
    if (requested && requested !== user.branchId) {
      throw new AppException(ErrorCode.BRANCH_SCOPE_VIOLATION);
    }

    if (!user.branchId) {
      // A company-level user without `*.read.all` has no branch to scope to.
      throw new AppException(ErrorCode.INSUFFICIENT_PERMISSIONS, {
        details: [{ constraint: `requires ${readAllPermission}` }],
      });
    }

    request.branchScope = { branchId: user.branchId, unrestricted: false };
    return true;
  }
}

function readRequestedBranchId(request: RequestContext): string | undefined {
  const value = request.query?.branchId;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
