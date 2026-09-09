import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/clicked_widget.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/presentation/helpers/machine_labels.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_serial_text.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_status_chip.dart';

/// One row in the machines list.
///
/// Only the machine serial appears here. The unit has four serials, but putting
/// all of them on a tile buries the one people actually search by — the other
/// three belong on the detail screen.
class MachineCard extends StatelessWidget {
  const MachineCard({required this.machine, required this.onTap, super.key});

  final MachineEntity machine;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      identifier: 'machine_card_${machine.serial}',
      child: ClickedWidget(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.surfaceColor,
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: AppColors.borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: MachineSerialText(
                      machine.serial,
                      copyable: false,
                      style: Styles.mono(
                        context,
                      ).copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  MachineStatusChip(status: machine.status),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                '${machine.type.name} — ${machine.model.name}',
                style: Styles.s13(
                  context,
                ).copyWith(color: AppColors.textSecondaryColor),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: AppSpacing.sm),
              _MetaRow(machine: machine),
            ],
          ),
        ),
      ),
    );
  }
}

/// Where the unit is and what it has cost so far — the two things that decide
/// whether someone taps into it.
class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.machine});

  final MachineEntity machine;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.xs,
      children: <Widget>[
        if (machine.branch != null)
          _MetaItem(
            icon: Icons.location_on_outlined,
            label: machine.branch!.name,
          ),
        if (machine.holder != null)
          _MetaItem(
            icon: Icons.person_outline_rounded,
            label: MachineLabels.party(machine.holder!.type),
          ),
        if (machine.maintenance.repairCount > 0)
          _MetaItem(
            icon: Icons.build_outlined,
            label: LocaleKeys.machineRepairsBadge.tr(
              args: <String>[machine.maintenance.repairCount.toString()],
            ),
            color: AppColors.warningColor,
          ),
        // Only worth a line when it is about to lapse: a warranty with a year
        // left is not news on a list row.
        if (machine.warranty.isExpiringSoon)
          _MetaItem(
            icon: Icons.verified_user_outlined,
            label: LocaleKeys.machineWarrantyDaysLeft.tr(
              args: <String>[machine.warranty.daysRemaining.toString()],
            ),
            color: AppColors.warningColor,
          ),
      ],
    );
  }
}

class _MetaItem extends StatelessWidget {
  const _MetaItem({required this.icon, required this.label, this.color});

  final IconData icon;
  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final Color resolved = color ?? AppColors.textSecondaryColor;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Icon(icon, size: 14, color: resolved),
        const SizedBox(width: AppSpacing.xs),
        Text(label, style: Styles.s12(context).copyWith(color: resolved)),
      ],
    );
  }
}
