import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/presentation/helpers/transfer_labels.dart';

/// One machine inside a hand-off, as recorded.
///
/// The mismatch line is the point of this widget. A swapped battery is the
/// thing the paper process could never catch, and it has to be legible without
/// tapping into anything.
class TransferItemTile extends StatelessWidget {
  const TransferItemTile({
    required this.item,
    this.trailing,
    this.isAdjusted = false,
    super.key,
  });

  final TransferItemEntity item;

  /// The confirm screen puts its edit control here.
  final Widget? trailing;

  /// The receiver has corrected this row away from what the sender declared.
  final bool isAdjusted;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      identifier: 'transfer_item_${item.machine.serial}',
      child: Container(
        margin: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.surfaceColor,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: item.hasMismatch
                ? AppColors.dangerColor
                : AppColors.borderColor,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: LtrText(
                    item.machine.serial,
                    style: Styles.mono(
                      context,
                    ).copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                if (isAdjusted) ...<Widget>[
                  const _AdjustedBadge(),
                  const SizedBox(width: AppSpacing.sm),
                ],
                ?trailing,
              ],
            ),
            if (item.machine.model != null) ...<Widget>[
              const SizedBox(height: AppSpacing.xs),
              Text(
                item.machine.model!,
                style: Styles.s12(
                  context,
                ).copyWith(color: AppColors.textSecondaryColor),
              ),
            ],
            const SizedBox(height: AppSpacing.sm),
            _Attributes(item: item),
            if (item.batteryMatches == false) ...<Widget>[
              const SizedBox(height: AppSpacing.sm),
              _BatteryMismatch(item: item),
            ],
            if (item.notes != null && item.notes!.isNotEmpty) ...<Widget>[
              const SizedBox(height: AppSpacing.sm),
              Text(
                item.notes!,
                style: Styles.s12(
                  context,
                ).copyWith(color: AppColors.textSecondaryColor),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Charger, box, condition. A missing charger is what turns into a deduction at
/// the end of the month, so it is stated positively either way rather than
/// being inferred from an absent tick.
class _Attributes extends StatelessWidget {
  const _Attributes({required this.item});

  final TransferItemEntity item;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.xs,
      children: <Widget>[
        _Flag(
          label: LocaleKeys.transferItemCharger.tr(),
          isPresent: item.hasCharger,
        ),
        _Flag(label: LocaleKeys.transferItemBox.tr(), isPresent: item.hasBox),
        Text(
          TransferLabels.condition(item.condition),
          style: Styles.s12(context).copyWith(
            color: item.condition == ItemCondition.good
                ? AppColors.textSecondaryColor
                : AppColors.warningColor,
          ),
        ),
      ],
    );
  }
}

class _Flag extends StatelessWidget {
  const _Flag({required this.label, required this.isPresent});

  final String label;
  final bool isPresent;

  @override
  Widget build(BuildContext context) {
    final Color color = isPresent
        ? AppColors.textSecondaryColor
        : AppColors.warningColor;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Icon(
          isPresent ? Icons.check_rounded : Icons.close_rounded,
          size: 14,
          color: color,
        ),
        const SizedBox(width: AppSpacing.xs),
        Text(label, style: Styles.s12(context).copyWith(color: color)),
      ],
    );
  }
}

/// The unit arrived carrying somebody else's battery. Both serials are shown
/// because the next question is always "then whose is it?".
class _BatteryMismatch extends StatelessWidget {
  const _BatteryMismatch({required this.item});

  final TransferItemEntity item;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.dangerSurfaceColor,
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              const Icon(
                Icons.battery_alert_outlined,
                size: 14,
                color: AppColors.dangerColor,
              ),
              const SizedBox(width: AppSpacing.xs),
              Text(
                LocaleKeys.transferItemBatteryMismatch.tr(),
                style: Styles.s12(context).copyWith(
                  color: AppColors.dangerColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          LtrText(
            LocaleKeys.transferItemBatteryScanned.tr(
              args: <String>[item.batterySerialScanned ?? ''],
            ),
            style: Styles.s12(
              context,
            ).copyWith(color: AppColors.textSecondaryColor),
          ),
        ],
      ),
    );
  }
}

class _AdjustedBadge extends StatelessWidget {
  const _AdjustedBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 1,
      ),
      decoration: BoxDecoration(
        color: AppColors.infoSurfaceColor,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        LocaleKeys.transferItemAdjusted.tr(),
        style: Styles.s12(
          context,
        ).copyWith(color: AppColors.infoColor, fontWeight: FontWeight.w600),
      ),
    );
  }
}
