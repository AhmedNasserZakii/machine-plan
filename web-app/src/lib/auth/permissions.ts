export const P = {
  machinesRead: 'machines.read',
  machinesReadAll: 'machines.read.all',
  machinesCreate: 'machines.create',
  machinesImport: 'machines.import',
  machinesUpdate: 'machines.update',
  machinesDelete: 'machines.delete',
  machinesDecommission: 'machines.decommission',

  transfersRead: 'transfers.read',
  transfersReadAll: 'transfers.read.all',
  transfersCreate: 'transfers.create',
  transfersConfirm: 'transfers.confirm',
  transfersReject: 'transfers.reject',
  transfersCancel: 'transfers.cancel',

  merchantsRead: 'merchants.read',
  merchantsReadAll: 'merchants.read.all',
  merchantsCreate: 'merchants.create',
  merchantsUpdate: 'merchants.update',
  merchantsDelete: 'merchants.delete',

  maintenanceRead: 'maintenance.read',
  maintenanceCreate: 'maintenance.create',
  maintenanceUpdate: 'maintenance.update',
  maintenanceClose: 'maintenance.close',
  maintenanceSetCost: 'maintenance.set_cost',

  violationsRead: 'violations.read',
  violationsReadAll: 'violations.read.all',
  violationsCreate: 'violations.create',
  violationsResolve: 'violations.resolve',
  violationsWaive: 'violations.waive',

  financeRead: 'finance.read',
  financeReadAll: 'finance.read.all',
  financeCreate: 'finance.create',
  financeUpdate: 'finance.update',
  financeVoid: 'finance.void',
  financeCategoriesManage: 'finance.categories.manage',
  financeBudgetsManage: 'finance.budgets.manage',

  reportsMachines: 'reports.machines',
  reportsTransfers: 'reports.transfers',
  reportsViolations: 'reports.violations',
  reportsFinance: 'reports.finance',
  reportsExport: 'reports.export',

  usersRead: 'users.read',
  usersCreate: 'users.create',
  usersUpdate: 'users.update',
  usersDeactivate: 'users.deactivate',
  rolesManage: 'roles.manage',
  branchesManage: 'branches.manage',
  settingsManage: 'settings.manage',
  auditRead: 'audit.read',
} as const;

export type PermissionCode = (typeof P)[keyof typeof P];

export const ANY_REPORT = [
  P.reportsMachines,
  P.reportsTransfers,
  P.reportsViolations,
  P.reportsFinance,
  P.merchantsRead,
  P.maintenanceRead,
] as const;

export const READ_ALL = [
  P.machinesReadAll,
  P.transfersReadAll,
  P.merchantsReadAll,
  P.violationsReadAll,
  P.financeReadAll,
] as const;
