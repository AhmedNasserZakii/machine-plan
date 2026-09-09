import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/permissions/permission_keys.dart';

/// The backend's permission catalogue, copied from
/// `backend/api/src/modules/roles/permissions.catalogue.ts`.
///
/// Refresh it with:
///   curl -s localhost:3000/api/v1/auth/me -H "Authorization: Bearer TOKEN" \
///     | python3 -c "import sys,json;print('\n'.join(sorted(json.load(sys.stdin)['data']['permissions'])))"
///
/// A code the server cannot grant is a gate that is shut for everybody, which
/// is invisible at runtime — the Reports tile was missing for every role
/// because the app asked for `reports.read`, which does not exist.
const Set<String> backendCatalogue = <String>{
  'audit.read',
  'branches.manage',
  'finance.budgets.manage',
  'finance.categories.manage',
  'finance.create',
  'finance.read',
  'finance.read.all',
  'finance.update',
  'finance.void',
  'machines.create',
  'machines.decommission',
  'machines.delete',
  'machines.import',
  'machines.read',
  'machines.read.all',
  'machines.update',
  'maintenance.close',
  'maintenance.create',
  'maintenance.read',
  'maintenance.set_cost',
  'maintenance.update',
  'merchants.create',
  'merchants.delete',
  'merchants.read',
  'merchants.read.all',
  'merchants.update',
  'reports.export',
  'reports.finance',
  'reports.machines',
  'reports.transfers',
  'reports.violations',
  'roles.manage',
  'settings.manage',
  'transfers.cancel',
  'transfers.confirm',
  'transfers.create',
  'transfers.read',
  'transfers.read.all',
  'transfers.reject',
  'users.create',
  'users.deactivate',
  'users.read',
  'users.update',
  'violations.create',
  'violations.read',
  'violations.read.all',
  'violations.resolve',
  'violations.waive',
};

/// Mirrors `P`. Dart has no reflection here, so every constant added to the
/// class has to be listed — the point is that adding one forces a look at this
/// file, where the catalogue is right there to check it against.
const List<String> appPermissionKeys = <String>[
  P.machinesRead,
  P.machinesReadAll,
  P.machinesCreate,
  P.machinesImport,
  P.machinesUpdate,
  P.machinesDelete,
  P.machinesDecommission,
  P.transfersRead,
  P.transfersReadAll,
  P.transfersCreate,
  P.transfersConfirm,
  P.transfersReject,
  P.transfersCancel,
  P.merchantsRead,
  P.merchantsReadAll,
  P.merchantsCreate,
  P.merchantsUpdate,
  P.merchantsDelete,
  P.maintenanceRead,
  P.maintenanceCreate,
  P.maintenanceUpdate,
  P.maintenanceClose,
  P.maintenanceSetCost,
  P.violationsRead,
  P.violationsReadAll,
  P.violationsCreate,
  P.violationsResolve,
  P.violationsWaive,
  P.financeRead,
  P.financeReadAll,
  P.financeCreate,
  P.financeUpdate,
  P.financeVoid,
  P.financeCategoriesManage,
  P.financeBudgetsManage,
  P.reportsMachines,
  P.reportsTransfers,
  P.reportsViolations,
  P.reportsFinance,
  P.reportsExport,
  P.usersRead,
  P.usersCreate,
  P.usersUpdate,
  P.usersDeactivate,
  P.rolesManage,
  P.branchesManage,
  P.settingsManage,
  P.auditRead,
];

void main() {
  test('every permission the app gates on exists on the backend', () {
    final List<String> unknown = appPermissionKeys
        .where((String code) => !backendCatalogue.contains(code))
        .toList();

    expect(
      unknown,
      isEmpty,
      reason:
          'These codes cannot be granted by the server, so the UI they gate is '
          'hidden from everyone: $unknown',
    );
  });

  test('the app has a key for every permission the backend can grant', () {
    final Set<String> missing = backendCatalogue.difference(
      appPermissionKeys.toSet(),
    );

    expect(
      missing,
      isEmpty,
      reason:
          'The backend grants these but the app has no constant for them, so '
          'nothing can be gated on them yet: $missing',
    );
  });

  test('the Reports entry point accepts any single report permission', () {
    expect(P.anyReport, isNotEmpty);
    for (final String code in P.anyReport) {
      expect(backendCatalogue, contains(code));
    }
  });
}
