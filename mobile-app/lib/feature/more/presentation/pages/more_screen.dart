import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/shared_widgets/app_confirm_dialog.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_cubit.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_state.dart';
import 'package:machinery/feature/more/data/logic/logout/logout_cubit.dart';
import 'package:machinery/feature/more/data/logic/logout/logout_state.dart';
import 'package:machinery/feature/more/presentation/widgets/more_profile_header.dart';
import 'package:machinery/feature/more/presentation/widgets/more_section.dart';
import 'package:machinery/feature/more/presentation/widgets/more_tile.dart';
import 'package:machinery/feature/splash/presentation/widgets/language_bottom_sheet.dart';

/// The overflow tab. Everything that does not earn a permanent slot in the
/// bottom bar lives here: reports, user administration, notifications, device
/// settings and logout.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<LogoutCubit>(
      create: (_) => getIt<LogoutCubit>(),
      child: const _MoreView(),
    );
  }
}

class _MoreView extends StatelessWidget {
  const _MoreView();

  Future<void> _onLogoutPressed(BuildContext context) async {
    final LogoutCubit logoutCubit = context.read<LogoutCubit>();

    final int pending = await logoutCubit.readPendingCount();

    if (!context.mounted) {
      return;
    }

    // Unsent work is the only reason to make this dialog scarier than usual.
    final String description = pending > 0
        ? LocaleKeys.logoutPendingSyncWarning.tr()
        : LocaleKeys.logoutConfirmMessage.tr();

    final bool confirmed = await AppConfirmDialog.show(
      context: context,
      title: LocaleKeys.logoutConfirmTitle.tr(),
      description: description,
      confirmLabel: LocaleKeys.logout.tr(),
      isDestructive: true,
      icon: Icons.logout_rounded,
      confirmIdentifier: 'logout_confirm_button',
      cancelIdentifier: 'logout_cancel_button',
    );

    if (!confirmed || !context.mounted) {
      return;
    }

    await logoutCubit.logout();
  }

  void _openNotReady(
    BuildContext context, {
    required String titleKey,
    required IconData icon,
  }) {
    AppRoute.goToFeatureNotReadyScreen(
      context: context,
      titleKey: titleKey,
      icon: icon,
    );
  }

  @override
  Widget build(BuildContext context) {
    final PermissionService permissionService = getIt<PermissionService>();

    return BlocListener<LogoutCubit, LogoutState>(
      listener: (context, state) {
        if (state is LogoutDone) {
          if (state.warning != null) {
            showErrorToast(state.warning!, context);
          }
          AppRoute.goToLoginScreen(context: context);
        }
      },
      child: BlocBuilder<AuthCubit, AuthState>(
        builder: (context, authState) {
          if (authState is! Authenticated) {
            return const Center(child: AppLoadingIndicator());
          }

          return Scaffold(
            appBar: AppBar(title: Text(LocaleKeys.navMore.tr())),
            body: SafeArea(
              child: ListView(
                padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                children: <Widget>[
                  MoreProfileHeader(user: authState.profile.user),
                  const SizedBox(height: AppSpacing.lg),

                  MoreSection(
                    title: LocaleKeys.moreManagementSection.tr(),
                    children: <Widget>[
                      if (permissionService.hasAny(P.anyReport))
                        MoreTile(
                          identifier: 'more_reports_tile',
                          icon: Icons.bar_chart_rounded,
                          label: LocaleKeys.reports.tr(),
                          onTap: () =>
                              AppRoute.goToReportsHub(context: context),
                        ),
                      if (permissionService.has(P.violationsRead))
                        MoreTile(
                          identifier: 'more_violations_tile',
                          icon: Icons.gavel_rounded,
                          label: LocaleKeys.violationsTitle.tr(),
                          // A representative who can only read his own record
                          // still lands on the same screen: the server scopes
                          // it, so there is nothing for the app to pre-filter.
                          onTap: () =>
                              AppRoute.goToViolationsList(context: context),
                        ),
                      if (permissionService.has(P.maintenanceRead))
                        MoreTile(
                          identifier: 'more_maintenance_tile',
                          icon: Icons.build_circle_outlined,
                          label: LocaleKeys.maintenanceListTitle.tr(),
                          onTap: () =>
                              AppRoute.goToMaintenanceList(context: context),
                        ),
                      if (permissionService.has(P.usersRead))
                        MoreTile(
                          identifier: 'more_users_tile',
                          icon: Icons.people_alt_outlined,
                          label: LocaleKeys.usersAndRoles.tr(),
                          onTap: () => AppRoute.goToUsersList(context: context),
                        ),
                      MoreTile(
                        identifier: 'more_notifications_tile',
                        icon: Icons.notifications_none_rounded,
                        label: LocaleKeys.notifications.tr(),
                        onTap: () => _openNotReady(
                          context,
                          titleKey: LocaleKeys.notifications,
                          icon: Icons.notifications_none_rounded,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  MoreSection(
                    title: LocaleKeys.moreAppSection.tr(),
                    children: <Widget>[
                      MoreTile(
                        identifier: 'more_sync_queue_tile',
                        icon: Icons.sync_rounded,
                        label: LocaleKeys.syncQueue.tr(),
                        onTap: () => AppRoute.goToSyncQueue(context: context),
                      ),
                      MoreTile(
                        identifier: 'more_language_tile',
                        icon: Icons.language_rounded,
                        label: LocaleKeys.appLanguage.tr(),
                        trailingLabel: context.locale.languageCode == 'ar'
                            ? LocaleKeys.arabicLanguage.tr()
                            : LocaleKeys.englishLanguage.tr(),
                        onTap: () => LanguageBottomSheet.show(context),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  MoreSection(
                    title: LocaleKeys.moreAccountSection.tr(),
                    children: <Widget>[
                      MoreTile(
                        identifier: 'more_change_password_tile',
                        icon: Icons.lock_outline_rounded,
                        label: LocaleKeys.changePassword.tr(),
                        onTap: () => AppRoute.goToChangePasswordScreen(
                          context: context,
                          isForced: false,
                        ),
                      ),
                      MoreTile(
                        identifier: 'more_logout_tile',
                        icon: Icons.logout_rounded,
                        label: LocaleKeys.logout.tr(),
                        isDestructive: true,
                        onTap: () => _onLogoutPressed(context),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
