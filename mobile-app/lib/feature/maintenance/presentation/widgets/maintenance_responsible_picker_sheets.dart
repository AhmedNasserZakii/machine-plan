import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/custom_search_bar.dart';
import 'package:machinery/core/shared_widgets/paginated_list_view.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/merchants/data/logic/merchants_list/merchants_list_cubit.dart';
import 'package:machinery/feature/merchants/data/logic/merchants_list/merchants_list_state.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/users/data/logic/users_list/users_list_cubit.dart';
import 'package:machinery/feature/users/data/logic/users_list/users_list_state.dart';
import 'package:machinery/feature/users/domain/entities/role_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/domain/params/users_query_params.dart';

/// Who the close screen (`11.2`) hands the bill to when `responsibleParty` is
/// `REPRESENTATIVE` — a single-select search over the same `GET /users`
/// register the admin user list already reads, held to the `REPRESENTATIVE`
/// role rather than offered against the whole company.
class ResponsibleUserPickerSheet extends StatefulWidget {
  const ResponsibleUserPickerSheet({super.key});

  /// Returns the picked user, or `null` if the caller backed out.
  static Future<UserEntity?> show({required BuildContext context}) {
    return showModalBottomSheet<UserEntity>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => const ResponsibleUserPickerSheet(),
    );
  }

  @override
  State<ResponsibleUserPickerSheet> createState() =>
      _ResponsibleUserPickerSheetState();
}

