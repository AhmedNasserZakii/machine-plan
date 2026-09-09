import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/presentation/helpers/machine_labels.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_serial_text.dart';

/// Every serial this unit has ever been, oldest first.
///
/// A merchant knows their machine by the serial on the sticker, and after two
/// factory replacements that is a serial nobody in the system recognises. This
/// card is how a support call gets back to the current record.
class MachineChainCard extends StatelessWidget {
  const MachineChainCard({
    required this.chain,
    required this.currentId,
    required this.onTap,
    super.key,
  });

  final List<MachineEntity> chain;
  final String currentId;
  final ValueChanged<MachineEntity> onTap;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      title: LocaleKeys.machineChainTitle.tr(),
      icon: Icons.swap_horiz_rounded,
      children: List<Widget>.generate(chain.length, (int index) {
        final MachineEntity link = chain[index];
        final bool isCurrent = link.id == currentId;

        return _ChainLink(
          machine: link,
          isCurrent: isCurrent,
          onTap: isCurrent ? null : () => onTap(link),
        );
      }),
    );
  }
}

class _ChainLink extends StatelessWidget {
  const _ChainLink({
    required this.machine,
    required this.isCurrent,
    required this.onTap,
  });

  final MachineEntity machine;
  final bool isCurrent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: Padding(
        padding: const EdgeInsetsDirectional.symmetric(vertical: AppSpacing.sm),
        child: Row(
          children: <Widget>[
            Icon(
              isCurrent
                  ? Icons.radio_button_checked_rounded
                  : Icons.radio_button_unchecked_rounded,
              size: 16,
              color: isCurrent
                  ? AppColors.primaryColor
                  : AppColors.textDisabledColor,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  MachineSerialText(
                    machine.serial,
                    copyable: false,
                    style: Styles.mono(context).copyWith(
                      color: isCurrent ? null : AppColors.textSecondaryColor,
                      fontWeight: isCurrent ? FontWeight.w700 : null,
                    ),
                  ),
                  Text(
                    isCurrent
                        ? LocaleKeys.machineChainCurrent.tr()
                        : MachineLabels.status(machine.status),
                    style: Styles.s12(
                      context,
                    ).copyWith(color: AppColors.textSecondaryColor),
                  ),
                ],
              ),
            ),
            if (!isCurrent)
              const Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.textSecondaryColor,
              ),
          ],
        ),
      ),
    );
  }
}
