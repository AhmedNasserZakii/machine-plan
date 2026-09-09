import { Request } from 'express';
import { Locale } from '../constants/locales';

/** The authenticated principal attached to the request by `JwtStrategy`. */
export interface AuthUser {
  id: string;
  fullName: string;
  phone: string;
  roleId: string;
  roleCode: string;
  branchId: string | null;
  mustChangePassword: boolean;
  /** Effective permission set: (role ∪ ALLOW overrides) \ DENY overrides. */
  permissions: string[];
}

/**
 * Resolved by `BranchScopeGuard`. Services must filter on this rather than on any
 * client-supplied `branchId`.
 */
export interface BranchScope {
  /** `null` means the caller may see every branch. */
  branchId: string | null;
  unrestricted: boolean;
}

export interface RequestContext extends Request {
  locale: Locale;
  requestId: string;
  user?: AuthUser;
  branchScope?: BranchScope;
  idempotencyKey?: string;
  deviceId?: string;
}
