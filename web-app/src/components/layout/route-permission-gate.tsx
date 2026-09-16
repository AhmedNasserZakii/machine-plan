'use client';

import { NoAccess } from '@/components/feedback/no-access';
import { usePathname, useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/client';
import { canAny } from '@/lib/auth/can';
import { useSession } from '@/lib/auth/use-session';
import { requiredPermissionsForPath } from '@/lib/nav/route-permissions';

export function RoutePermissionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, permissions, isLoading, error } = useSession();

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-md bg-shimmer-base" />;
  }

  if (error || !user) {
    const expired = error instanceof ApiError && error.status === 401;
    router.replace(expired ? '/login?reason=expired' : '/login');
    return null;
  }

  if (user.mustChangePassword && pathname !== '/change-password') {
    router.replace('/change-password');
    return null;
  }

  const required = requiredPermissionsForPath(pathname);
  if (required && !canAny(permissions, required)) {
    return <NoAccess />;
  }

  return children;
}
