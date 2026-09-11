import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/users/data/logic/roles/roles_cubit.dart';
import 'package:machinery/feature/users/domain/entities/role_entity.dart';
import 'package:machinery/feature/users/domain/params/role_write_params.dart';
import 'package:machinery/feature/users/presentation/widgets/role_form_dialog.dart';

class RolesListScreen extends StatefulWidget {
  const RolesListScreen({super.key});
  @override
  State<RolesListScreen> createState() => _RolesListScreenState();
}

class _RolesListScreenState extends State<RolesListScreen> {
  @override
  void initState() {
    super.initState();
    context.read<RolesCubit>().load();
  }

  Future<void> _edit(RoleEntity? role) async {
    final result = await RoleFormDialog.show(context, role: role);
    if (result == null || !mounted) return;
    final cubit = context.read<RolesCubit>();
    final ok = role == null
        ? await cubit.create(
            CreateRoleParams(
              code: result.code,
              translations: result.translations,
              permissions: const <String>[],
            ),
          )
        : await cubit.rename(role.id, result.translations);
    if (!ok && mounted && cubit.state is RolesReady) {
      showErrorToast((cubit.state as RolesReady).error ?? '', context);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(LocaleKeys.rolesTitle.tr())),
    floatingActionButton: FloatingActionButton(
      onPressed: () => _edit(null),
      child: const Icon(Icons.add),
    ),
    body: BlocBuilder<RolesCubit, RolesState>(
      builder: (context, state) => switch (state) {
        RolesFailure(:final message, :final isOffline) => AppErrorView(
          message: isOffline ? LocaleKeys.usersOnlineOnlySubtitle.tr() : message,
          onRetry: context.read<RolesCubit>().load,
        ),
        RolesReady() => RefreshIndicator(
          onRefresh: context.read<RolesCubit>().load,
          child: ListView.separated(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            itemCount: state.roles.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
            itemBuilder: (context, index) {
              final role = state.roles[index];
              return Card(
                child: ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.shield_outlined)),
                  title: Text(role.displayName),
                  subtitle: Text(
                    '${role.code} • ${LocaleKeys.rolePermissionCount.tr(args: <String>[role.permissions.length.toString()])}',
                  ),
                  onTap: () async {
                    await AppRoute.goToRolePermissions(
                      context: context,
                      role: role,
                    );
                    if (mounted) context.read<RolesCubit>().load();
                  },
                  trailing: IconButton(
                    tooltip: LocaleKeys.roleEdit.tr(),
                    onPressed: () => _edit(role),
                    icon: const Icon(Icons.edit_outlined),
                  ),
                ),
              );
            },
          ),
        ),
        _ => const AppLoadingIndicator(),
      },
    ),
  );
}
