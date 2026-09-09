import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_state.dart';

/// Where the user is in the create wizard, and how much is left.
///
/// Four labelled segments rather than a bare bar: on a hand-off of forty
/// machines the honest question is "how much more of this", and a percentage
/// does not answer it.
class WizardProgress extends StatelessWidget {
  const WizardProgress({required this.step, super.key});

  final CreateTransferStep step;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        children: CreateTransferStep.values
            .map(
              (CreateTransferStep value) => Expanded(
                child: _Segment(
                  label: _labelFor(value),
                  isDone: value.index < step.index,
                  isCurrent: value == step,
                ),
              ),
            )
            .toList(growable: false),
      ),
    );
  }

  String _labelFor(CreateTransferStep value) => switch (value) {
    CreateTransferStep.typeAndRecipient => LocaleKeys.transferStepType.tr(),
    CreateTransferStep.pickMachines => LocaleKeys.transferStepMachines.tr(),
    CreateTransferStep.itemDetails => LocaleKeys.transferStepDetails.tr(),
    CreateTransferStep.review => LocaleKeys.transferStepReview.tr(),
  };
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.isDone,
    required this.isCurrent,
  });

  final String label;
  final bool isDone;
  final bool isCurrent;

  @override
  Widget build(BuildContext context) {
    final Color color = isDone || isCurrent
        ? AppColors.primaryColor
        : AppColors.borderColor;

    return Padding(
      padding: const EdgeInsetsDirectional.only(end: AppSpacing.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(height: 3, color: color),
          const SizedBox(height: AppSpacing.xs),
          Text(
            label,
            style: Styles.s12(context).copyWith(
              color: isCurrent
                  ? AppColors.primaryColor
                  : AppColors.textSecondaryColor,
              fontWeight: isCurrent ? FontWeight.w600 : FontWeight.w400,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
