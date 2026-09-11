import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/shared_widgets/status_chip.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/presentation/helpers/maintenance_labels.dart';

class DecommissionCandidateCard extends StatelessWidget {
  const DecommissionCandidateCard({
    required this.candidate,
    required this.onTap,
    super.key,
  });

  final DecommissionCandidateEntity candidate;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ratio = candidate.costRatio;
    final color = ratio != null && ratio >= .8
        ? AppColors.dangerColor
        : AppColors.warningColor;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: DetailCard(
        title: candidate.serial,
        icon: Icons.precision_manufacturing_outlined,
        trailing: const Icon(Icons.chevron_right_rounded),
        children: [
          if (candidate.model != null)
            Text(
              candidate.model!,
              style: Styles.s13(
                context,
              ).copyWith(color: AppColors.textSecondaryColor),
            ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              StatusChip(
                label: MaintenanceLabels.recommendation(
                  candidate.recommendation,
                ),
                color: MaintenanceLabels.recommendationColor(
                  candidate.recommendation,
                ),
                icon: Icons.lightbulb_outline_rounded,
              ),
              if (candidate.isInChain) ...[
                const SizedBox(width: AppSpacing.sm),
                StatusChip(
                  label: LocaleKeys.decommissionChainCount.tr(
                    args: [Formatters.number(candidate.chainLength)],
                  ),
                  color: AppColors.infoColor,
                  icon: Icons.account_tree_outlined,
                ),
              ],
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          LinearProgressIndicator(
            value: (ratio ?? 0).clamp(0, 1),
            minHeight: 8,
            backgroundColor: AppColors.borderColor,
            color: color,
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.xs,
            children: [
              Text(
                LocaleKeys.decommissionRatioShort.tr(
                  args: [ratio == null ? '—' : '${(ratio * 100).round()}%'],
                ),
                style: Styles.s12(context),
              ),
              Text(
                LocaleKeys.decommissionRepairsShort.tr(
                  args: [Formatters.number(candidate.repairCount)],
                ),
                style: Styles.s12(context),
              ),
              Text(
                LocaleKeys.decommissionAgeShort.tr(
                  args: [Formatters.number(candidate.ageMonths)],
                ),
                style: Styles.s12(context),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          LtrText(
            Formatters.currency(candidate.cumulativeRepairCost),
            style: Styles.s13(context).copyWith(fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
