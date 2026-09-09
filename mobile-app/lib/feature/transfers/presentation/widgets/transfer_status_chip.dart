import 'package:flutter/material.dart';
import 'package:machinery/core/shared_widgets/status_chip.dart';
import 'package:machinery/core/theme/styles/status_colors.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/transfers/presentation/helpers/transfer_labels.dart';

class TransferStatusChip extends StatelessWidget {
  const TransferStatusChip({required this.status, super.key});

  final TransferStatus status;

  @override
  Widget build(BuildContext context) {
    return StatusChip(
      label: TransferLabels.status(status),
      color: StatusColors.forTransferStatus(status),
      icon: StatusColors.iconForTransferStatus(status),
    );
  }
}