class _ResponsibleUserPickerSheetState
    extends State<ResponsibleUserPickerSheet> {
  static const String _representativeRoleCode = 'REPRESENTATIVE';

  final TextEditingController _searchController = TextEditingController();
  late final UsersListCubit _cubit;
  bool _roleFilterApplied = false;

  @override
  void initState() {
    super.initState();
    _cubit = getIt<UsersListCubit>();
    _cubit.load(params: const UsersQueryParams(isActive: true));
  }

  @override
  void dispose() {
    _searchController.dispose();
    _cubit.close();
    super.dispose();
  }

  /// The role list only comes back once the first page has loaded — narrows
  /// to `REPRESENTATIVE` the moment it is known, rather than making the
  /// picker ask the caller to resolve the role id up front.
  void _applyRoleFilterOnce(UsersListState state) {
    if (_roleFilterApplied || state is! UsersListLoaded) return;

    final RoleEntity? role = state.roles.cast<RoleEntity?>().firstWhere(
      (RoleEntity? role) => role?.code == _representativeRoleCode,
      orElse: () => null,
    );

    if (role == null) return;

    _roleFilterApplied = true;
    _cubit.applyFilters(roleId: role.id);
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: FractionallySizedBox(
        heightFactor: 0.85,
        child: BlocProvider<UsersListCubit>.value(
          value: _cubit,
          child: Column(
            children: <Widget>[
              _PickerHeader(title: LocaleKeys.maintenanceCloseResponsibleUser.tr()),
              Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.md,
                ),
                child: CustomSearchBar(
                  controller: _searchController,
                  identifier: 'responsible_user_picker_search',
                  hintText: LocaleKeys.usersSearchHint.tr(),
                  onChanged: _cubit.search,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Expanded(
                child: BlocConsumer<UsersListCubit, UsersListState>(
                  bloc: _cubit,
                  listener: (BuildContext context, UsersListState state) =>
                      _applyRoleFilterOnce(state),
                  builder: (BuildContext context, UsersListState state) {
                    if (state is! UsersListLoaded) {
                      return const AppLoadingIndicator();
                    }

                    return PaginatedListView<UserEntity>(
                      items: state.users,
                      hasNext: state.hasNext,
                      isLoadingMore: state.isLoadingMore,
                      onRefresh: () => _cubit.load(showLoader: false),
                      onLoadMore: _cubit.loadMore,
                      padding: const EdgeInsetsDirectional.fromSTEB(
                        AppSpacing.md,
                        0,
                        AppSpacing.md,
                        AppSpacing.md,
                      ),
                      emptyState: AppEmptyState(
                        icon: Icons.person_search_outlined,
                        title: LocaleKeys.usersEmptyTitle.tr(),
                        subtitle: LocaleKeys.usersEmptySubtitle.tr(),
                      ),
                      itemBuilder:
                          (BuildContext context, UserEntity user, int _) {
                            return Semantics(
                              identifier: 'responsible_user_picker_row_${user.id}',
                              child: ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: const Icon(Icons.person_outline),
                                title: Text(
                                  user.fullName,
                                  style: Styles.s14(
                                    context,
                                  ).copyWith(fontWeight: FontWeight.w600),
                                ),
                                subtitle: Text(
                                  user.branchName ?? user.phone,
                                  style: Styles.s12(
                                    context,
                                  ).copyWith(color: AppColors.textSecondaryColor),
                                ),
                                onTap: () => Navigator.of(context).pop(user),
                              ),
                            );
                          },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Same shape for `responsibleParty == MERCHANT` — a single-select search
/// over `GET /merchants`.
class ResponsibleMerchantPickerSheet extends StatefulWidget {
  const ResponsibleMerchantPickerSheet({super.key});

  static Future<MerchantEntity?> show({required BuildContext context}) {
    return showModalBottomSheet<MerchantEntity>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => const ResponsibleMerchantPickerSheet(),
    );
  }

  @override
  State<ResponsibleMerchantPickerSheet> createState() =>
      _ResponsibleMerchantPickerSheetState();
}

class _ResponsibleMerchantPickerSheetState
    extends State<ResponsibleMerchantPickerSheet> {
  final TextEditingController _searchController = TextEditingController();
  late final MerchantsListCubit _cubit;

  @override
  void initState() {
    super.initState();
    _cubit = getIt<MerchantsListCubit>();
    _cubit.load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _cubit.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: FractionallySizedBox(
        heightFactor: 0.85,
        child: BlocProvider<MerchantsListCubit>.value(
          value: _cubit,
          child: Column(
            children: <Widget>[
              _PickerHeader(
                title: LocaleKeys.maintenanceCloseResponsibleMerchant.tr(),
              ),
              Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.md,
                ),
                child: CustomSearchBar(
                  controller: _searchController,
                  identifier: 'responsible_merchant_picker_search',
                  hintText: LocaleKeys.merchantsSearchHint.tr(),
                  onChanged: _cubit.search,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Expanded(
                child: BlocBuilder<MerchantsListCubit, MerchantsListState>(
                  bloc: _cubit,
                  builder: (BuildContext context, MerchantsListState state) {
                    if (state is! MerchantsListLoaded) {
                      return const AppLoadingIndicator();
                    }

                    return PaginatedListView<MerchantEntity>(
                      items: state.merchants,
                      hasNext: state.hasNext,
                      isLoadingMore: state.isLoadingMore,
                      onRefresh: () => _cubit.load(showLoader: false),
                      onLoadMore: _cubit.loadMore,
                      padding: const EdgeInsetsDirectional.fromSTEB(
                        AppSpacing.md,
                        0,
                        AppSpacing.md,
                        AppSpacing.md,
                      ),
                      emptyState: AppEmptyState(
                        icon: Icons.storefront_outlined,
                        title: LocaleKeys.merchantsEmptyTitle.tr(),
                        subtitle: LocaleKeys.merchantsEmptySubtitle.tr(),
                      ),
                      itemBuilder:
                          (BuildContext context, MerchantEntity merchant, int _) {
                            return Semantics(
                              identifier:
                                  'responsible_merchant_picker_row_${merchant.id}',
                              child: ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: const Icon(Icons.storefront_outlined),
                                title: Text(
                                  merchant.shopName,
                                  style: Styles.s14(
                                    context,
                                  ).copyWith(fontWeight: FontWeight.w600),
                                ),
                                subtitle: Text(
                                  merchant.name,
                                  style: Styles.s12(
                                    context,
                                  ).copyWith(color: AppColors.textSecondaryColor),
                                ),
                                onTap: () => Navigator.of(context).pop(merchant),
                              ),
                            );
                          },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PickerHeader extends StatelessWidget {
  const _PickerHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      child: Row(
        children: <Widget>[
          Expanded(child: Text(title, style: Styles.s17(context))),
          IconButton(
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.close_rounded),
          ),
        ],
      ),
    );
  }
}
