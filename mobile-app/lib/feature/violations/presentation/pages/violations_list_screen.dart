import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/paginated_list_view.dart';
import 'package:machinery/core/shared_widgets/permission_gate.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/violations/data/logic/violations_list/violations_list_cubit.dart';
import 'package:machinery/feature/violations/data/logic/violations_list/violations_list_state.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';
import 'package:machinery/feature/violations/domain/params/violations_query_params.dart';
import 'package:machinery/feature/violations/presentation/widgets/violation_card.dart';
import 'package:machinery/feature/violations/presentation/widgets/violations_filter_sheet.dart';

/// The register of everything that went wrong.
///
/// [scope] is how a caller narrows it before it ever loads — one machine's
/// history, or one representative's record.
class ViolationsListScreen extends StatefulWidget {
  const ViolationsListScreen({super.key, this.scope});

  final ViolationsQueryParams? scope;

  @override
  State<ViolationsListScreen> createState() => _ViolationsListScreenState();
}

class _ViolationsListScreenState extends State<ViolationsListScreen> {
  @override
  void initState() {
    super.initState();
    context.read<ViolationsListCubit>().load(params: widget.scope);
  }

  Future<void> _openFilters(ViolationsListLoaded state) async {
    final ViolationsQueryParams? result = await ViolationsFilterSheet.show(
      context: context,
      types: state.types,
      current: state.query,
    );

    if (result == null || !mounted) {
      return;
    }

    await context.read<ViolationsListCubit>().applyFilters(result);
  }

  Future<void> _openCreate() async {
    final ViolationEntity? created = await AppRoute.goToViolationCreate(
      context: context,
    );

    if (created != null && mounted) {
      await context.read<ViolationsListCubit>().load(showLoader: false);
    }
  }

  Future<void> _openDetail(ViolationEntity violation) async {
    final ViolationEntity? updated = await AppRoute.goToViolationDetail(
      context: context,
      violationId: violation.id,
      initial: violation,
    );

    if (updated != null && mounted) {
      context.read<ViolationsListCubit>().replaceViolation(updated);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(LocaleKeys.violationsTitle.tr()),
        actions: <Widget>[
          BlocBuilder<ViolationsListCubit, ViolationsListState>(
            builder: (BuildContext context, ViolationsListState state) {
              if (state is! ViolationsListLoaded) {
                return const SizedBox.shrink();
              }

              return IconButton(
                onPressed: () => _openFilters(state),
                icon: Semantics(
                  identifier: 'violations_filter_button',
                  child: Badge(
                    isLabelVisible: state.query.hasFilters,
                    label: Text(state.query.activeFilterCount.toString()),
                    child: const Icon(Icons.filter_list_rounded),
                  ),
                ),
                tooltip: LocaleKeys.violationsFilterTitle.tr(),
              );
            },
          ),
        ],
      ),
      body: BlocBuilder<ViolationsListCubit, ViolationsListState>(
        builder: (BuildContext context, ViolationsListState state) {
          return switch (state) {
            ViolationsListFailure(
              :final String errorMessage,
              :final bool isOffline,
            ) =>
              AppErrorView(
                message: isOffline
                    ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                    : errorMessage,
                onRetry: () => context.read<ViolationsListCubit>().load(
                  params: widget.scope,
                ),
              ),
            ViolationsListLoaded() => _buildList(context, state),
            _ => const AppLoadingIndicator(),
          };
        },
      ),
      floatingActionButton: PermissionGate(
        permission: P.violationsCreate,
        child: FloatingActionButton(
          heroTag: 'violations_create_fab',
          onPressed: _openCreate,
          child: const Icon(Icons.add_rounded),
        ),
      ),
    );
  }

  Widget _buildList(BuildContext context, ViolationsListLoaded state) {
    final ViolationsListCubit cubit = context.read<ViolationsListCubit>();

    return PaginatedListView<ViolationEntity>(
      items: state.violations,
      hasNext: state.hasNext,
      isLoadingMore: state.isLoadingMore,
      onRefresh: () => cubit.load(showLoader: false),
      onLoadMore: cubit.loadMore,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      emptyState: AppEmptyState(
        icon: Icons.verified_outlined,
        // An empty register is good news unless a filter made it empty, which
        // is the only one of the two the user can do anything about.
        title: state.query.hasFilters
            ? LocaleKeys.violationsNoSearchResults.tr()
            : LocaleKeys.violationsEmptyTitle.tr(),
        subtitle: state.query.hasFilters
            ? ''
            : LocaleKeys.violationsEmptySubtitle.tr(),
      ),
      itemBuilder:
          (BuildContext context, ViolationEntity violation, int index) {
            return ViolationCard(
              violation: violation,
              onTap: () => _openDetail(violation),
            );
          },
    );
  }
}
