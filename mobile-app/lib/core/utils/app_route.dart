import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_cubit.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_state.dart';
import 'package:machinery/feature/auth/data/logic/change_password/change_password_cubit.dart';
import 'package:machinery/feature/auth/data/logic/login/login_cubit.dart';
import 'package:machinery/feature/auth/presentation/pages/change_password_screen.dart';
import 'package:machinery/feature/auth/presentation/pages/login_screen.dart';
import 'package:machinery/feature/machines/data/logic/machine_bulk_import/machine_bulk_import_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_detail/machine_detail_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_form/machine_form_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_maintenance_history/machine_maintenance_history_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_timeline/machine_timeline_cubit.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_lookup_result.dart';
import 'package:machinery/feature/machines/presentation/pages/machine_bulk_import_screen.dart';
import 'package:machinery/feature/machines/presentation/pages/machine_detail_screen.dart';
import 'package:machinery/feature/machines/presentation/pages/machine_form_screen.dart';
import 'package:machinery/feature/machines/presentation/pages/machine_maintenance_history_screen.dart';
import 'package:machinery/feature/machines/presentation/pages/machine_timeline_screen.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_create/maintenance_create_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_detail/maintenance_detail_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_list/maintenance_list_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/machine_replacement/machine_replacement_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/machine_decommission/machine_decommission_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/decommission_candidates/decommission_candidates_cubit.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';
import 'package:machinery/feature/maintenance/presentation/pages/maintenance_close_screen.dart';
import 'package:machinery/feature/maintenance/presentation/pages/maintenance_create_screen.dart';
import 'package:machinery/feature/maintenance/presentation/pages/maintenance_detail_screen.dart';
import 'package:machinery/feature/maintenance/presentation/pages/maintenance_handover_screen.dart';
import 'package:machinery/feature/maintenance/presentation/pages/maintenance_list_screen.dart';
import 'package:machinery/feature/maintenance/presentation/pages/machine_replacement_screen.dart';
import 'package:machinery/feature/maintenance/presentation/pages/machine_decommission_screen.dart';
import 'package:machinery/feature/maintenance/presentation/pages/decommission_candidates_screen.dart';
import 'package:machinery/feature/merchants/data/logic/merchant_detail/merchant_detail_cubit.dart';
import 'package:machinery/feature/merchants/data/logic/merchant_form/merchant_form_cubit.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/presentation/pages/merchant_detail_screen.dart';
import 'package:machinery/feature/merchants/presentation/pages/merchant_form_screen.dart';
import 'package:machinery/feature/more/presentation/pages/feature_not_ready_screen.dart';
import 'package:machinery/feature/nav_bar/presentation/pages/main_scaffold.dart';
import 'package:machinery/feature/scanning/data/logic/scanner/scanner_cubit.dart';
import 'package:machinery/feature/scanning/domain/entities/scan_decision.dart';
import 'package:machinery/feature/sync/data/logic/sync_queue_cubit.dart';
import 'package:machinery/feature/sync/presentation/pages/sync_queue_screen.dart';
import 'package:machinery/feature/reports/data/logic/reports_hub/reports_hub_cubit.dart';
import 'package:machinery/feature/reports/presentation/pages/reports_hub_screen.dart';
import 'package:machinery/feature/scanning/presentation/pages/raw_barcode_scanner_screen.dart';
import 'package:machinery/feature/scanning/presentation/pages/scanner_screen.dart';
import 'package:machinery/feature/splash/presentation/pages/splash_screen.dart';
import 'package:machinery/feature/transfers/data/logic/confirm_transfer/confirm_transfer_cubit.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_cubit.dart';
import 'package:machinery/feature/transfers/data/logic/transfer_detail/transfer_detail_cubit.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/presentation/pages/confirm_transfer_screen.dart';
import 'package:machinery/feature/transfers/presentation/pages/create_transfer_screen.dart';
import 'package:machinery/feature/transfers/presentation/pages/transfer_detail_screen.dart';
import 'package:machinery/feature/users/data/logic/user_form/user_form_cubit.dart';
import 'package:machinery/feature/users/data/logic/user_detail/user_detail_cubit.dart';
import 'package:machinery/feature/users/data/logic/user_permissions/user_permissions_cubit.dart';
import 'package:machinery/feature/users/data/logic/users_list/users_list_cubit.dart';
import 'package:machinery/feature/users/data/logic/roles/roles_cubit.dart';
import 'package:machinery/feature/users/domain/entities/role_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/presentation/pages/user_detail_screen.dart';
import 'package:machinery/feature/users/presentation/pages/user_form_screen.dart';
import 'package:machinery/feature/users/presentation/pages/user_permissions_screen.dart';
import 'package:machinery/feature/users/presentation/pages/users_list_screen.dart';
import 'package:machinery/feature/users/presentation/pages/roles_list_screen.dart';
import 'package:machinery/feature/users/presentation/pages/role_permissions_screen.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/shared_widgets/permission_boundary.dart';
import 'package:machinery/feature/violations/data/logic/violation_create/violation_create_cubit.dart';
import 'package:machinery/feature/violations/data/logic/violation_detail/violation_detail_cubit.dart';
import 'package:machinery/feature/violations/data/logic/violation_summary/violation_summary_cubit.dart';
import 'package:machinery/feature/violations/data/logic/violations_list/violations_list_cubit.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';
import 'package:machinery/feature/violations/domain/params/violations_query_params.dart';
import 'package:machinery/feature/violations/presentation/pages/violation_create_screen.dart';
import 'package:machinery/feature/violations/presentation/pages/violation_detail_screen.dart';
import 'package:machinery/feature/violations/presentation/pages/violation_summary_screen.dart';
import 'package:machinery/feature/violations/presentation/pages/violations_list_screen.dart';
import 'package:machinery/feature/merchants/data/logic/merchants_list/merchants_list_cubit.dart';
import 'package:machinery/feature/merchants/presentation/pages/merchants_list_screen.dart';
import 'package:machinery/feature/notifications/data/logic/notification_preferences/notification_preferences_cubit.dart';
import 'package:machinery/feature/notifications/data/logic/notifications_list/notifications_list_cubit.dart';
import 'package:machinery/feature/notifications/presentation/pages/notification_preferences_screen.dart';
import 'package:machinery/feature/notifications/presentation/pages/notifications_list_screen.dart';

