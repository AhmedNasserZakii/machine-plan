import 'package:flutter/material.dart';
import 'package:machinery/core/shared_widgets/app_3d_icon.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

class AppEmptyState extends StatelessWidget {
  const AppEmptyState({
    required this.title,
    required this.subtitle,
    super.key,
    this.icon,
    this.action,
  });

  final String title;
  final String subtitle;
  final IconData? icon;
  final Widget? action;

  // Keep existing callers compatible while giving every empty screen artwork
  // that matches its feature rather than a generic flat inbox symbol.
  App3dIconType get _artwork => switch (icon) {
    Icons.point_of_sale_outlined ||
    Icons.inventory_2_outlined ||
    Icons.qr_code_scanner_rounded => App3dIconType.machines,
    Icons.devices_other_outlined => App3dIconType.models,
    Icons.person_search_outlined ||
    Icons.people_outline_rounded => App3dIconType.users,
    Icons.storefront_outlined => App3dIconType.merchants,
    Icons.store_mall_directory_outlined => App3dIconType.branches,
    Icons.swap_horiz_rounded => App3dIconType.transfers,
    Icons.build_circle_outlined => App3dIconType.maintenance,
    Icons.notifications_none_rounded => App3dIconType.notifications,
    Icons.cloud_done_outlined || Icons.history_rounded => App3dIconType.sync,
    Icons.receipt_long_outlined => App3dIconType.finance,
    Icons.category_outlined ||
    Icons.donut_small_outlined ||
    Icons.speed_outlined => App3dIconType.reports,
    Icons.block_outlined => App3dIconType.password,
    Icons.search_off_rounded => App3dIconType.users,
    _ => App3dIconType.checklist,
  };

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            App3dIcon(_artwork, size: 112),
            const SizedBox(height: AppSpacing.md),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Styles.s17(context),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: Styles.s14(
                context,
              ).copyWith(color: AppColors.textSecondaryColor),
            ),
            if (action != null) ...<Widget>[
              const SizedBox(height: AppSpacing.lg),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}
