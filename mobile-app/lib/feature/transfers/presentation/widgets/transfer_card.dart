import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/shared_widgets/clicked_widget.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/presentation/helpers/machine_labels.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/presentation/helpers/transfer_labels.dart';
import 'package:machinery/feature/transfers/presentation/widgets/transfer_status_chip.dart';

/// One row in the transfers list.
///
/// The reference number is what people quote to each other on the phone, so it
/// leads. Underneath, the two things that decide whether this row needs opening
/// right now: who it is between, and how many machines are on it.
class TransferCard extends StatelessWidget {
  const TransferCard({
    required this.transfer,
    required this.onTap,
    this.awaitingYou = false,
    super.key,
  });

  final TransferEntity transfer;
  final VoidCallback onTap;

  /// Renders the row as an action rather than a record. Only the inbox sets it.
  final bool awaitingYou;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      identifier: 'transfer_card_${transfer.referenceNo}',
      child: ClickedWidget(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.surfaceColor,
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(
              color: awaitingYou
                  ? AppColors.warningColor
                  : AppColors.borderColor,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      transfer.referenceNo,
                      style: Styles.mono(
                        context,
                      ).copyWith(fontWeight: FontWeight.w700),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  TransferStatusChip(status: transfer.status),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                TransferLabels.type(transfer.type),
                style: Styles.s13(
                  context,
                ).copyWith(color: AppColors.textSecondaryColor),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: AppSpacing.xs),
              _PartyLine(transfer: transfer),
              const SizedBox(height: AppSpacing.sm),
              _MetaRow(transfer: transfer, awaitingYou: awaitingYou),
            ],
          ),
        ),
      ),
    );
  }
}

/// Who handed what to whom, in one line. Falls back to the party label when
/// there is no record behind the side — the factory is not a name.
class _PartyLine extends StatelessWidget {
  const _PartyLine({required this.transfer});

  final TransferEntity transfer;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Flexible(child: _party(context, transfer.from)),
        const Padding(
          padding: EdgeInsetsDirectional.symmetric(horizontal: AppSpacing.xs),
          child: Icon(
            Icons.arrow_back_rounded,
            size: 14,
            color: AppColors.textSecondaryColor,
          ),
        ),
        Flexible(child: _party(context, transfer.to)),
      ],
    );
  }

  Widget _party(BuildContext context, TransferPartyEntity party) {
    return Text(
      party.name ?? MachineLabels.party(party.type),
      style: Styles.s12(context).copyWith(color: AppColors.textPrimaryColor),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.transfer, required this.awaitingYou});

  final TransferEntity transfer;
  final bool awaitingYou;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.xs,
      children: <Widget>[
        _MetaItem(
          icon: Icons.point_of_sale_outlined,
          label: LocaleKeys.transferItemsCount.tr(
            args: <String>[transfer.itemsCount.toString()],
          ),
        ),
        _MetaItem(
          icon: Icons.event_outlined,
          label: Formatters.date(transfer.occurredAt),
        ),
        if (transfer.violationsCount > 0)
          _MetaItem(
            icon: Icons.warning_amber_rounded,
            label: LocaleKeys.transferViolationsBadge.tr(
              args: <String>[transfer.violationsCount.toString()],
            ),
            color: AppColors.dangerColor,
          ),
        if (awaitingYou)
          _MetaItem(
            icon: Icons.draw_outlined,
            label: LocaleKeys.transferAwaitingYou.tr(),
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
