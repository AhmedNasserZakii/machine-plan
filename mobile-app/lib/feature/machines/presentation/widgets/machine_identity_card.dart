import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_serial_text.dart';

/// The four serials that identify the unit, plus the rule that governs them.
///
/// The rule is stated here rather than left to be discovered when an edit is
/// refused: a serial that changed means the factory sent a different unit, and
/// that is a replacement record, not an edit.
class MachineIdentityCard extends StatelessWidget {
  const MachineIdentityCard({required this.machine, super.key});

  final MachineEntity machine;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      title: LocaleKeys.machineIdentityTitle.tr(),
      icon: Icons.fingerprint_rounded,
      children: <Widget>[
        DetailRow(
          label: LocaleKeys.machineSerial.tr(),
          valueWidget: MachineSerialText(machine.serial),
        ),
        if (machine.battery != null)
          DetailRow(
            label: LocaleKeys.batterySerial.tr(),
            valueWidget: MachineSerialText(machine.battery!.serial),
          ),
        if (machine.simSerial != null)
          DetailRow(
            label: LocaleKeys.simSerial.tr(),
            valueWidget: MachineSerialText(machine.simSerial!),
          ),
        DetailRow(
          label: LocaleKeys.boxSerial.tr(),
          value: machine.boxSerial ?? LocaleKeys.boxSerialNotPrinted.tr(),
          valueWidget: machine.boxSerial == null
              ? null
              : MachineSerialText(machine.boxSerial!),
        ),
        DetailRow(label: LocaleKeys.machineType.tr(), value: machine.type.name),
        DetailRow(
          label: LocaleKeys.machineModel.tr(),
          value: machine.model.name,
        ),
        DetailRow(
          label: LocaleKeys.machineManufacturer.tr(),
          value: machine.model.manufacturer,
        ),
        const SizedBox(height: AppSpacing.xs),
        DetailNote(
          LocaleKeys.serialImmutableNote.tr(),
          icon: Icons.lock_outline_rounded,
        ),
        if (machine.battery != null) ...<Widget>[
          const SizedBox(height: AppSpacing.sm),
          DetailNote(
            LocaleKeys.machineBatteryBond.tr(),
            icon: Icons.battery_charging_full_rounded,
          ),
        ],
        // Only worth a line when the box is present. Its absence is the norm
        // once a unit is out in the field and says nothing.
        if (machine.hasBox) ...<Widget>[
          const SizedBox(height: AppSpacing.sm),
          DetailNote(
            LocaleKeys.machineHasBox.tr(),
            icon: Icons.inventory_2_outlined,
            color: AppColors.successColor,
          ),
        ],
      ],
    );
  }
}
