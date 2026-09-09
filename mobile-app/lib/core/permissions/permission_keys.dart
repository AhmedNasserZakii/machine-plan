/// Mirrors the backend permission catalogue. Referencing a permission through
/// these constants makes a typo a compile error instead of a silently hidden
/// button.
abstract class P {
  // ── Machines ─────────────────────────────────────────────────────────────
  static const String machinesRead = 'machines.read';
  static const String machinesReadAll = 'machines.read.all';
  static const String machinesCreate = 'machines.create';
  static const String machinesImport = 'machines.import';
  static const String machinesUpdate = 'machines.update';
  static const String machinesDelete = 'machines.delete';
  static const String machinesDecommission = 'machines.decommission';

  // ── Transfers ────────────────────────────────────────────────────────────
  static const String transfersRead = 'transfers.read';
  static const String transfersReadAll = 'transfers.read.all';
  static const String transfersCreate = 'transfers.create';
  static const String transfersConfirm = 'transfers.confirm';
  static const String transfersReject = 'transfers.reject';
  static const String transfersCancel = 'transfers.cancel';

  // ── Merchants ────────────────────────────────────────────────────────────
  static const String merchantsRead = 'merchants.read';
  static const String merchantsReadAll = 'merchants.read.all';
  static const String merchantsCreate = 'merchants.create';
  static const String merchantsUpdate = 'merchants.update';
  static const String merchantsDelete = 'merchants.delete';

  // ── Maintenance ──────────────────────────────────────────────────────────
  static const String maintenanceRead = 'maintenance.read';
  static const String maintenanceCreate = 'maintenance.create';
  static const String maintenanceUpdate = 'maintenance.update';
  static const String maintenanceClose = 'maintenance.close';
  static const String maintenanceSetCost = 'maintenance.set_cost';

  // ── Violations ───────────────────────────────────────────────────────────
  static const String violationsRead = 'violations.read';
  static const String violationsReadAll = 'violations.read.all';
  static const String violationsCreate = 'violations.create';
  static const String violationsResolve = 'violations.resolve';
  static const String violationsWaive = 'violations.waive';

  // ── Finance ──────────────────────────────────────────────────────────────
  static const String financeRead = 'finance.read';
  static const String financeReadAll = 'finance.read.all';
  static const String financeCreate = 'finance.create';
  static const String financeUpdate = 'finance.update';
  static const String financeVoid = 'finance.void';
  static const String financeCategoriesManage = 'finance.categories.manage';
  static const String financeBudgetsManage = 'finance.budgets.manage';

  // ── Reports ──────────────────────────────────────────────────────────────
  // There is no blanket `reports.read`: the backend grants reports per domain,
  // so anything that asks "may this user open Reports at all?" gates on
  // [anyReport] rather than on a single code.
  static const String reportsMachines = 'reports.machines';
  static const String reportsTransfers = 'reports.transfers';
  static const String reportsViolations = 'reports.violations';
  static const String reportsFinance = 'reports.finance';
  static const String reportsExport = 'reports.export';

  static const List<String> anyReport = <String>[
    reportsMachines,
    reportsTransfers,
    reportsViolations,
    reportsFinance,
    merchantsRead,
    maintenanceRead,
  ];

  // ── Users, roles, branches, audit ────────────────────────────────────────
  static const String usersRead = 'users.read';
  static const String usersCreate = 'users.create';
  static const String usersUpdate = 'users.update';
  static const String usersDeactivate = 'users.deactivate';
  static const String rolesManage = 'roles.manage';
  static const String branchesManage = 'branches.manage';
  static const String settingsManage = 'settings.manage';
  static const String auditRead = 'audit.read';
}
