import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/presentation/widgets/subscription_badge.dart';

/// The top of the merchant screen: who he is, how to reach him, and what he has
/// paid so far.
class MerchantDetailHeader extends StatelessWidget {
  const MerchantDetailHeader({required this.merchant, super.key});

  final MerchantEntity merchant;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
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
                child: Text(
                  merchant.shopName,
                  style: Styles.s20(
                    context,
                  ).copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              if (merchant.activeSubscription != null)
                SubscriptionBadge(subscription: merchant.activeSubscription!),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            merchant.name,
            style: Styles.s14(
              context,
            ).copyWith(color: AppColors.textSecondaryColor),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: <Widget>[
              const Icon(
                Icons.phone_outlined,
                size: 16,
                color: AppColors.textSecondaryColor,
              ),
              const SizedBox(width: AppSpacing.sm),
              LtrText(merchant.phone, style: Styles.s14(context)),
            ],
          ),
          if (merchant.address != null) ...<Widget>[
            const SizedBox(height: AppSpacing.sm),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const Icon(
                  Icons.location_on_outlined,
                  size: 16,
                  color: AppColors.textSecondaryColor,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    merchant.address!,
                    style: Styles.s13(
                      context,
                    ).copyWith(color: AppColors.textSecondaryColor),
                  ),
                ),
              ],
            ),
          ],
          // Nothing collected is not worth a line: a shop registered this
          // morning would otherwise show a zero that reads like a problem.
          if (merchant.totalPaid > 0) ...<Widget>[
            const SizedBox(height: AppSpacing.md),
            const Divider(height: 1, color: AppColors.borderColor),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: <Widget>[
                Text(
                  LocaleKeys.merchantTotalPaid.tr(),
                  style: Styles.s13(
                    context,
                  ).copyWith(color: AppColors.textSecondaryColor),
                ),
                const Spacer(),
                LtrText(
                  Formatters.currency(merchant.totalPaid),
                  style: Styles.s15(context).copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.successColor,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
