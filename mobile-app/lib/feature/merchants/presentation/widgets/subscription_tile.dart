import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/presentation/helpers/merchant_labels.dart';

/// One arrangement on the merchant screen: what he pays, when he is next due,
/// and the button that takes the money.
class SubscriptionTile extends StatelessWidget {
  const SubscriptionTile({
    required this.subscription,
    required this.onCollect,
    super.key,
  });

  final SubscriptionEntity subscription;

  /// Null when the caller may not collect, which hides the button rather than
  /// greying it.
  final VoidCallback? onCollect;

  @override
  Widget build(BuildContext context) {
    final String? nextDue = Formatters.isoDate(subscription.nextDueDate);

    return Semantics(
      identifier: 'subscription_tile_${subscription.id}',
      child: Container(
        margin: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.surfaceAltColor,
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    MerchantLabels.plan(subscription.planType),
                    style: Styles.s14(
                      context,
                    ).copyWith(fontWeight: FontWeight.w600),
                  ),
                ),
                if (subscription.planType != SubscriptionPlanType.none)
                  LtrText(
                    Formatters.currency(subscription.amount),
                    style: Styles.s14(
                      context,
                    ).copyWith(fontWeight: FontWeight.w700),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              subscription.machineSerial ??
                  LocaleKeys.subscriptionMachineAll.tr(),
              style: Styles.s12(
                context,
              ).copyWith(color: AppColors.textSecondaryColor),
            ),
            if (nextDue != null) ...<Widget>[
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: <Widget>[
                  Icon(
                    Icons.event_outlined,
                    size: 14,
                    color: subscription.isOverdue
                        ? AppColors.dangerColor
                        : AppColors.textSecondaryColor,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    '${LocaleKeys.subscriptionNextDue.tr()}: $nextDue',
                    style: Styles.s12(context).copyWith(
                      color: subscription.isOverdue
                          ? AppColors.dangerColor
                          : AppColors.textSecondaryColor,
                      fontWeight: subscription.isOverdue
                          ? FontWeight.w600
                          : FontWeight.w400,
                    ),
                  ),
                ],
              ),
            ],
            if (subscription.collectionCount > 0) ...<Widget>[
              const SizedBox(height: AppSpacing.xs),
              Text(
                '${LocaleKeys.subscriptionCollected.tr()}: '
                '${Formatters.currency(subscription.totalCollected)} — '
                '${LocaleKeys.subscriptionCollectionsCount.tr(args: <String>[subscription.collectionCount.toString()])}',
                style: Styles.s12(
                  context,
                ).copyWith(color: AppColors.textSecondaryColor),
              ),
            ],
            if (onCollect != null) ...<Widget>[
              const SizedBox(height: AppSpacing.sm),
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: TextButton.icon(
                  onPressed: onCollect,
                  icon: const Icon(Icons.payments_outlined, size: 18),
                  label: Text(LocaleKeys.subscriptionCollect.tr()),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
