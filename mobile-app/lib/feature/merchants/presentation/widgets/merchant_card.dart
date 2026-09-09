import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/clicked_widget.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/presentation/widgets/subscription_badge.dart';

/// One row in the merchants list.
///
/// The shop name leads, not the person's: a representative on his round is
/// looking for a place, and half the merchants share a first name.
class MerchantCard extends StatelessWidget {
  const MerchantCard({required this.merchant, required this.onTap, super.key});

  final MerchantEntity merchant;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      identifier: 'merchant_card_${merchant.id}',
      child: ClickedWidget(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
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
                      style: Styles.s15(
                        context,
                      ).copyWith(fontWeight: FontWeight.w700),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  if (!merchant.isActive)
                    _InactiveChip()
                  else if (merchant.activeSubscription != null)
                    SubscriptionBadge(
                      subscription: merchant.activeSubscription!,
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                merchant.name,
                style: Styles.s13(
                  context,
                ).copyWith(color: AppColors.textSecondaryColor),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: AppSpacing.sm),
              _MetaRow(merchant: merchant),
            ],
          ),
        ),
      ),
    );
  }
}

/// How to reach him, where he is, and how many machines he is running — what
/// decides whether someone taps in.
class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.merchant});

  final MerchantEntity merchant;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.xs,
      children: <Widget>[
        _MetaItem(
          icon: Icons.phone_outlined,
          // A phone number is read left to right even in an Arabic layout.
          labelWidget: LtrText(
            merchant.phone,
            style: Styles.s12(
              context,
            ).copyWith(color: AppColors.textSecondaryColor),
          ),
        ),
        if (merchant.branch != null)
          _MetaItem(
            icon: Icons.location_on_outlined,
            label: merchant.branch!.name,
          ),
        if (merchant.machinesCount > 0)
          _MetaItem(
            icon: Icons.point_of_sale_outlined,
            label: merchant.machinesCount.toString(),
          ),
      ],
    );
  }
}

class _InactiveChip extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: AppColors.neutralSurfaceColor,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        LocaleKeys.merchantInactive.tr(),
        style: Styles.s12(
          context,
        ).copyWith(color: AppColors.neutralColor, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _MetaItem extends StatelessWidget {
  const _MetaItem({required this.icon, this.label, this.labelWidget});

  final IconData icon;
  final String? label;
  final Widget? labelWidget;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Icon(icon, size: 14, color: AppColors.textSecondaryColor),
        const SizedBox(width: AppSpacing.xs),
        labelWidget ??
            Text(
              label ?? '',
              style: Styles.s12(
                context,
              ).copyWith(color: AppColors.textSecondaryColor),
            ),
      ],
    );
  }
}
