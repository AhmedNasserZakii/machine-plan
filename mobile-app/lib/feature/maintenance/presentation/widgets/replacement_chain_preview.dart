import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';

class ReplacementChainPreview extends StatelessWidget {
  const ReplacementChainPreview({
    required this.oldMachine,
    required this.newSerial,
    super.key,
  });

  final MachineEntity oldMachine;
  final String newSerial;

  @override
  Widget build(BuildContext context) {
    final String previewSerial = newSerial.trim().isEmpty
        ? '—'
        : newSerial.trim();

    return DetailCard(
      title: LocaleKeys.replacementChainPreviewTitle.tr(),
      icon: Icons.account_tree_outlined,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(
              child: _ChainEnd(
                serial: oldMachine.serial,
                label: LocaleKeys.replacementOldMachine.tr(),
                detail: LocaleKeys.replacementOldMachineDetail.tr(
                  args: <String>[
                    Formatters.number(oldMachine.maintenance.repairCount),
                    Formatters.currency(oldMachine.maintenance.totalRepairCost),
                  ],
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.sm,
              ),
              child: Icon(
                Icons.arrow_forward_rounded,
                color: AppColors.primaryColor,
              ),
            ),
            Expanded(
              child: _ChainEnd(
                serial: previewSerial,
                label: LocaleKeys.replacementNewMachine.tr(),
                detail: LocaleKeys.replacementNewMachineDetail.tr(),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        DetailNote(
          LocaleKeys.replacementCustodyNote.tr(),
          icon: Icons.warehouse_outlined,
          color: AppColors.primaryColor,
        ),
      ],
    );
  }
}

class _ChainEnd extends StatelessWidget {
  const _ChainEnd({
    required this.serial,
    required this.label,
    required this.detail,
  });

  final String serial;
  final String label;
  final String detail;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        LtrText(
          serial,
          style: Styles.mono(context).copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(label, style: Styles.s12(context)),
        const SizedBox(height: AppSpacing.xs),
        Text(
          detail,
          style: Styles.s12(
            context,
          ).copyWith(color: AppColors.textSecondaryColor),
        ),
      ],
    );
  }
}
