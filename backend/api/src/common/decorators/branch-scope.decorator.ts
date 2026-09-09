import {
  createParamDecorator,
  CustomDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { BranchScope, RequestContext } from '../types/request.types';

export const BRANCH_SCOPE_PERMISSION_KEY = 'branchScopePermission';

/**
 * Marks a route as branch-scoped. Callers holding `readAllPermission` see every branch;
 * everyone else is restricted to their own `branchId`.
 */
export const BranchScoped = (readAllPermission: string): CustomDecorator<string> =>
  SetMetadata(BRANCH_SCOPE_PERMISSION_KEY, readAllPermission);

/** Injects the scope resolved by `BranchScopeGuard`. */
export const Scope = createParamDecorator((_data: unknown, ctx: ExecutionContext): BranchScope => {
  const request = ctx.switchToHttp().getRequest<RequestContext>();
  return request.branchScope ?? { branchId: null, unrestricted: true };
});
