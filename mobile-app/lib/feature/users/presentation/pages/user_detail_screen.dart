import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/permission_gate.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/users/data/logic/user_detail/user_detail_cubit.dart';
import 'package:machinery/feature/users/presentation/widgets/user_detail_sections.dart';
import 'package:machinery/feature/users/presentation/widgets/user_form_actions.dart';

class UserDetailScreen extends StatefulWidget {
  const UserDetailScreen({super.key});
  @override
  State<UserDetailScreen> createState() => _UserDetailScreenState();
}

class _UserDetailScreenState extends State<UserDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<UserDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: Text(LocaleKeys.userDetailTitle.tr()),
          actions: <Widget>[
            BlocBuilder<UserDetailCubit, UserDetailState>(
              builder: (context, state) => state is UserDetailLoaded
                  ? PermissionGate(
                      permission: P.usersUpdate,
                      child: IconButton(
                        tooltip: LocaleKeys.userEdit.tr(),
                        icon: const Icon(Icons.edit_outlined),
                        onPressed: () async {
                          final changed = await AppRoute.goToUserForm(
                            context: context,
                            existing: state.user,
                          );
                          if ((changed ?? false) && context.mounted) {
                            context.read<UserDetailCubit>().load();
                          }
                        },
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
        body: BlocBuilder<UserDetailCubit, UserDetailState>(
          builder: (context, state) => switch (state) {
            UserDetailFailure(:final message, :final isOffline) => AppErrorView(
                message: isOffline
                    ? LocaleKeys.usersOnlineOnlySubtitle.tr()
                    : message,
                onRetry: context.read<UserDetailCubit>().load,
              ),
            UserDetailLoaded() => RefreshIndicator(
                onRefresh: context.read<UserDetailCubit>().load,
                child: ListView(
                  padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                  children: <Widget>[
                    UserDetailHeader(user: state.user),
                    if (state.custody != null)
                      UserCustodySection(custody: state.custody!),
                    if (state.violations != null)
                      UserViolationsSection(summary: state.violations!),
                    UserActivitySection(activity: state.activity),
                    const SizedBox(height: AppSpacing.sm),
                    UserFormActions(user: state.user),
                  ],
                ),
              ),
            _ => const AppLoadingIndicator(),
          },
        ),
      );
}
