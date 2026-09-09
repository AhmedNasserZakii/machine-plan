import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/status_chip.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/presentation/helpers/merchant_labels.dart';

/// The plan a merchant is on, or the fact that he is late on it.
///
/// Being overdue outranks the plan name: on a collection round the only thing
/// worth reading off a row is who owes money.
class SubscriptionBadge extends StatelessWidget {
  const SubscriptionBadge({required this.subscription, super.key});

  final SubscriptionEntity subscription;

  @override
  Widget build(BuildContext context) {
    if (subscription.isOverdue) {
      return StatusChip(
        label: LocaleKeys.subscriptionOverdue.tr(),
        color: AppColors.dangerColor,
        icon: Icons.schedule_rounded,
      );
    }

    return StatusChip(
      label: MerchantLabels.plan(subscription.planType),
      color: AppColors.infoColor,
      icon: Icons.event_repeat_rounded,
    );
  }
}
