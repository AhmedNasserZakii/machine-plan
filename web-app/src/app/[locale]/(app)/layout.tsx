import { AppShell } from '@/components/layout/app-shell';
import { RoutePermissionGate } from '@/components/layout/route-permission-gate';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoutePermissionGate>
      <AppShell>{children}</AppShell>
    </RoutePermissionGate>
  );
}