/// Every navigation goes through here, so route-scoped Cubits are injected in
/// one place instead of being created inside page widgets.
abstract class AppRoute {
  AppRoute._();

  static void goBack({required BuildContext context, Object? result}) {
    Navigator.of(context).maybePop(result);
  }

  static void goToSplashScreen({required BuildContext context}) {
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute<void>(builder: (_) => const SplashScreen()),
      (route) => false,
    );
  }

  static void goToLoginScreen({required BuildContext context}) {
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute<void>(
        builder: (_) => BlocProvider<LoginCubit>(
          create: (_) => getIt<LoginCubit>(),
          child: const LoginScreen(),
        ),
      ),
      (route) => false,
    );
  }

  static void goToChangePasswordScreen({
    required BuildContext context,
    required bool isForced,
  }) {
    final Route<void> route = MaterialPageRoute<void>(
      builder: (_) => BlocProvider<ChangePasswordCubit>(
        create: (_) => getIt<ChangePasswordCubit>(),
        child: ChangePasswordScreen(isForced: isForced),
      ),
    );

    if (isForced) {
      Navigator.pushAndRemoveUntil(context, route, (_) => false);
      return;
    }

    Navigator.push(context, route);
  }

  static void goToMainScaffold({required BuildContext context}) {
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute<void>(builder: (_) => const MainScaffold()),
      (route) => false,
    );
  }

  static Future<void> goToNotificationsList({required BuildContext context}) {
    return Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => BlocProvider<NotificationsListCubit>(
          create: (_) => getIt<NotificationsListCubit>(),
          child: const NotificationsListScreen(),
        ),
      ),
    );
  }

  static Future<void> goToNotificationPreferences({
    required BuildContext context,
  }) {
    return Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => BlocProvider<NotificationPreferencesCubit>(
          create: (_) => getIt<NotificationPreferencesCubit>(),
          child: const NotificationPreferencesScreen(),
        ),
      ),
    );
  }

  static Future<void> goToMerchantsList({required BuildContext context}) {
    return Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => PermissionBoundary(
          permission: P.merchantsRead,
          child: BlocProvider<MerchantsListCubit>(
            create: (_) => getIt<MerchantsListCubit>(),
            child: const MerchantsListScreen(),
          ),
        ),
      ),
    );
  }

  static void goToFeatureNotReadyScreen({
    required BuildContext context,
    required String titleKey,
    required IconData icon,
  }) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => FeatureNotReadyScreen(titleKey: titleKey, icon: icon),
      ),
    );
  }

  static void goToSyncQueue({required BuildContext context}) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => BlocProvider<SyncQueueCubit>(
          create: (_) => getIt<SyncQueueCubit>(),
          child: const SyncQueueScreen(),
        ),
      ),
    );
  }

  static void goToReportsHub({required BuildContext context}) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => PermissionBoundary(
          anyOf: const <String>[
            P.reportsMachines,
            P.reportsTransfers,
            P.reportsViolations,
            P.reportsFinance,
          ],
          child: BlocProvider<ReportsHubCubit>(
            create: (_) => getIt<ReportsHubCubit>(),
            child: const ReportsHubScreen(),
          ),
        ),
      ),
    );
  }

  static void goToUsersList({required BuildContext context}) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => PermissionBoundary(
          permission: P.usersRead,
          child: BlocProvider<UsersListCubit>(
            create: (_) => getIt<UsersListCubit>(),
            child: const UsersListScreen(),
          ),
        ),
      ),
    );
  }

  static Future<void> goToUserDetail({
    required BuildContext context,
    required String userId,
    UserEntity? initial,
  }) => Navigator.push<void>(
    context,
    MaterialPageRoute<void>(
      builder: (_) => PermissionBoundary(
        permission: P.usersRead,
        child: BlocProvider<UserDetailCubit>(
          create: (_) => getIt<UserDetailCubit>(param1: userId, param2: initial),
          child: const UserDetailScreen(),
        ),
      ),
    ),
  );

  static Future<void> goToRolesList({required BuildContext context}) =>
      Navigator.push<void>(
        context,
        MaterialPageRoute<void>(
          builder: (_) => PermissionBoundary(
            permission: P.rolesManage,
            child: BlocProvider<RolesCubit>(
              create: (_) => getIt<RolesCubit>(),
              child: const RolesListScreen(),
            ),
          ),
        ),
      );

  static Future<void> goToRolePermissions({
    required BuildContext context,
    required RoleEntity role,
  }) => Navigator.push<void>(
    context,
    MaterialPageRoute<void>(
      builder: (_) => PermissionBoundary(
        permission: P.rolesManage,
        child: BlocProvider<RolesCubit>(
          create: (_) => getIt<RolesCubit>()..load(),
          child: RolePermissionsScreen(role: role),
        ),
      ),
    ),
  );

  /// Resolves to true when something was saved, so the list behind it knows
  /// whether it needs to refresh.
  static Future<bool?> goToUserForm({
    required BuildContext context,
    UserEntity? existing,
  }) {
    return Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(
        builder: (_) => PermissionBoundary(
          permission: existing == null ? P.usersCreate : P.usersUpdate,
          child: BlocProvider<UserFormCubit>(
            create: (_) => getIt<UserFormCubit>(param1: existing),
            child: UserFormScreen(existing: existing),
          ),
        ),
      ),
    );
  }

  static Future<void> goToUserPermissions({
    required BuildContext context,
    required UserEntity user,
  }) {
    return Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => PermissionBoundary(
          permission: P.rolesManage,
          child: BlocProvider<UserPermissionsCubit>(
            create: (_) => getIt<UserPermissionsCubit>(param1: user.id),
            child: UserPermissionsScreen(user: user),
          ),
        ),
      ),
    );
  }

  /// Resolves to true when the machine was edited from inside, so the list
  /// behind it knows whether the row it is showing is stale.
  static Future<bool?> goToMachineDetail({
    required BuildContext context,
    required String machineId,
    MachineEntity? initial,
  }) {
    return Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(
        builder: (_) => PermissionBoundary(
          permission: P.machinesRead,
          child: BlocProvider<MachineDetailCubit>(
            create: (_) =>
                getIt<MachineDetailCubit>(param1: machineId, param2: initial),
            child: const MachineDetailScreen(),
          ),
        ),
      ),
    );
  }

  static Future<bool?> goToMachineForm({
    required BuildContext context,
    MachineEntity? existing,
  }) {
    return Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(
        builder: (_) => PermissionBoundary(
          permission: existing == null ? P.machinesCreate : P.machinesUpdate,
          child: BlocProvider<MachineFormCubit>(
            create: (_) => getIt<MachineFormCubit>(param1: existing),
            child: MachineFormScreen(existing: existing),
          ),
        ),
      ),
    );
  }

  /// Resolves to true when at least one machine was created, so the list
  /// behind it knows to refresh.
  static Future<bool?> goToMachineBulkImport(BuildContext context) {
    return Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(
        builder: (_) => BlocProvider<MachineBulkImportCubit>(
          create: (_) => getIt<MachineBulkImportCubit>(),
          child: const MachineBulkImportScreen(),
        ),
      ),
    );
  }

  static void goToMachineTimeline({
    required BuildContext context,
    required String machineId,
  }) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => BlocProvider<MachineTimelineCubit>(
          create: (_) => getIt<MachineTimelineCubit>(param1: machineId),
          child: const MachineTimelineScreen(),
        ),
      ),
    );
  }

  static void goToMachineMaintenanceHistory({
    required BuildContext context,
    required String machineId,
  }) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => BlocProvider<MachineMaintenanceHistoryCubit>(
          create: (_) =>
              getIt<MachineMaintenanceHistoryCubit>(param1: machineId),
          child: const MachineMaintenanceHistoryScreen(),
        ),
      ),
    );
  }

  /// Resolves to true when the transfer changed while it was open, so the list
  /// behind it does not keep showing something that has since been signed for.
  static Future<bool?> goToTransferDetail({
    required BuildContext context,
    required String transferId,
    TransferEntity? initial,
  }) {
    return Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(
        builder: (_) => BlocProvider<TransferDetailCubit>(
          create: (_) =>
              getIt<TransferDetailCubit>(param1: transferId, param2: initial),
          child: const TransferDetailScreen(),
        ),
      ),
    );
  }

  /// Resolves to true once the receiver has signed.
  static Future<bool?> goToConfirmTransfer({
    required BuildContext context,
    required TransferEntity transfer,
  }) {
    return Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(
        builder: (_) => BlocProvider<ConfirmTransferCubit>(
          create: (_) => getIt<ConfirmTransferCubit>(param1: transfer),
          child: const ConfirmTransferScreen(),
        ),
      ),
    );
  }

  static Future<bool?> goToCreateTransfer(BuildContext context) {
    return Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(
        builder: (_) => PermissionBoundary(
          permission: P.transfersCreate,
          child: BlocProvider<CreateTransferCubit>(
            create: (_) => getIt<CreateTransferCubit>(),
            child: const CreateTransferScreen(),
          ),
        ),
      ),
    );
  }

  /// Resolves to the scanned machine, or null when the user backed out. The
  /// caller decides what a hit means — opening it, or filling a field with it.
  static Future<MachineLookupResult?> goToScanner(BuildContext context) {
    return Navigator.push<MachineLookupResult>(
      context,
      MaterialPageRoute<MachineLookupResult>(
        builder: (_) => BlocProvider<ScannerCubit>(
          create: (_) => getIt<ScannerCubit>(),
          child: const ScannerScreen(),
        ),
      ),
    );
  }

  /// Reads one barcode and returns the raw string, or null if the user backed
  /// out — no lookup, for capturing a serial that need not already exist on
  /// record (`8.2`, battery scanning in a transfer item's details).
  static Future<String?> goToRawBarcodeScanner({
    required BuildContext context,
    String? titleKey,
  }) {
    return Navigator.push<String>(
      context,
      MaterialPageRoute<String>(
        builder: (_) => RawBarcodeScannerScreen(titleKey: titleKey),
      ),
    );
  }

  /// The camera stays open across every hit (`8.2`) — [onHit] decides whether
  /// each one counts, and the caller has already acted on every accepted hit
  /// by the time this resolves, so nothing is returned.
  static Future<void> goToContinuousScanner({
    required BuildContext context,
    required Future<ScanDecision> Function(MachineLookupResult) onHit,
  }) {
    return Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => BlocProvider<ScannerCubit>(
          create: (_) => getIt<ScannerCubit>(),
          child: ScannerScreen(
            mode: ScannerMode.continuous,
            onContinuousHit: onHit,
          ),
        ),
      ),
    );
  }

  /// Resolves to true when the merchant changed while it was open, so the list
  /// behind it does not keep showing a stale row.
  static Future<bool?> goToMerchantDetail({
    required BuildContext context,
    required String merchantId,
    MerchantEntity? initial,
  }) {
    return Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(
        builder: (_) => PermissionBoundary(
          permission: P.merchantsRead,
          child: BlocProvider<MerchantDetailCubit>(
            create: (_) =>
                getIt<MerchantDetailCubit>(param1: merchantId, param2: initial),
            child: const MerchantDetailScreen(),
          ),
        ),
      ),
    );
  }

  /// Returns the created or updated merchant, or `null` if the form was left
  /// without saving — a caller that only needs to know "did something
  /// change" can check for non-null, and one that needs the record itself
  /// (the create-transfer wizard's inline "new merchant" shortcut) gets it
  /// without a second fetch.
  static Future<MerchantEntity?> goToMerchantForm({
    required BuildContext context,
    MerchantEntity? existing,
  }) {
    return Navigator.push<MerchantEntity>(
      context,
      MaterialPageRoute<MerchantEntity>(
        builder: (_) => BlocProvider<MerchantFormCubit>(
          create: (_) => getIt<MerchantFormCubit>(param1: existing),
          child: MerchantFormScreen(existing: existing),
        ),
      ),
    );
  }

  /// [scope] narrows the register before it loads — one machine's history, or
  /// one representative's record.
  static Future<void> goToViolationsList({
    required BuildContext context,
    ViolationsQueryParams? scope,
  }) {
    return Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => PermissionBoundary(
          permission: P.violationsRead,
          child: BlocProvider<ViolationsListCubit>(
            create: (_) => getIt<ViolationsListCubit>(),
            child: ViolationsListScreen(scope: scope),
          ),
        ),
      ),
    );
  }

  /// Resolves to the row as the server left it, so the list can swap it in
  /// place instead of refetching a page. Null means nothing was done to it.
  static Future<ViolationEntity?> goToViolationDetail({
    required BuildContext context,
    required String violationId,
    ViolationEntity? initial,
  }) {
    return Navigator.push<ViolationEntity>(
      context,
      MaterialPageRoute<ViolationEntity>(
        builder: (_) => PermissionBoundary(
          permission: P.violationsRead,
          child: BlocProvider<ViolationDetailCubit>(
            create: (_) =>
                getIt<ViolationDetailCubit>(param1: violationId, param2: initial),
            child: const ViolationDetailScreen(),
          ),
        ),
      ),
    );
  }

  static Future<void> goToViolationSummary({
    required BuildContext context,
    required String userId,
  }) {
    return Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => BlocProvider<ViolationSummaryCubit>(
          create: (_) => getIt<ViolationSummaryCubit>(param1: userId),
          child: const ViolationSummaryScreen(),
        ),
      ),
    );
  }

  /// Resolves to the newly-raised row, so a caller showing a list can insert
  /// it without a full reload.
  static Future<ViolationEntity?> goToViolationCreate({
    required BuildContext context,
  }) {
    return Navigator.push<ViolationEntity>(
      context,
      MaterialPageRoute<ViolationEntity>(
        builder: (_) => PermissionBoundary(
          permission: P.violationsCreate,
          child: BlocProvider<ViolationCreateCubit>(
            create: (_) => getIt<ViolationCreateCubit>(),
            child: const ViolationCreateScreen(),
          ),
        ),
      ),
    );
  }

  /// [scope] narrows the register before it loads — one machine's own orders,
  /// opened from its history screen.
  static Future<void> goToMaintenanceList({
    required BuildContext context,
    MaintenanceOrdersQueryParams? scope,
  }) {
    return Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => PermissionBoundary(
          permission: P.maintenanceRead,
          child: BlocProvider<MaintenanceListCubit>(
            create: (_) => getIt<MaintenanceListCubit>(),
            child: MaintenanceListScreen(scope: scope),
          ),
        ),
      ),
    );
  }

  /// Resolves to the row as the server left it, so the list can swap it in
  /// place instead of refetching a page. Null means nothing was done to it.
  static Future<MaintenanceOrderEntity?> goToMaintenanceDetail({
    required BuildContext context,
    required String orderId,
    MaintenanceOrderEntity? initial,
  }) {
    return Navigator.push<MaintenanceOrderEntity>(
      context,
      MaterialPageRoute<MaintenanceOrderEntity>(
        builder: (_) => BlocProvider<MaintenanceDetailCubit>(
          create: (_) =>
              getIt<MaintenanceDetailCubit>(param1: orderId, param2: initial),
          child: const MaintenanceDetailScreen(),
        ),
      ),
    );
  }

  /// Opened straight from a machine's own detail screen — [machineId] is
  /// pre-filled, there is no picker. Resolves to the created order, or null.
  static Future<MaintenanceOrderEntity?> goToMaintenanceCreate({
    required BuildContext context,
    required String machineId,
    required String machineSerial,
  }) {
    return Navigator.push<MaintenanceOrderEntity>(
      context,
      MaterialPageRoute<MaintenanceOrderEntity>(
        builder: (_) => BlocProvider<MaintenanceCreateCubit>(
          create: (_) => getIt<MaintenanceCreateCubit>(),
          child: MaintenanceCreateScreen(
            machineId: machineId,
            machineSerial: machineSerial,
          ),
        ),
      ),
    );
  }

  /// Shares the caller's own [cubit] instance rather than creating a new one
  /// (see `MaintenanceHandoverScreen`'s doc comment) — resolves to true once
  /// the hand-off went through, so the detail screen behind it knows to carry
  /// the change back out when it, in turn, is popped.
  static Future<bool?> goToMaintenanceHandover({
    required BuildContext context,
    required MaintenanceDetailCubit cubit,
    required bool isSend,
  }) {
    return Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(
        builder: (_) => BlocProvider<MaintenanceDetailCubit>.value(
          value: cubit,
          child: MaintenanceHandoverScreen(isSend: isSend),
        ),
      ),
    );
  }

  /// Same shared-cubit shape as `goToMaintenanceHandover` — the close screen
  /// (`11.2`) is still just one more action on the order the detail screen
  /// already has open. Resolves to true once the close went through.
  static Future<bool?> goToMaintenanceClose({
    required BuildContext context,
    required MaintenanceDetailCubit cubit,
    required MaintenanceOrderEntity order,
  }) {
    return Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(
        builder: (_) => BlocProvider<MaintenanceDetailCubit>.value(
          value: cubit,
          child: MaintenanceCloseScreen(order: order),
        ),
      ),
    );
  }

  /// Records a factory swap and returns both freshly-read sides of the chain.
  static Future<bool?> goToMachineReplacement({
    required BuildContext context,
    required MachineEntity machine,
  }) {
    return Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(
        builder: (_) => BlocProvider<MachineReplacementCubit>(
          create: (_) => getIt<MachineReplacementCubit>(param1: machine),
          child: MachineReplacementScreen(machine: machine),
        ),
      ),
    );
  }

  static Future<bool?> goToMachineDecommission({
    required BuildContext context,
    required MachineEntity machine,
  }) {
    return Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(
        builder: (_) => BlocProvider<MachineDecommissionCubit>(
          create: (_) => getIt<MachineDecommissionCubit>(param1: machine.id),
          child: MachineDecommissionScreen(machine: machine),
        ),
      ),
    );
  }

  static Future<void> goToDecommissionCandidates({
    required BuildContext context,
  }) {
    return Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => BlocProvider<DecommissionCandidatesCubit>(
          create: (_) => getIt<DecommissionCandidatesCubit>(),
          child: const DecommissionCandidatesScreen(),
        ),
      ),
    );
  }

  /// Sends the user wherever the current session says they belong. Used after
  /// a biometric unlock, and by anything that needs to re-resolve the session
  /// without duplicating the splash logic.
  static void goToAuthGate({required BuildContext context}) {
    final AuthState state = getIt<AuthCubit>().state;

    if (state is Authenticated) {
      if (state.mustChangePassword) {
        goToChangePasswordScreen(context: context, isForced: true);
      } else {
        goToMainScaffold(context: context);
      }
      return;
    }

    goToLoginScreen(context: context);
  }
}
