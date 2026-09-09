import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/app_confirm_dialog.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/custom_search_bar.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/users/data/logic/user_permissions/user_permissions_cubit.dart';
import 'package:machinery/feature/users/data/logic/user_permissions/user_permissions_state.dart';
import 'package:machinery/feature/users/domain/entities/permission_catalogue_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/presentation/widgets/permission_changes_dialog.dart';
import 'package:machinery/feature/users/presentation/widgets/permission_group_tile.dart';
import 'package:machinery/feature/users/presentation/widgets/user_permissions_header.dart';

/// Grants and revokes single permissions for one user, on top of their role.
class UserPermissionsScreen extends StatefulWidget {
  const UserPermissionsScreen({required this.user, super.key});

  final UserEntity user;

  @override
  State<UserPermissionsScreen> createState() => _UserPermissionsScreenState();
}

class _UserPermissionsScreenState extends State<UserPermissionsScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<UserPermissionsCubit>().load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  /// Leaving with unsaved edits asks first — the edits are invisible once the
  /// screen is gone, so a silent discard looks like the save worked.
  Future<bool> _confirmLeave(UserPermissionsState state) async {
    if (state is! UserPermissionsReady || !state.hasChanges) {
      return true;
    }

    return AppConfirmDialog.show(
      context: context,
      title: LocaleKeys.userPermissionsDiscard.tr(),
      description: LocaleKeys.userPermissionsDiscardMessage.tr(),
      confirmLabel: LocaleKeys.userPermissionsDiscard.tr(),
      isDestructive: true,
      confirmIdentifier: 'permissions_discard_confirm',
      cancelIdentifier: 'permissions_discard_cancel',
    );
  }

  Future<void> _save(UserPermissionsReady state) async {
    final bool confirmed = await PermissionChangesDialog.show(
      context: context,
      changes: state.draft.changes,
      groups: state.groups,
    );

    if (confirmed && mounted) {
      await context.read<UserPermissionsCubit>().save();
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<UserPermissionsCubit, UserPermissionsState>(
      listener: (BuildContext context, UserPermissionsState state) {
        if (state is UserPermissionsSaveFailure) {
          showErrorToast(state.errorMessage, context);
        }
        if (state is UserPermissionsSaved) {
          showSuccessToast(LocaleKeys.userPermissionsSaved.tr(), context);
        }
      },
      builder: (BuildContext context, UserPermissionsState state) {
        return PopScope(
          canPop: state is! UserPermissionsReady || !state.hasChanges,
          onPopInvokedWithResult: (bool didPop, Object? result) async {
            if (didPop) {
              return;
            }
            if (await _confirmLeave(state) && context.mounted) {
              Navigator.of(context).pop();
            }
          },
          child: Scaffold(
            appBar: AppBar(
              leading: const ArrowBackWidget(),
              title: Text(LocaleKeys.userPermissionsTitle.tr()),
            ),
            body: switch (state) {
              UserPermissionsLoadFailure(
                :final String errorMessage,
                :final bool isOffline,
              ) =>
                AppErrorView(
                  message: isOffline
                      ? LocaleKeys.usersOnlineOnlySubtitle.tr()
                      : errorMessage,
                  onRetry: () => context.read<UserPermissionsCubit>().load(),
                ),
              UserPermissionsReady() => _buildBody(context, state),
              _ => const AppLoadingIndicator(),
            },
          ),
        );
      },
    );
  }

  Widget _buildBody(BuildContext context, UserPermissionsReady state) {
    final UserPermissionsCubit cubit = context.read<UserPermissionsCubit>();
    final List<PermissionGroupEntity> groups = state.visibleGroups;

    return SafeArea(
      child: Column(
        children: <Widget>[
          UserPermissionsHeader(user: widget.user),
          Padding(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            child: CustomSearchBar(
              controller: _searchController,
              identifier: 'user_permissions_search_field',
              hintText: LocaleKeys.userPermissionsSearchHint.tr(),
              onChanged: cubit.search,
            ),
          ),
          Expanded(
            child: groups.isEmpty
                ? AppEmptyState(
                    icon: Icons.search_off_rounded,
                    title: LocaleKeys.userPermissionsEmptySearch.tr(),
                    subtitle: '',
                  )
                : ListView.separated(
                    padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                    itemCount: groups.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: AppSpacing.sm),
                    itemBuilder: (BuildContext context, int index) {
                      final PermissionGroupEntity group = groups[index];

                      return PermissionGroupTile(
                        group: group,
                        draft: state.draft,
                        enabled: !state.isSaving,
                        isExpanded: state.isExpanded(group.group),
                        onToggleGroup: () => cubit.toggleGroup(group.group),
                        onTogglePermission: cubit.toggle,
                      );
                    },
                  ),
          ),
          if (state.hasChanges)
            Padding(
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              child: CustomButton(
                title: LocaleKeys.save.tr(),
                isLoading: state.isSaving,
                identifier: 'permissions_save_button',
                onPressed: () => _save(state),
              ),
            ),
        ],
      ),
    );
  }
}
