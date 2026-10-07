import 'package:flutter/material.dart';
import 'package:machinery/core/shared_widgets/app_3d_icon.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';

/// Full-color feature artwork and dimensional controls with their original
/// semantic silhouettes. IconData is a lookup key for existing status helpers.
class AppSymbol3d extends StatelessWidget {
  const AppSymbol3d(
    this.icon, {
    super.key,
    this.size,
    this.color,
    this.semanticLabel,
    this.textDirection,
  });
  final IconData? icon;
  final double? size;
  final Color? color;
  final String? semanticLabel;
  final TextDirection? textDirection;

  static App3dIconType? artworkFor(IconData? icon) => switch (icon) {
    Icons.point_of_sale_outlined ||
    Icons.inventory_2_outlined ||
    Icons.sim_card_outlined => App3dIconType.machines,
    Icons.devices_other_outlined ||
    Icons.precision_manufacturing_outlined ||
    Icons.precision_manufacturing_rounded ||
    Icons.factory_outlined => App3dIconType.models,
    Icons.storefront_outlined ||
    Icons.storefront_rounded ||
    Icons.add_business_rounded => App3dIconType.merchants,
    Icons.business_outlined ||
    Icons.warehouse_outlined ||
    Icons.store_mall_directory_outlined ||
    Icons.location_on_outlined => App3dIconType.branches,
    Icons.people_outline ||
    Icons.people_outline_rounded ||
    Icons.supervisor_account_outlined ||
    Icons.person_search_outlined ||
    Icons.person_add_alt_1_rounded => App3dIconType.users,
    Icons.person_outline ||
    Icons.person_outline_rounded ||
    Icons.badge_outlined => App3dIconType.profile,
    Icons.account_balance_wallet_outlined ||
    Icons.account_balance_wallet_rounded ||
    Icons.payments_outlined ||
    Icons.balance => App3dIconType.finance,
    Icons.receipt_long_outlined ||
    Icons.receipt_long_rounded ||
    Icons.description_outlined ||
    Icons.summarize_outlined ||
    Icons.analytics_outlined ||
    Icons.bar_chart ||
    Icons.donut_small_outlined ||
    Icons.speed ||
    Icons.speed_outlined ||
    Icons.table_view_outlined => App3dIconType.reports,
    Icons.build_outlined ||
    Icons.build_rounded ||
    Icons.build_circle_outlined ||
    Icons.build_circle_rounded ||
    Icons.home_repair_service_outlined => App3dIconType.maintenance,
    Icons.swap_horiz ||
    Icons.swap_horiz_outlined ||
    Icons.swap_horiz_rounded ||
    Icons.local_shipping_outlined ||
    Icons.change_circle_outlined => App3dIconType.transfers,
    Icons.gavel_outlined || Icons.gavel_rounded => App3dIconType.violations,
    Icons.fact_check_outlined ||
    Icons.checklist_rounded ||
    Icons.verified_outlined => App3dIconType.checklist,
    Icons.notifications_active_outlined ||
    Icons.notifications_none_rounded => App3dIconType.notifications,
    Icons.history ||
    Icons.history_rounded ||
    Icons.cloud_done_outlined ||
    Icons.sync_rounded ||
    Icons.restore_rounded => App3dIconType.sync,
    Icons.lock_outline ||
    Icons.lock_outline_rounded ||
    Icons.shield_outlined ||
    Icons.verified_user_outlined => App3dIconType.password,
    Icons.settings_outlined => App3dIconType.more,
    Icons.logout_rounded => App3dIconType.logout,
    _ => null,
  };

  @override
  Widget build(BuildContext context) {
    final theme = IconTheme.of(context);
    final dimension = size ?? theme.size ?? 24;
    final tint = color ?? theme.color ?? AppColors.primaryColor;
    final direction = textDirection ?? Directionality.of(context);
    final artwork = artworkFor(icon);
    return Semantics(
      label: semanticLabel,
      child: ExcludeSemantics(
        child: Opacity(
          opacity: theme.opacity ?? 1,
          child: SizedBox.square(
            dimension: dimension,
            child: artwork != null
                ? App3dIcon(artwork, size: dimension)
                : icon == null
                ? const SizedBox.shrink()
                : Transform.flip(
                    flipX:
                        icon!.matchTextDirection &&
                        direction == TextDirection.rtl,
                    child: CustomPaint(
                      painter: _CeramicSymbolPainter(icon!, tint),
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

class _CeramicSymbolPainter extends CustomPainter {
  const _CeramicSymbolPainter(this.icon, this.color);
  final IconData icon;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final depth = size.shortestSide * .045;
    final dark = Color.lerp(color, AppColors.blackColor, .32)!;
    final light = Color.lerp(color, AppColors.whiteColor, .42)!;
    void draw(Paint paint, Offset shift) {
      final text = TextPainter(
        text: TextSpan(
          text: String.fromCharCode(icon.codePoint),
          style: TextStyle(
            fontSize: size.shortestSide * .88,
            fontFamily: icon.fontFamily,
            package: icon.fontPackage,
            foreground: paint,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      text.paint(
        canvas,
        Offset((size.width - text.width) / 2, (size.height - text.height) / 2) +
            shift,
      );
      text.dispose();
    }

    draw(
      Paint()
        ..color = dark.withValues(alpha: color.a * .24)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, depth),
      Offset(depth, depth * 2),
    );
    for (var layer = 3; layer > 0; layer--) {
      draw(Paint()..color = dark, Offset(depth * layer / 3, depth * layer / 3));
    }
    draw(
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [light, color, dark],
          stops: const [0, .48, 1],
        ).createShader(Offset.zero & size),
      Offset.zero,
    );
  }

  @override
  bool shouldRepaint(_CeramicSymbolPainter oldDelegate) =>
      oldDelegate.icon != icon || oldDelegate.color != color;
}
