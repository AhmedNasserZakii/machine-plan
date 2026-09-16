import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Building2,
  Factory,
  Home,
  KeyRound,
  ScrollText,
  Settings,
  ShieldAlert,
  Store,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';

import { ANY_REPORT, P } from '@/lib/auth/permissions';

export type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  perm?: string;
  anyOf?: readonly string[];
  badge?: 'pendingIncoming' | 'unreadNotifications';
};

export type NavGroup = {
  labelKey: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    labelKey: 'web.nav.operations',
    items: [
      { href: '/', labelKey: 'shared.nav_home', icon: Home },
      { href: '/machines', labelKey: 'shared.nav_machines', icon: Factory, perm: P.machinesRead },
      {
        href: '/transfers',
        labelKey: 'shared.nav_transfers',
        icon: ArrowLeftRight,
        perm: P.transfersRead,
        badge: 'pendingIncoming',
      },
      { href: '/merchants', labelKey: 'shared.nav_merchants', icon: Store, perm: P.merchantsRead },
      {
        href: '/maintenance',
        labelKey: 'web.nav.maintenance',
        icon: Wrench,
        perm: P.maintenanceRead,
      },
      {
        href: '/violations',
        labelKey: 'web.nav.violations',
        icon: ShieldAlert,
        perm: P.violationsRead,
      },
    ],
  },
  {
    labelKey: 'web.nav.finance',
    items: [
      {
        href: '/finance',
        labelKey: 'shared.nav_finance',
        icon: Wallet,
        perm: P.financeRead,
      },
      {
        href: '/finance/transactions',
        labelKey: 'shared.finance_transactions',
        icon: Wallet,
        perm: P.financeRead,
      },
      {
        href: '/finance/categories',
        labelKey: 'shared.finance_categories',
        perm: P.financeCategoriesManage,
        icon: Wallet,
      },
      {
        href: '/finance/budgets',
        labelKey: 'shared.finance_budgets',
        perm: P.financeBudgetsManage,
        icon: Wallet,
      },
    ],
  },
  {
    labelKey: 'web.nav.insights',
    items: [
      {
        href: '/reports',
        labelKey: 'shared.reports',
        icon: BarChart3,
        anyOf: [...ANY_REPORT],
      },
    ],
  },
  {
    labelKey: 'web.nav.administration',
    items: [
      { href: '/users', labelKey: 'shared.users_title', icon: Users, perm: P.usersRead },
      { href: '/roles', labelKey: 'shared.roles_title', icon: KeyRound, perm: P.rolesManage },
      {
        href: '/organization',
        labelKey: 'web.nav.organization',
        icon: Building2,
        perm: P.branchesManage,
      },
      { href: '/audit', labelKey: 'web.nav.audit', icon: ScrollText, perm: P.auditRead },
      {
        href: '/notifications',
        labelKey: 'web.nav.notifications',
        icon: Bell,
        badge: 'unreadNotifications',
      },
      { href: '/settings', labelKey: 'web.settings.title', icon: Settings },
    ],
  },
];

export function visibleNavGroups(permissions: readonly string[]): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.perm) return permissions.includes(item.perm);
        if (item.anyOf) return item.anyOf.some((p) => permissions.includes(p));
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);
}
