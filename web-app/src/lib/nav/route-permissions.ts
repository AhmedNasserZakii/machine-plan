import { ANY_REPORT, P } from '@/lib/auth/permissions';

export const routePermissions: Array<{ pattern: RegExp; anyOf: string[] }> = [
  { pattern: /^\/machines(\/|$)/, anyOf: [P.machinesRead] },
  { pattern: /^\/machines\/new$/, anyOf: [P.machinesCreate] },
  { pattern: /^\/machines\/import$/, anyOf: [P.machinesImport] },
  { pattern: /^\/machines\/[^/]+\/edit$/, anyOf: [P.machinesUpdate] },
  { pattern: /^\/transfers(\/|$)/, anyOf: [P.transfersRead] },
  { pattern: /^\/transfers\/new$/, anyOf: [P.transfersCreate] },
  { pattern: /^\/merchants(\/|$)/, anyOf: [P.merchantsRead] },
  { pattern: /^\/maintenance(\/|$)/, anyOf: [P.maintenanceRead] },
  { pattern: /^\/violations(\/|$)/, anyOf: [P.violationsRead] },
  { pattern: /^\/violations\/new$/, anyOf: [P.violationsCreate] },
  { pattern: /^\/finance(\/|$)/, anyOf: [P.financeRead] },
  { pattern: /^\/finance\/transactions\/new$/, anyOf: [P.financeCreate] },
  { pattern: /^\/finance\/transactions\/[^/]+\/edit$/, anyOf: [P.financeUpdate] },
  { pattern: /^\/finance\/categories(\/|$)/, anyOf: [P.financeCategoriesManage] },
  { pattern: /^\/finance\/budgets(\/|$)/, anyOf: [P.financeBudgetsManage] },
  { pattern: /^\/finance\/budgets\/new$/, anyOf: [P.financeBudgetsManage] },
  { pattern: /^\/finance\/budgets\/[^/]+\/edit$/, anyOf: [P.financeBudgetsManage] },
  { pattern: /^\/reports(\/|$)/, anyOf: [...ANY_REPORT] },
  { pattern: /^\/users(\/|$)/, anyOf: [P.usersRead] },
  { pattern: /^\/users\/new$/, anyOf: [P.usersCreate] },
  { pattern: /^\/users\/[^/]+\/edit$/, anyOf: [P.usersUpdate] },
  { pattern: /^\/roles(\/|$)/, anyOf: [P.rolesManage] },
  { pattern: /^\/organization(\/|$)/, anyOf: [P.branchesManage, P.settingsManage] },
  { pattern: /^\/organization\/branches(\/|$)/, anyOf: [P.branchesManage] },
  { pattern: /^\/organization\/warehouses(\/|$)/, anyOf: [P.branchesManage] },
  { pattern: /^\/organization\/lookups(\/|$)/, anyOf: [P.settingsManage] },
  { pattern: /^\/organization\/sync(\/|$)/, anyOf: [P.settingsManage] },
  { pattern: /^\/audit(\/|$)/, anyOf: [P.auditRead] },
  { pattern: /^\/settings\/system/, anyOf: [P.settingsManage] },
];

export function requiredPermissionsForPath(pathname: string): string[] | null {
  let match: string[] | null = null;
  for (const row of routePermissions) {
    if (row.pattern.test(pathname)) {
      match = row.anyOf;
    }
  }
  return match;
}
