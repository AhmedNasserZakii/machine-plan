import 'dart:io' show Platform;

/// Endpoint catalogue. Repositories must never hard-code a path.
abstract class WebConstant {
  // TODO(backend): replace with the real host once the API is deployed.
  static const String _prodHost = 'https://api.machinery.example.com/api/v1/';

  static const bool isDev = true;

  /// Port the local NestJS API listens on (`backend/api`, `npm run start:dev`).
  static const String _localPort = '3000';

  /// Set with `--dart-define=API_BASE_URL=…`. The end-to-end suite points this
  /// at a local mock server, and a physical device needs the machine's LAN
  /// address here. Leaving it unset falls back to the loopback host below.
  static const String _overrideHost = String.fromEnvironment('API_BASE_URL');

  static String get host {
    if (_overrideHost.isNotEmpty) {
      return _overrideHost;
    }
    return isDev ? _localHost : _prodHost;
  }

  /// The Android emulator is a VM, so its `localhost` is the emulator itself;
  /// `10.0.2.2` is the alias for the host machine. The iOS simulator shares the
  /// host network, so plain `localhost` reaches the API.
  static String get _localHost {
    final String address = Platform.isAndroid ? '10.0.2.2' : 'localhost';
    return 'http://$address:$_localPort/api/v1/';
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  static const String login = 'auth/login';
  static const String logout = 'auth/logout';
  static const String refresh = 'auth/refresh';
  static const String me = 'auth/me';
  static const String changePassword = 'auth/change-password';

  // ── Sync ─────────────────────────────────────────────────────────────────
  static const String syncBootstrap = 'sync/bootstrap';
  static const String syncDelta = 'sync/delta';
  static const String syncBatch = 'sync/batch';
  static const String syncStatus = 'sync/status';

  // ── Machines ─────────────────────────────────────────────────────────────
  static const String machines = 'machines';
  static const String machinesBulk = 'machines/bulk';
  static const String machinesDecommissionCandidates =
      'machines/decommission-candidates';

  /// QR scan resolver. Matches any of the unit's four serials — machine,
  /// battery, SIM or box — and reports which one in `matchedOn`.
  static const String machinesLookup = 'machines/lookup';

  /// The type and model catalogue behind the intake form's model picker. Reads
  /// are open to any authenticated user because every machine form needs them.
  static const String machineTypes = 'machine-types';
  static const String machineModels = 'machine-models';

  static String machineBySerial(String serial) => '$machines/by-serial/$serial';

  static String machine(String id) => '$machines/$id';
  static String machineTimeline(String id) => '$machines/$id/timeline';
  static String machineCostSummary(String id) => '$machines/$id/cost-summary';
  static String machineMaintenanceHistory(String id) =>
      '$machines/$id/maintenance-history';
  static String machineReplacementChain(String id) =>
      '$machines/$id/replacement-chain';
  static String machineBattery(String id) => '$machines/$id/battery';
  static String machineDecommission(String id) => '$machines/$id/decommission';
  static String machineDecommissionRevert(String id) =>
      '$machines/$id/decommission/revert';
  static String machineReplace(String id) => '$machines/$id/replace';

  static const String decommissions = 'decommissions';
  static const String replacements = 'replacements';

  // ── Transfers ────────────────────────────────────────────────────────────
  static const String transfers = 'transfers';

  /// Waiting for my signature.
  static const String transfersIncoming = 'transfers/pending/incoming';

  /// Sent by me and not signed for yet.
  static const String transfersOutgoing = 'transfers/pending/outgoing';

  /// Dry run: every create check, no writes. Lets the app block a hand-off
  /// before the rep has collected a signature for it.
  static const String transfersValidate = 'transfers/validate';

  /// Who the caller may hand a given type to. Gated on `transfers.create`, so
  /// the picker works for a supervisor who cannot read the user directory.
  static const String transfersRecipients = 'transfers/recipients';

  /// Which hand-offs the caller may start. Asked rather than derived from the
  /// role, so the custody rules live in one place — the server.
  static const String transfersCreatableTypes = 'transfers/creatable-types';

  static String transfer(String id) => '$transfers/$id';
  static String transferConfirm(String id) => '$transfers/$id/confirm';
  static String transferReject(String id) => '$transfers/$id/reject';
  static String transferCancel(String id) => '$transfers/$id/cancel';
  static String transferSignatureMedia(String id, String signatureId) =>
      '$transfers/$id/signatures/$signatureId/media';

  // ── Merchants ────────────────────────────────────────────────────────────
  static const String merchants = 'merchants';
  static const String subscriptions = 'subscriptions';

  /// Whom the caller may hand a machine to. Gated on `transfers.create` rather
  /// than `merchants.read`, so the picker works for a rep who cannot open the
  /// merchant book.
  static const String merchantsPickable = 'merchants/pickable';

  /// Answers a phone and a national ID before the registration form submits.
  static const String merchantsCheck = 'merchants/check';

  static String merchant(String id) => '$merchants/$id';
  static String merchantMachines(String id) => '$merchants/$id/machines';
  static String merchantTimeline(String id) => '$merchants/$id/timeline';
  static String merchantSubscriptions(String id) =>
      '$merchants/$id/subscriptions';
  static String merchantDeactivate(String id) => '$merchants/$id/deactivate';
  static String subscription(String id) => '$subscriptions/$id';
  static String subscriptionCollect(String id) => '$subscriptions/$id/collect';

  // ── Maintenance ──────────────────────────────────────────────────────────
  static const String maintenanceOrders = 'maintenance-orders';

  static String maintenanceOrder(String id) => '$maintenanceOrders/$id';
  static String maintenanceOrderSend(String id) =>
      '$maintenanceOrders/$id/send';
  static String maintenanceOrderReceive(String id) =>
      '$maintenanceOrders/$id/receive';
  static String maintenanceOrderCancel(String id) =>
      '$maintenanceOrders/$id/cancel';
  static String maintenanceOrderClose(String id) =>
      '$maintenanceOrders/$id/close';

  // ── Violations ───────────────────────────────────────────────────────────
  static const String violations = 'violations';
  static const String myViolations = 'violations/mine';

  static String violation(String id) => '$violations/$id';

  /// Reading it is the representative saying he has seen it. It does not settle
  /// anything — only a charge or a waiver does.
  static String violationAcknowledge(String id) =>
      '$violations/$id/acknowledge';

  static String violationCharge(String id) => '$violations/$id/charge';
  static String violationWaive(String id) => '$violations/$id/waive';

  // ── Finance ──────────────────────────────────────────────────────────────
  static const String financeSummary = 'finance/summary';
  static const String financeTransactions = 'finance/transactions';
  static const String financeByCategory = 'finance/by-category';
  static const String financeCategoriesTree = 'finance/categories/tree';
  static const String financeCategories = 'finance/categories';
  static const String financeBudgets = 'finance/budgets';
  static const String financeBudgetsStatus = 'finance/budgets/status';
  static const String financeExport = 'finance/export';
  static const String financeSuppliers = 'suppliers';

  static String financeTransaction(String id) => '$financeTransactions/$id';
  static String financeTransactionVoid(String id) =>
      '$financeTransactions/$id/void';
  static String financeCategory(String id) => '$financeCategories/$id';
  static String financeCategoryMove(String id) => '$financeCategories/$id/move';
  static String financeCategoryBreadcrumb(String id) =>
      '$financeCategories/$id/breadcrumb';
  static String financeBudget(String id) => '$financeBudgets/$id';

  // ── Reports ──────────────────────────────────────────────────────────────
  static const String reports = 'reports';

  static String report(String path) =>
      path.startsWith('/') ? path.substring(1) : path;
  static String reportJob(String jobId) => '$reports/jobs/$jobId';

  // ── Notifications ────────────────────────────────────────────────────────
  static const String notifications = 'notifications';
  static const String notificationPreferences = 'notifications/preferences';
  static const String pushSubscriptions = 'push-subscriptions';

  static String notificationRead(String id) => '$notifications/$id/read';

  // ── Users, roles & branches ──────────────────────────────────────────────
  static const String users = 'users';
  static const String roles = 'roles';
  static const String permissions = 'permissions';
  static const String branches = 'branches';
  static const String warehouses = 'warehouses';

  static String user(String id) => '$users/$id';
  static String userPermissions(String id) => '$users/$id/permissions';
  static String userActivate(String id) => '$users/$id/activate';
  static String userDeactivate(String id) => '$users/$id/deactivate';
  static String userResetPassword(String id) => '$users/$id/reset-password';
  static String rolePermissions(String id) => '$roles/$id/permissions';
  static String userCustody(String id) => '$users/$id/custody';
  static String userViolationsSummary(String id) =>
      '$users/$id/violations/summary';
  static String branchSummary(String id) => '$branches/$id/summary';

  // ── Lookups ──────────────────────────────────────────────────────────────
  // Reference tables the app loads once and holds for the session. Reads are
  // open to any authenticated user except payment methods, which sit behind
  // `finance.read` — the same permission that lets anyone take money at all.
  static const String paymentMethods = 'payment-methods';
  static const String violationTypes = 'violation-types';
  static const String maintenanceLocations = 'maintenance-locations';
  static const String decommissionReasons = 'decommission-reasons';

  // ── Media ────────────────────────────────────────────────────────────────
  static const String mediaPresign = 'media/presign';
  static const String mediaConfirm = 'media/confirm';
  static const String mediaUpload = 'media/upload';

  static String media(String id) => 'media/$id';
}
