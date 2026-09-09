import 'package:flutter/material.dart';
import 'package:machinery/core/shared_widgets/status_chip.dart';
import 'package:machinery/core/theme/styles/status_colors.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/presentation/helpers/machine_labels.dart';

/// Where a machine is, as colour + icon + word. Never the raw enum.
class MachineStatusChip extends StatelessWidget {
  const MachineStatusChip({required this.status, super.key});

  final MachineStatus status;

  @override
  Widget build(BuildContext context) {
    return StatusChip(
      label: MachineLabels.status(status),
      color: StatusColors.forMachineStatus(status),
      icon: StatusColors.iconForMachineStatus(status),
    );
  }
}
