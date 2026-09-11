import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/paginated_list_view.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/maintenance/data/logic/decommission_candidates/decommission_candidates_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/decommission_candidates/decommission_candidates_state.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/presentation/widgets/decommission_candidate_card.dart';
import 'package:machinery/feature/maintenance/presentation/widgets/decommission_thresholds_sheet.dart';

class DecommissionCandidatesScreen extends StatefulWidget {
  const DecommissionCandidatesScreen({super.key});
  @override
  State<DecommissionCandidatesScreen> createState() =>
      _DecommissionCandidatesScreenState();
}

class _DecommissionCandidatesScreenState
    extends State<DecommissionCandidatesScreen> {
  @override
  void initState() {
    super.initState();
    context.read<DecommissionCandidatesCubit>().load();
  }

  Future<void> _filters(DecommissionCandidatesLoaded state) async {
    final result = await DecommissionThresholdsSheet.show(
      context: context,
      current: state.query,
    );
    if (result != null && mounted) {
      await context.read<DecommissionCandidatesCubit>().load(
        query: result,
        showLoader: false,
      );
    }
  }

  Future<void> _detail(DecommissionCandidateEntity candidate) async {
    final changed = await AppRoute.goToMachineDetail(
      context: context,
      machineId: candidate.id,
    );
    if ((changed ?? false) && mounted) {
      await context.read<DecommissionCandidatesCubit>().load(showLoader: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(LocaleKeys.decommissionCandidatesTitle.tr()),
        actions: [
          BlocBuilder<DecommissionCandidatesCubit, DecommissionCandidatesState>(
            builder: (context, state) => state is DecommissionCandidatesLoaded
                ? IconButton(
                    onPressed: () => _filters(state),
                    tooltip: LocaleKeys.decommissionThresholdsTitle.tr(),
                    icon: Badge(
                      isLabelVisible: state.query.hasFilters,
                      child: const Icon(Icons.tune_rounded),
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
      body:
          BlocBuilder<DecommissionCandidatesCubit, DecommissionCandidatesState>(
            builder: (context, state) => switch (state) {
              DecommissionCandidatesFailure(
                :final errorMessage,
                :final isOffline,
              ) =>
                AppErrorView(
                  message: isOffline
                      ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                      : errorMessage,
                  onRetry: () =>
                      context.read<DecommissionCandidatesCubit>().load(),
                ),
              DecommissionCandidatesLoaded() => _list(context, state),
              _ => const AppLoadingIndicator(),
            },
          ),
    );
  }

  Widget _list(BuildContext context, DecommissionCandidatesLoaded state) {
    final cubit = context.read<DecommissionCandidatesCubit>();
    return PaginatedListView<DecommissionCandidateEntity>(
      items: state.sortedCandidates,
      hasNext: state.hasNext,
      isLoadingMore: state.isLoadingMore,
      onRefresh: () => cubit.load(showLoader: false),
      onLoadMore: cubit.loadMore,
      separator: const SizedBox(height: AppSpacing.md),
      header: _Header(state: state, onSort: cubit.setSort),
      emptyState: AppEmptyState(
        icon: Icons.fact_check_outlined,
        title: LocaleKeys.decommissionCandidatesEmpty.tr(),
        subtitle: LocaleKeys.decommissionCandidatesSuggestion.tr(),
      ),
      itemBuilder: (_, candidate, _) => DecommissionCandidateCard(
        candidate: candidate,
        onTap: () => _detail(candidate),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.state, required this.onSort});
  final DecommissionCandidatesLoaded state;
  final ValueChanged<DecommissionCandidateSort> onSort;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(LocaleKeys.decommissionCandidatesSuggestion.tr()),
          const SizedBox(height: AppSpacing.sm),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SegmentedButton<DecommissionCandidateSort>(
              segments: [
                ButtonSegment(
                  value: DecommissionCandidateSort.costRatio,
                  label: Text(LocaleKeys.decommissionSortRatio.tr()),
                ),
                ButtonSegment(
                  value: DecommissionCandidateSort.repairCount,
                  label: Text(LocaleKeys.decommissionSortRepairs.tr()),
                ),
                ButtonSegment(
                  value: DecommissionCandidateSort.age,
                  label: Text(LocaleKeys.decommissionSortAge.tr()),
                ),
              ],
              selected: {state.sort},
              onSelectionChanged: (value) => onSort(value.first),
            ),
          ),
        ],
      ),
    );
  }
}
