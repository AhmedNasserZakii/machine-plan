import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/theme/styles/status_colors.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/merchants/data/logic/merchant_form/merchant_form_state.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/presentation/helpers/merchant_labels.dart';

/// What the duplicate pre-flight found, shown above the submit button while the
/// representative is still filling the form.
///
/// A repeated phone is amber and lists the shops already on that line, so he can
/// recognise one instead of being told a number is taken. A repeated national ID
/// is red, because the server will refuse it.
class MerchantDuplicateNotice extends StatelessWidget {
  const MerchantDuplicateNotice({required this.state, super.key});

  final MerchantFormReady state;

  @override
  Widget build(BuildContext context) {
    if (state.warnings.isEmpty) {
      return const SizedBox.shrink();
    }

    final Color color = state.isBlocked
        ? AppColors.dangerColor
        : AppColors.warningColor;

    return Container(
      width: double.infinity,
      // Spaced off the field above rather than the one below, so collapsing to
      // nothing leaves the form's own rhythm intact.
      margin: const EdgeInsetsDirectional.only(top: AppSpacing.md),
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: StatusColors.surfaceFor(color),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: color),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          for (final MerchantDuplicateWarning warning in state.warnings)
            Padding(
              padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Icon(Icons.warning_amber_rounded, size: 16, color: color),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      MerchantLabels.duplicateWarning(warning),
                      style: Styles.s13(context).copyWith(color: color),
                    ),
                  ),
                ],
              ),
            ),
          if (state.duplicates.isNotEmpty) ...<Widget>[
            const SizedBox(height: AppSpacing.sm),
            Text(
              LocaleKeys.merchantDuplicateExisting.tr(),
              style: Styles.s12(
                context,
              ).copyWith(fontWeight: FontWeight.w600, color: color),
            ),
            const SizedBox(height: AppSpacing.xs),
            for (final MerchantEntity duplicate in state.duplicates)
              _DuplicateRow(merchant: duplicate),
          ],
        ],
      ),
    );
  }
}

class _DuplicateRow extends StatelessWidget {
  const _DuplicateRow({required this.merchant});

  final MerchantEntity merchant;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(top: AppSpacing.xs),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              '${merchant.shopName} — ${merchant.name}',
              style: Styles.s13(context),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          LtrText(
            merchant.phone,
            style: Styles.s12(
              context,
            ).copyWith(color: AppColors.textSecondaryColor),
          ),
        ],
      ),
    );
  }
}
