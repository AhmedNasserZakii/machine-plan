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
import 'package:machinery/feature/users/data/logic/users_list/users_list_cubit.dart';
import 'package:machinery/feature/users/data/logic/users_list/users_list_state.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/domain/params/users_query_params.dart';

/// Who a hand-raised violation is against — a single-select search over the
/// same `GET /users` register the admin user list already reads, held to no
/// role: the plan does not restrict manual entry to representatives the way
/// the auto-detector does.
class ViolationUserPickerSheet extends StatefulWidget {
  const ViolationUserPickerSheet({super.key});

  static Future<UserEntity?> show({required BuildContext context}) {
    return showModalBottomSheet<UserEntity>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => const ViolationUserPickerSheet(),
    );
  }

  @override
  State<ViolationUserPickerSheet> createState() =>
      _ViolationUserPickerSheetState();
}

class _ViolationUserPickerSheetState extends State<ViolationUserPickerSheet> {
  final TextEditingController _searchController = TextEditingController();
  late final UsersListCubit _cubit;

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

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: FractionallySizedBox(
        heightFactor: 0.85,
        child: BlocProvider<UsersListCubit>.value(
          value: _cubit,
          child: Column(
            children: <Widget>[
              _PickerHeader(title: LocaleKeys.violationSelectUser.tr()),
              Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.md,
                ),
                child: CustomSearchBar(
                  controller: _searchController,
                  identifier: 'violation_user_picker_search',
                  hintText: LocaleKeys.usersSearchHint.tr(),
                  onChanged: _cubit.search,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Expanded(
                child: BlocBuilder<UsersListCubit, UsersListState>(
                  bloc: _cubit,
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
                              identifier:
                                  'violation_user_picker_row_${user.id}',
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
                                  style: Styles.s12(context).copyWith(
                                    color: AppColors.textSecondaryColor,
                                  ),
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
