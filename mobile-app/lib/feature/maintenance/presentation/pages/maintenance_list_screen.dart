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
import 'package:machinery/feature/maintenance/data/logic/maintenance_list/maintenance_list_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_list/maintenance_list_state.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';
import 'package:machinery/feature/maintenance/presentation/widgets/maintenance_card.dart';
import 'package:machinery/feature/maintenance/presentation/widgets/maintenance_filter_sheet.dart';

/// Every repair order (`11.1`). [scope] is how a caller narrows it before it
/// ever loads — one machine's own orders, opened from its history screen.
class MaintenanceListScreen extends StatefulWidget {
  const MaintenanceListScreen({super.key, this.scope});

  final MaintenanceOrdersQueryParams? scope;

  @override
  State<MaintenanceListScreen> createState() => _MaintenanceListScreenState();
}

class _MaintenanceListScreenState extends State<MaintenanceListScreen> {
  @override
  void initState() {
    super.initState();
    context.read<MaintenanceListCubit>().load(params: widget.scope);
  }

  Future<void> _openFilters(MaintenanceListLoaded state) async {
    final MaintenanceOrdersQueryParams? result =
        await MaintenanceFilterSheet.show(
          context: context,
          locations: state.locations,
          current: state.query,
        );

    if (result == null || !mounted) return;

    await context.read<MaintenanceListCubit>().applyFilters(result);
  }

  Future<void> _openDetail(MaintenanceOrderEntity order) async {
    final MaintenanceOrderEntity? updated = await AppRoute.goToMaintenanceDetail(
      context: context,
      orderId: order.id,
      initial: order,
    );

    if (updated != null && mounted) {
      context.read<MaintenanceListCubit>().replaceOrder(updated);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(LocaleKeys.maintenanceListTitle.tr()),
        actions: <Widget>[
          BlocBuilder<MaintenanceListCubit, MaintenanceListState>(
            builder: (BuildContext context, MaintenanceListState state) {
              if (state is! MaintenanceListLoaded) {
                return const SizedBox.shrink();
              }

              return IconButton(
                onPressed: () => _openFilters(state),
                icon: Semantics(
                  identifier: 'maintenance_filter_button',
                  child: Badge(
                    isLabelVisible: state.query.hasFilters,
                    label: Text(state.query.activeFilterCount.toString()),
                    child: const Icon(Icons.filter_list_rounded),
                  ),
                ),
                tooltip: LocaleKeys.maintenanceFilterTitle.tr(),
              );
            },
          ),
        ],
      ),
      body: BlocBuilder<MaintenanceListCubit, MaintenanceListState>(
        builder: (BuildContext context, MaintenanceListState state) {
          return switch (state) {
            MaintenanceListFailure(
              :final String errorMessage,
              :final bool isOffline,
            ) =>
              AppErrorView(
                message: isOffline
                    ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                    : errorMessage,
                onRetry: () =>
                    context.read<MaintenanceListCubit>().load(
                      params: widget.scope,
                    ),
              ),
            MaintenanceListLoaded() => _buildList(context, state),
            _ => const AppLoadingIndicator(),
          };
        },
      ),
    );
  }

  Widget _buildList(BuildContext context, MaintenanceListLoaded state) {
    final MaintenanceListCubit cubit = context.read<MaintenanceListCubit>();

    return PaginatedListView<MaintenanceOrderEntity>(
      items: state.orders,
      hasNext: state.hasNext,
      isLoadingMore: state.isLoadingMore,
      onRefresh: () => cubit.load(showLoader: false),
      onLoadMore: cubit.loadMore,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      emptyState: AppEmptyState(
        icon: Icons.build_circle_outlined,
        title: state.query.hasFilters
            ? LocaleKeys.maintenanceNoSearchResults.tr()
            : LocaleKeys.maintenanceEmptyTitle.tr(),
        subtitle: state.query.hasFilters
            ? ''
            : LocaleKeys.maintenanceEmptySubtitle.tr(),
      ),
      itemBuilder: (BuildContext context, MaintenanceOrderEntity order, int _) {
        return MaintenanceCard(order: order, onTap: () => _openDetail(order));
      },
    );
  }
}
