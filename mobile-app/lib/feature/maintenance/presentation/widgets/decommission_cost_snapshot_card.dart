import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';

class DecommissionCostSnapshotCard extends StatelessWidget {
  const DecommissionCostSnapshotCard({required this.summary, super.key});

  final MachineCostSummary summary;

  @override
  Widget build(BuildContext context) {
    final double? ratio = summary.costToValueRatio;
    final Color ratioColor = ratio == null
        ? AppColors.neutralColor
        : ratio >= .8
        ? AppColors.dangerColor
        : AppColors.warningColor;

    return DetailCard(
      title: LocaleKeys.decommissionSnapshotTitle.tr(),
      icon: Icons.analytics_outlined,
      children: <Widget>[
        DetailRow(
          label: LocaleKeys.machinePurchasePrice.tr(),
          value: summary.purchasePrice == null
              ? LocaleKeys.decommissionUnknownPrice.tr()
              : Formatters.currency(summary.purchasePrice!),
        ),
        DetailRow(
          label: LocaleKeys.decommissionCumulativeCost.tr(),
          value: Formatters.currency(summary.totalRepairCost),
        ),
        DetailRow(
          label: LocaleKeys.decommissionRepairCount.tr(),
          value: Formatters.number(summary.repairCount),
        ),
        DetailRow(
          label: LocaleKeys.decommissionAge.tr(),
          value: LocaleKeys.decommissionAgeMonths.tr(
            args: [Formatters.number(summary.ageMonths)],
          ),
        ),
        if (summary.isInChain)
          DetailRow(
            label: LocaleKeys.decommissionChainLength.tr(),
            value: Formatters.number(summary.chainLength),
          ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.sm),
                child: LinearProgressIndicator(
                  value: (ratio ?? 0).clamp(0, 1),
                  minHeight: 10,
                  backgroundColor: AppColors.borderColor,
                  color: ratioColor,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Text(
              ratio == null ? '—' : '${(ratio * 100).round()}%',
              style: Styles.s14(
                context,
              ).copyWith(color: ratioColor, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        DetailNote(
          summary.isInChain
              ? LocaleKeys.decommissionChainAwareNote.tr()
              : LocaleKeys.decommissionRatioNote.tr(),
          icon: Icons.info_outline_rounded,
          color: ratioColor,
        ),
      ],
    );
  }
}
