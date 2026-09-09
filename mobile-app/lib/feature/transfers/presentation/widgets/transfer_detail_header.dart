import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/presentation/helpers/machine_labels.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/presentation/helpers/transfer_labels.dart';
import 'package:machinery/feature/transfers/presentation/widgets/transfer_status_chip.dart';

/// The document heading: what kind of hand-off this is, between whom, when.
class TransferDetailHeader extends StatelessWidget {
  const TransferDetailHeader({required this.transfer, super.key});

  final TransferEntity transfer;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      title: transfer.referenceNo,
      icon: Icons.receipt_long_outlined,
      trailing: TransferStatusChip(status: transfer.status),
      children: <Widget>[
        DetailRow(
          label: LocaleKeys.transferSelectType.tr(),
          value: TransferLabels.type(transfer.type),
        ),
        DetailRow(
          label: LocaleKeys.transferFrom.tr(),
          value: _party(transfer.from),
        ),
        DetailRow(
          label: LocaleKeys.transferTo.tr(),
          value: _party(transfer.to),
        ),
        DetailRow(
          label: LocaleKeys.transferOccurredAt.tr(),
          value: Formatters.dateTime(transfer.occurredAt),
        ),
        DetailRow(
          label: LocaleKeys.transferConfirmedAt.tr(),
          value: transfer.confirmedAt == null
              ? null
              : Formatters.dateTime(transfer.confirmedAt!),
        ),
        DetailRow(label: LocaleKeys.transferNotes.tr(), value: transfer.notes),
        if (transfer.rejectionReason != null)
          _RejectionReason(reason: transfer.rejectionReason!),
      ],
    );
  }

  /// The factory and the scrapyard have no record behind them, so the party
  /// label is the name.
  String _party(TransferPartyEntity party) =>
      party.name ?? MachineLabels.party(party.type);
}

class _RejectionReason extends StatelessWidget {
  const _RejectionReason({required this.reason});

  final String reason;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.dangerSurfaceColor,
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: Text(
        reason,
        style: Styles.s13(context).copyWith(color: AppColors.dangerColor),
      ),
    );
  }
}
