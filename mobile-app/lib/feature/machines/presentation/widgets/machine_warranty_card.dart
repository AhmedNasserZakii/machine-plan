import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';

/// Whether this repair is free.
///
/// That is the only question anyone asks a warranty, so the headline answers it
/// in those words rather than printing two dates and leaving the arithmetic to
/// a technician standing in front of the machine.
class MachineWarrantyCard extends StatelessWidget {
  const MachineWarrantyCard({required this.warranty, super.key});

  final MachineWarranty warranty;

  @override
  Widget build(BuildContext context) {
    final String? end = Formatters.isoDate(warranty.end);

    return DetailCard(
      title: LocaleKeys.machineWarrantyTitle.tr(),
      icon: Icons.verified_user_outlined,
      children: <Widget>[
        DetailNote(_headline(end), icon: _icon, color: _color),
        if (warranty.isActive && warranty.isExpiringSoon) ...<Widget>[
          const SizedBox(height: AppSpacing.sm),
          DetailNote(
            LocaleKeys.machineWarrantyDaysLeft.tr(
              args: <String>[warranty.daysRemaining.toString()],
            ),
            icon: Icons.schedule_rounded,
            color: AppColors.warningColor,
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        DetailRow(
          label: LocaleKeys.machineWarrantyStart.tr(),
          value: Formatters.isoDate(warranty.start),
        ),
        DetailRow(label: LocaleKeys.machineWarrantyEnd.tr(), value: end),
      ],
    );
  }

  String _headline(String? end) {
    if (!warranty.isKnown) {
      return LocaleKeys.machineWarrantyUnknown.tr();
    }
    if (!warranty.isActive) {
      return LocaleKeys.machineWarrantyExpired.tr();
    }

    return LocaleKeys.machineWarrantyActive.tr(args: <String>[end ?? '']);
  }

  IconData get _icon {
    if (!warranty.isKnown) {
      return Icons.help_outline_rounded;
    }

    return warranty.isActive
        ? Icons.check_circle_outline_rounded
        : Icons.cancel_outlined;
  }

  Color get _color {
    if (!warranty.isKnown) {
      return AppColors.textSecondaryColor;
    }

    return warranty.isActive
        ? AppColors.successColor
        : AppColors.textSecondaryColor;
  }
}
