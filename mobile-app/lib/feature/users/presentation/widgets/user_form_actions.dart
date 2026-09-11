import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/shared_widgets/app_confirm_dialog.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/permission_gate.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_cubit.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_state.dart';
import 'package:machinery/feature/more/presentation/widgets/more_tile.dart';
import 'package:machinery/feature/users/data/logic/user_actions/user_actions_cubit.dart';
import 'package:machinery/feature/users/data/logic/user_actions/user_actions_state.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/presentation/widgets/reset_password_dialog.dart';
import 'package:machinery/feature/violations/domain/params/violations_query_params.dart';

/// The actions that only make sense on an existing account: permissions,
/// password reset, and suspending or restoring access.
class UserFormActions extends StatelessWidget {
  const UserFormActions({required this.user, super.key});

  final UserEntity user;

  /// Editing your own permissions is refused here as well as on the server —
  /// locking yourself out of the only account that can grant permissions is
  /// not recoverable from inside the app.
  bool _isSelf(BuildContext context) {
    final AuthState state = getIt<AuthCubit>().state;
    return state is Authenticated && state.profile.user.id == user.id;
  }

  Future<void> _confirmSetActive(BuildContext context, bool isActive) async {
    if (isActive) {
      await context.read<UserActionsCubit>().setActive(isActive: true);
      return;
    }

    final bool confirmed = await AppConfirmDialog.show(
      context: context,
      title: LocaleKeys.userDeactivateTitle.tr(),
      description: LocaleKeys.userDeactivateMessage.tr(
        args: <String>[user.fullName],
      ),
      confirmLabel: LocaleKeys.userDeactivate.tr(),
      isDestructive: true,
      confirmIdentifier: 'user_deactivate_confirm',
      cancelIdentifier: 'user_deactivate_cancel',
    );

    if (confirmed && context.mounted) {
      await context.read<UserActionsCubit>().setActive(isActive: false);
    }
  }

  Future<void> _resetPassword(BuildContext context) async {
    final String? password = await ResetPasswordDialog.show(context);

    if (password != null && password.isNotEmpty && context.mounted) {
      await context.read<UserActionsCubit>().resetPassword(password);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider<UserActionsCubit>(
      create: (_) => getIt<UserActionsCubit>(param1: user),
      child: BlocConsumer<UserActionsCubit, UserActionsState>(
        listener: (BuildContext context, UserActionsState state) {
          if (state is UserActionsFailed) {
            showErrorToast(state.errorMessage.tr(), context);
          }
          if (state is UserActionsSucceeded) {
            showSuccessToast(state.messageKey.tr(), context);
          }
        },
        builder: (BuildContext context, UserActionsState state) {
          final bool isActive =
              state is UserActionsIdle ? state.isActive : user.isActive;

          return Container(
            decoration: BoxDecoration(
              color: AppColors.surfaceColor,
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(color: AppColors.borderColor),
            ),
            child: Column(
              children: <Widget>[
                PermissionGate(
                  permission: P.rolesManage,
                  child: MoreTile(
                    identifier: 'user_permissions_tile',
                    icon: Icons.shield_outlined,
                    label: LocaleKeys.userPermissionsTitle.tr(),
                    onTap: () {
                      if (_isSelf(context)) {
                        showErrorToast(
                          LocaleKeys.userPermissionsSelfEditBlocked.tr(),
                          context,
                        );
                        return;
                      }
                      AppRoute.goToUserPermissions(
                        context: context,
                        user: user,
                      );
                    },
                  ),
                ),
                PermissionGate(
                  permission: P.usersUpdate,
                  child: MoreTile(
                    identifier: 'user_reset_password_tile',
                    icon: Icons.password_rounded,
                    label: LocaleKeys.userResetPassword.tr(),
                    onTap: () => _resetPassword(context),
                  ),
                ),
                PermissionGate(
                  permission: P.usersDeactivate,
                  child: MoreTile(
                    identifier: 'user_set_active_tile',
                    icon: isActive
                        ? Icons.block_outlined
                        : Icons.check_circle_outline_rounded,
                    label: isActive
                        ? LocaleKeys.userDeactivate.tr()
                        : LocaleKeys.userActivate.tr(),
                    isDestructive: isActive,
                    onTap: () => _confirmSetActive(context, !isActive),
                  ),
                ),
                PermissionGate(
                  permission: P.violationsRead,
                  child: MoreTile(
                    identifier: 'user_violations_tile',
                    icon: Icons.gavel_rounded,
                    label: LocaleKeys.violationsTitle.tr(),
                    onTap: () => AppRoute.goToViolationsList(
                      context: context,
                      scope: ViolationsQueryParams(userId: user.id),
                    ),
                  ),
                ),
                PermissionGate(
                  permission: P.violationsRead,
                  child: MoreTile(
                    identifier: 'user_violation_summary_tile',
                    icon: Icons.summarize_outlined,
                    label: LocaleKeys.violationSummaryTitle.tr(),
                    onTap: () => AppRoute.goToViolationSummary(
                      context: context,
                      userId: user.id,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
