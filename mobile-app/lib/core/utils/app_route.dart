import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_cubit.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_state.dart';
import 'package:machinery/feature/auth/data/logic/change_password/change_password_cubit.dart';
import 'package:machinery/feature/auth/data/logic/login/login_cubit.dart';
import 'package:machinery/feature/auth/presentation/pages/change_password_screen.dart';
import 'package:machinery/feature/auth/presentation/pages/login_screen.dart';
import 'package:machinery/feature/machines/data/logic/machine_detail/machine_detail_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_form/machine_form_cubit.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_lookup_result.dart';
import 'package:machinery/feature/machines/presentation/pages/machine_detail_screen.dart';
import 'package:machinery/feature/machines/presentation/pages/machine_form_screen.dart';
import 'package:machinery/feature/merchants/data/logic/merchant_detail/merchant_detail_cubit.dart';
import 'package:machinery/feature/merchants/data/logic/merchant_form/merchant_form_cubit.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/presentation/pages/merchant_detail_screen.dart';
import 'package:machinery/feature/merchants/presentation/pages/merchant_form_screen.dart';
import 'package:machinery/feature/more/presentation/pages/feature_not_ready_screen.dart';
import 'package:machinery/feature/nav_bar/presentation/pages/main_scaffold.dart';
import 'package:machinery/feature/scanning/data/logic/scanner/scanner_cubit.dart';
import 'package:machinery/feature/sync/data/logic/sync_queue_cubit.dart';
import 'package:machinery/feature/sync/presentation/pages/sync_queue_screen.dart';
import 'package:machinery/feature/reports/data/logic/reports_hub/reports_hub_cubit.dart';
import 'package:machinery/feature/reports/presentation/pages/reports_hub_screen.dart';
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
import 'package:machinery/feature/users/data/logic/user_permissions/user_permissions_cubit.dart';
import 'package:machinery/feature/users/data/logic/users_list/users_list_cubit.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/presentation/pages/user_form_screen.dart';
import 'package:machinery/feature/users/presentation/pages/user_permissions_screen.dart';
import 'package:machinery/feature/users/presentation/pages/users_list_screen.dart';
import 'package:machinery/feature/violations/data/logic/violation_detail/violation_detail_cubit.dart';
import 'package:machinery/feature/violations/data/logic/violation_summary/violation_summary_cubit.dart';
import 'package:machinery/feature/violations/data/logic/violations_list/violations_list_cubit.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';
import 'package:machinery/feature/violations/domain/params/violations_query_params.dart';
import 'package:machinery/feature/violations/presentation/pages/violation_detail_screen.dart';
import 'package:machinery/feature/violations/presentation/pages/violation_summary_screen.dart';
import 'package:machinery/feature/violations/presentation/pages/violations_list_screen.dart';

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
        builder: (_) => BlocProvider<ReportsHubCubit>(
          create: (_) => getIt<ReportsHubCubit>(),
          child: const ReportsHubScreen(),
        ),
      ),
    );
  }

  static void goToUsersList({required BuildContext context}) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => BlocProvider<UsersListCubit>(
          create: (_) => getIt<UsersListCubit>(),
          child: const UsersListScreen(),
        ),
      ),
    );
  }

  /// Resolves to true when something was saved, so the list behind it knows
  /// whether it needs to refresh.
  static Future<bool?> goToUserForm({
    required BuildContext context,
    UserEntity? existing,
  }) {
    return Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(
        builder: (_) => BlocProvider<UserFormCubit>(
          create: (_) => getIt<UserFormCubit>(param1: existing),
          child: UserFormScreen(existing: existing),
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
        builder: (_) => BlocProvider<UserPermissionsCubit>(
          create: (_) => getIt<UserPermissionsCubit>(param1: user.id),
          child: UserPermissionsScreen(user: user),
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
        builder: (_) => BlocProvider<MachineDetailCubit>(
          create: (_) =>
              getIt<MachineDetailCubit>(param1: machineId, param2: initial),
          child: const MachineDetailScreen(),
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
        builder: (_) => BlocProvider<MachineFormCubit>(
          create: (_) => getIt<MachineFormCubit>(param1: existing),
          child: MachineFormScreen(existing: existing),
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
        builder: (_) => BlocProvider<CreateTransferCubit>(
          create: (_) => getIt<CreateTransferCubit>(),
          child: const CreateTransferScreen(),
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
        builder: (_) => BlocProvider<MerchantDetailCubit>(
          create: (_) =>
              getIt<MerchantDetailCubit>(param1: merchantId, param2: initial),
          child: const MerchantDetailScreen(),
        ),
      ),
    );
  }

  static Future<bool?> goToMerchantForm({
    required BuildContext context,
    MerchantEntity? existing,
  }) {
    return Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(
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
        builder: (_) => BlocProvider<ViolationsListCubit>(
          create: (_) => getIt<ViolationsListCubit>(),
          child: ViolationsListScreen(scope: scope),
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
        builder: (_) => BlocProvider<ViolationDetailCubit>(
          create: (_) =>
              getIt<ViolationDetailCubit>(param1: violationId, param2: initial),
          child: const ViolationDetailScreen(),
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
