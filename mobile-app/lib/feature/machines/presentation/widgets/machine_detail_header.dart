import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/presentation/helpers/machine_labels.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_serial_text.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_status_chip.dart';

/// Serial, status and where the unit is — the three things someone opening this
/// screen came to check, above the fold.
class MachineDetailHeader extends StatelessWidget {
  const MachineDetailHeader({required this.machine, super.key});

  final MachineEntity machine;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        MachineSerialText(
          machine.serial,
          style: Styles.s24(context).copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          '${machine.type.name} — ${machine.model.name}',
          style: Styles.s14(
            context,
          ).copyWith(color: AppColors.textSecondaryColor),
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: <Widget>[
            MachineStatusChip(status: machine.status),
            if (machine.branch != null)
              _Pill(
                icon: Icons.location_on_outlined,
                label: machine.branch!.name,
              ),
            if (machine.holder != null)
              _Pill(
                icon: Icons.person_outline_rounded,
                label: MachineLabels.party(machine.holder!.type),
              ),
          ],
        ),
        if (machine.notes != null &&
            machine.notes!.trim().isNotEmpty) ...<Widget>[
          const SizedBox(height: AppSpacing.md),
          Text(
            LocaleKeys.machineNotes.tr(),
            style: Styles.s13(
              context,
            ).copyWith(color: AppColors.textSecondaryColor),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(machine.notes!, style: Styles.s14(context)),
        ],
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: AppColors.surfaceAltColor,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(icon, size: 14, color: AppColors.textSecondaryColor),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label,
            style: Styles.s12(
              context,
            ).copyWith(color: AppColors.textSecondaryColor),
          ),
        ],
      ),
    );
  }
}
