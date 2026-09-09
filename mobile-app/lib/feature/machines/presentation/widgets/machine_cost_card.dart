import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';

/// What this unit has cost in repairs, against what it cost to buy.
///
/// The ratio is the point. A director deciding whether to keep repairing a
/// machine should not have to divide two numbers on a phone, so once repairs
/// pass the threshold the card says so in words.
class MachineCostCard extends StatelessWidget {
  const MachineCostCard({
    required this.maintenance,
    required this.purchase,
    super.key,
  });

  final MachineMaintenance maintenance;
  final MachinePurchase purchase;

  @override
  Widget build(BuildContext context) {
    final double? percent = maintenance.costVsPricePercent;

    return DetailCard(
      title: LocaleKeys.machineCostTitle.tr(),
      icon: Icons.build_outlined,
      children: <Widget>[
        DetailRow(
          label: LocaleKeys.machineRepairCount.tr(),
          value: Formatters.number(maintenance.repairCount),
        ),
        DetailRow(
          label: LocaleKeys.machineTotalRepairCost.tr(),
          value: Formatters.currency(maintenance.totalRepairCost),
        ),
        if (percent != null)
          DetailRow(
            label: LocaleKeys.machineCostRatio.tr(),
            value: '${percent.toStringAsFixed(0)}%',
            valueColor: maintenance.shouldConsiderScrapping
                ? AppColors.dangerColor
                : null,
          ),
        if (maintenance.shouldConsiderScrapping) ...<Widget>[
          const SizedBox(height: AppSpacing.xs),
          DetailNote(
            LocaleKeys.machineConsiderScrapping.tr(),
            icon: Icons.warning_amber_rounded,
            color: AppColors.dangerColor,
          ),
        ],
      ],
    );
  }
}
