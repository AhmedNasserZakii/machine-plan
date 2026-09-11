import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/custom_search_bar.dart';
import 'package:machinery/core/shared_widgets/paginated_list_view.dart';
import 'package:machinery/core/shared_widgets/permission_gate.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/users/data/logic/users_list/users_list_cubit.dart';
import 'package:machinery/feature/users/data/logic/users_list/users_list_state.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/presentation/widgets/user_card.dart';
import 'package:machinery/feature/users/presentation/widgets/users_filter_sheet.dart';

/// The account register. Search, filter and open an account; creating one is
/// gated separately from reading, so a supervisor with `users.read` sees the
/// list without an add button.
class UsersListScreen extends StatefulWidget {
  const UsersListScreen({super.key});

  @override
  State<UsersListScreen> createState() => _UsersListScreenState();
}

class _UsersListScreenState extends State<UsersListScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<UsersListCubit>().load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _openFilters(UsersListLoaded state) async {
    final UsersFilterResult? result = await UsersFilterSheet.show(
      context: context,
      roles: state.roles,
      branches: state.branches,
      current: state.query,
    );

    if (result == null || !mounted) {
      return;
    }

    await context.read<UsersListCubit>().applyFilters(
      roleId: result.roleId,
      branchId: result.branchId,
      isActive: result.isActive,
      clearRole: result.roleId == null,
      clearBranch: result.branchId == null,
      clearActive: result.isActive == null,
    );
  }

  Future<void> _openForm({UserEntity? existing}) async {
    final bool? changed = await AppRoute.goToUserForm(
      context: context,
      existing: existing,
    );

    if ((changed ?? false) && mounted) {
      await context.read<UsersListCubit>().load(showLoader: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(LocaleKeys.usersTitle.tr()),
        actions: <Widget>[
          PermissionGate(
            permission: P.rolesManage,
            child: IconButton(
              tooltip: LocaleKeys.rolesTitle.tr(),
              icon: const Icon(Icons.shield_outlined),
              onPressed: () => AppRoute.goToRolesList(context: context),
            ),
          ),
        ],
      ),
      floatingActionButton: PermissionGate(
        permission: P.usersCreate,
        child: FloatingActionButton(
          heroTag: 'users_add_fab',
          onPressed: _openForm,
          child: Semantics(
            identifier: 'users_add_button',
            child: const Icon(Icons.person_add_alt_1_rounded),
          ),
        ),
      ),
      body: BlocBuilder<UsersListCubit, UsersListState>(
        builder: (BuildContext context, UsersListState state) {
          return switch (state) {
            UsersListFailure(
              :final String errorMessage,
              :final bool isOffline,
            ) =>
              AppErrorView(
                message: isOffline
                    ? LocaleKeys.usersOnlineOnlySubtitle.tr()
                    : errorMessage,
                onRetry: () => context.read<UsersListCubit>().load(),
              ),
            UsersListLoaded() => _buildList(context, state),
            _ => const AppLoadingIndicator(),
          };
        },
      ),
    );
  }

  /// True when the list is empty because of a search or a filter rather than
  /// because there are no accounts at all.
  bool _isNarrowed(UsersListLoaded state) =>
      state.query.search != null || state.query.hasFilters;

  Widget _buildList(BuildContext context, UsersListLoaded state) {
    final UsersListCubit cubit = context.read<UsersListCubit>();

    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          child: CustomSearchBar(
            controller: _searchController,
            identifier: 'users_search_field',
            hintText: LocaleKeys.usersSearchHint.tr(),
            hasActiveFilters: state.query.hasFilters,
            onChanged: cubit.search,
            onFilterPressed: () => _openFilters(state),
          ),
        ),
        Expanded(
          child: PaginatedListView<UserEntity>(
            items: state.users,
            hasNext: state.hasNext,
            isLoadingMore: state.isLoadingMore,
            onRefresh: () => cubit.load(showLoader: false),
            onLoadMore: cubit.loadMore,
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              0,
              AppSpacing.md,
              AppSpacing.xxl,
            ),
            emptyState: AppEmptyState(
              icon: Icons.people_outline_rounded,
              // "Nothing matched" and "there is nothing yet" are different
              // problems, and only one of them is the user's to fix.
              title: _isNarrowed(state)
                  ? LocaleKeys.usersNoSearchResults.tr()
                  : LocaleKeys.usersEmptyTitle.tr(),
              subtitle: _isNarrowed(state)
                  ? ''
                  : LocaleKeys.usersEmptySubtitle.tr(),
            ),
            itemBuilder: (BuildContext context, UserEntity user, int index) {
              return UserCard(
                user: user,
                onTap: () async {
                  await AppRoute.goToUserDetail(
                    context: context,
                    userId: user.id,
                    initial: user,
                  );
                  if (mounted) {
                    await cubit.load(showLoader: false);
                  }
                },
              );
            },
          ),
        ),
      ],
    );
  }
}
