import 'package:machinery/core/shared_widgets/app_symbol_3d.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/custom_search_bar.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/users/data/logic/branches_list/branches_list_cubit.dart';
import 'package:machinery/feature/users/data/logic/branches_list/branches_list_state.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';
import 'package:machinery/feature/users/presentation/widgets/branch_card.dart';

/// Admin list of branches, inactive ones included. The whole screen sits
/// behind `branches.manage`, so the add button needs no gate of its own.
class BranchesListScreen extends StatefulWidget {
  const BranchesListScreen({super.key});

  @override
  State<BranchesListScreen> createState() => _BranchesListScreenState();
}

class _BranchesListScreenState extends State<BranchesListScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<BranchesListCubit>().load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _openForm({BranchEntity? existing}) async {
    final bool? changed = await AppRoute.goToBranchForm(
      context: context,
      existing: existing,
    );

    if ((changed ?? false) && mounted) {
      await context.read<BranchesListCubit>().load(showLoader: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(LocaleKeys.branchesTitle.tr()),
      ),
      floatingActionButton: FloatingActionButton(
        heroTag: 'branches_add_fab',
        onPressed: _openForm,
        child: Semantics(
          identifier: 'branches_add_button',
          child: const AppSymbol3d(Icons.add_rounded),
        ),
      ),
      body: BlocBuilder<BranchesListCubit, BranchesListState>(
        builder: (BuildContext context, BranchesListState state) {
          return switch (state) {
            BranchesListFailure(
              :final String errorMessage,
              :final bool isOffline,
            ) =>
              AppErrorView(
                message: isOffline
                    ? LocaleKeys.branchesOnlineOnlySubtitle.tr()
                    : errorMessage,
                onRetry: () => context.read<BranchesListCubit>().load(),
              ),
            BranchesListLoaded() => _buildList(context, state),
            _ => const Center(child: AppLoadingIndicator()),
          };
        },
      ),
    );
  }

  Widget _buildList(BuildContext context, BranchesListLoaded state) {
    final List<BranchEntity> visible = state.visible;

    return RefreshIndicator(
      onRefresh: () =>
          context.read<BranchesListCubit>().load(showLoader: false),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: <Widget>[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: CustomSearchBar(
                controller: _searchController,
                hintText: LocaleKeys.branchesSearchHint.tr(),
                identifier: 'branches_search',
                onChanged: context.read<BranchesListCubit>().search,
              ),
            ),
          ),
          if (visible.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: AppEmptyState(
                title: state.search.trim().isEmpty
                    ? LocaleKeys.branchesEmptyTitle.tr()
                    : LocaleKeys.branchesNoSearchResults.tr(),
                subtitle: state.search.trim().isEmpty
                    ? LocaleKeys.branchesEmptySubtitle.tr()
                    : LocaleKeys.branchesNoSearchResults.tr(),
                icon: Icons.store_mall_directory_outlined,
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                0,
                AppSpacing.md,
                AppSpacing.xxl,
              ),
              sliver: SliverList.separated(
                itemCount: visible.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(height: AppSpacing.sm),
                itemBuilder: (BuildContext context, int index) {
                  final BranchEntity branch = visible[index];
                  return BranchCard(
                    branch: branch,
                    onTap: () => _openForm(existing: branch),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
