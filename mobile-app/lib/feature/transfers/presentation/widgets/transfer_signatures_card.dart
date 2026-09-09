import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/presentation/helpers/transfer_labels.dart';

/// Who signed, as what, and when. This is the record that replaces the paper
/// receipt, so it is shown even when there is only one signature on it.
class TransferSignaturesCard extends StatelessWidget {
  const TransferSignaturesCard({required this.signatures, super.key});

  final List<TransferSignatureEntity> signatures;

  @override
  Widget build(BuildContext context) {
    if (signatures.isEmpty) return const SizedBox.shrink();

    return DetailCard(
      title: LocaleKeys.transferSignaturesTitle.tr(),
      icon: Icons.draw_outlined,
      children: signatures
          .map(
            (TransferSignatureEntity signature) =>
                _SignatureRow(signature: signature),
          )
          .toList(growable: false),
    );
  }
}

class _SignatureRow extends StatelessWidget {
  const _SignatureRow({required this.signature});

  final TransferSignatureEntity signature;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Icon(
            Icons.verified_outlined,
            size: 16,
            color: AppColors.successColor,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  LocaleKeys.transferSignedBy.tr(
                    args: <String>[
                      signature.userFullName ??
                          TransferLabels.signatureRole(signature.partyRole),
                    ],
                  ),
                  style: Styles.s13(
                    context,
                  ).copyWith(fontWeight: FontWeight.w600),
                ),
                Text(
                  '${TransferLabels.signatureRole(signature.partyRole)} — '
                  '${Formatters.dateTime(signature.signedAt)}',
                  style: Styles.s12(
                    context,
                  ).copyWith(color: AppColors.textSecondaryColor),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
