import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/data/logic/machine_maintenance_history/machine_maintenance_history_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_maintenance_history/machine_maintenance_history_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_maintenance_history.dart';

/// Every repair a unit has had, with the server's own totals (`8.1`).
///
/// Read-only, deliberately: opening an order, closing one, or setting its cost
/// is section `11`'s write side. This screen exists so a supervisor or
/// director can see the repair bill without waiting for that feature to land.
class MachineMaintenanceHistoryScreen extends StatefulWidget {
  const MachineMaintenanceHistoryScreen({super.key});

  @override
  State<MachineMaintenanceHistoryScreen> createState() =>
      _MachineMaintenanceHistoryScreenState();
}

class _MachineMaintenanceHistoryScreenState
    extends State<MachineMaintenanceHistoryScreen> {
  @override
  void initState() {
    super.initState();
    context.read<MachineMaintenanceHistoryCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(LocaleKeys.machineMaintenanceHistoryTitle.tr()),
      ),
      body:
          BlocBuilder<
            MachineMaintenanceHistoryCubit,
            MachineMaintenanceHistoryState
          >(
            builder:
                (BuildContext context, MachineMaintenanceHistoryState state) {
                  return switch (state) {
                    MachineMaintenanceHistoryFailure(
                      :final String errorMessage,
                      :final bool isOffline,
                    ) =>
                      AppErrorView(
                        message: isOffline
                            ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                            : errorMessage,
                        onRetry: () => context
                            .read<MachineMaintenanceHistoryCubit>()
                            .load(),
                      ),
                    MachineMaintenanceHistoryLoaded(
                      :final MachineMaintenanceHistory history,
                    ) =>
                      _buildBody(context, history),
                    _ => const AppLoadingIndicator(),
                  };
                },
          ),
    );
  }

  Widget _buildBody(BuildContext context, MachineMaintenanceHistory history) {
    return RefreshIndicator(
      onRefresh: () => context.read<MachineMaintenanceHistoryCubit>().load(),
      child: ListView(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        children: <Widget>[
          _TotalsCard(totals: history.totals),
          const SizedBox(height: AppSpacing.md),
          if (history.orders.isEmpty)
            AppEmptyState(
              icon: Icons.build_circle_outlined,
              title: LocaleKeys.machineMaintenanceHistoryEmpty.tr(),
              subtitle: '',
            )
          else
            ...history.orders.map(
              (MaintenanceOrderSummary order) => _OrderTile(order: order),
            ),
        ],
      ),
    );
  }
}

class _TotalsCard extends StatelessWidget {
  const _TotalsCard({required this.totals});

  final MaintenanceHistoryTotals totals;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      title: LocaleKeys.machineMaintenanceHistoryTotals.tr(),
      icon: Icons.summarize_outlined,
      children: <Widget>[
        _TotalsRow(
          label: LocaleKeys.machineMaintenanceHistoryOrdersCount.tr(),
          value: '${totals.orders}',
        ),
        _TotalsRow(
          label: LocaleKeys.machineMaintenanceHistoryTotalCost.tr(),
          value: Formatters.currency(totals.totalCost),
        ),
        if (totals.freeUnderWarranty > 0)
          _TotalsRow(
            label: LocaleKeys.machineMaintenanceHistoryFreeUnderWarranty.tr(),
            value: '${totals.freeUnderWarranty}',
          ),
      ],
    );
  }
}

class _TotalsRow extends StatelessWidget {
  const _TotalsRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Text(
            label,
            style: Styles.s13(
              context,
            ).copyWith(color: AppColors.textSecondaryColor),
          ),
          LtrText(
            value,
            style: Styles.s13(context).copyWith(fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class _OrderTile extends StatelessWidget {
  const _OrderTile({required this.order});

  final MaintenanceOrderSummary order;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: LtrText(
                    order.referenceNo,
                    style: Styles.s13(
                      context,
                    ).copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                if (order.cost != null)
                  Text(
                    Formatters.currency(order.cost!),
                    style: Styles.s13(
                      context,
                    ).copyWith(fontWeight: FontWeight.w700),
                  )
                else if (order.isFreeUnderWarranty)
                  Text(
                    LocaleKeys.machineMaintenanceHistoryFreeUnderWarranty.tr(),
                    style: Styles.s12(
                      context,
                    ).copyWith(color: AppColors.successColor),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              order.locationName,
              style: Styles.s12(
                context,
              ).copyWith(color: AppColors.textSecondaryColor),
            ),
            const SizedBox(height: 4),
            Text(
              Formatters.dateTime(order.sentAt),
              style: Styles.s12(
                context,
              ).copyWith(color: AppColors.textSecondaryColor),
            ),
          ],
        ),
      ),
    );
  }
}
