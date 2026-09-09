import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_state.dart';
import 'package:machinery/feature/transfers/presentation/helpers/transfer_labels.dart';

/// Step four: what is about to be sent, and what is wrong with it.
///
/// The exceptions lead. Nobody re-reads forty rows on a phone, so the two
/// numbers that matter — wrong batteries, missing chargers — are stated at the
/// top where they can still change someone's mind.
class TransferReviewStep extends StatelessWidget {
  const TransferReviewStep({required this.state, super.key});

  final CreateTransferState state;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      children: <Widget>[
        if (state.validationProblems.isNotEmpty) ...<Widget>[
          _Problems(problems: state.validationProblems),
          const SizedBox(height: AppSpacing.md),
        ],
        DetailCard(
          title: LocaleKeys.transferReviewTitle.tr(),
          icon: Icons.fact_check_outlined,
          children: <Widget>[
            DetailRow(
              label: LocaleKeys.transferSelectType.tr(),
              value: state.type == null
                  ? null
                  : TransferLabels.type(state.type!),
            ),
            DetailRow(
              label: LocaleKeys.transferMachinesTitle.tr(),
              value: LocaleKeys.transferItemsCount.tr(
                args: <String>[state.items.length.toString()],
              ),
            ),
            if (state.mismatchCount > 0)
              DetailRow(
                label: LocaleKeys.transferItemBatteryMismatch.tr(),
                value: LocaleKeys.transferReviewMismatches.tr(
                  args: <String>[state.mismatchCount.toString()],
                ),
                valueColor: AppColors.dangerColor,
              ),
            if (state.missingChargerCount > 0)
              DetailRow(
                label: LocaleKeys.transferItemCharger.tr(),
                value: LocaleKeys.transferReviewMissingChargers.tr(
                  args: <String>[state.missingChargerCount.toString()],
                ),
                valueColor: AppColors.warningColor,
              ),
            DetailRow(label: LocaleKeys.transferNotes.tr(), value: state.notes),
            if (state.selected?.selfAttested ?? false)
              DetailNote(LocaleKeys.transferSelfAttestedNote.tr()),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        DetailCard(
          title: LocaleKeys.transferMachinesTitle.tr(),
          icon: Icons.point_of_sale_outlined,
          children: state.items
              .map((DraftItem item) => _ReviewRow(item: item))
              .toList(growable: false),
        ),
      ],
    );
  }
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({required this.item});

  final DraftItem item;

  @override
  Widget build(BuildContext context) {
    final bool isMismatch = item.batteryMatches == false;

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Row(
        children: <Widget>[
          Expanded(
            child: LtrText(item.machine.serial, style: Styles.mono(context)),
          ),
          if (isMismatch)
            const Icon(
              Icons.battery_alert_outlined,
              size: 16,
              color: AppColors.dangerColor,
            ),
          if (!item.params.hasCharger) ...<Widget>[
            const SizedBox(width: AppSpacing.sm),
            const Icon(
              Icons.power_off_outlined,
              size: 16,
              color: AppColors.warningColor,
            ),
          ],
        ],
      ),
    );
  }
}

/// What the dry run refused. Shown as the server phrased it rather than mapped
/// to a friendly line, because these are the cases nobody anticipated.
class _Problems extends StatelessWidget {
  const _Problems({required this.problems});

  final List<String> problems;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.dangerSurfaceColor,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            LocaleKeys.transferValidationFailed.tr(),
            style: Styles.s13(context).copyWith(
              color: AppColors.dangerColor,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          ...problems.map(
            (String problem) => Text(
              problem,
              style: Styles.s12(
                context,
              ).copyWith(color: AppColors.textSecondaryColor),
            ),
          ),
        ],
      ),
    );
  }
}
