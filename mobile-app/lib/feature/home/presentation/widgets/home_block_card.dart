import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/home/domain/entities/home_block.dart';

/// One dashboard tile. Same card shape for every block regardless of what it
/// is showing — [availability] alone decides whether that shape holds a
/// number, a spinner, an offline notice or a retryable error, so a screen
/// with all seven permissions never looks like seven different widgets.
///
/// Purely presentational: every string it shows, including the offline
/// notice and the retry tooltip, is resolved by the caller and handed in
/// already-translated — the same way [title]/[subtitle]/[errorMessage]
/// already work — so this widget carries no localization dependency at all
/// and is cheap to widget-test in isolation.
class HomeBlockCard extends StatelessWidget {
  const HomeBlockCard({
    required this.title,
    required this.icon,
    required this.color,
    required this.availability,
    required this.offlineText,
    required this.retryTooltip,
    super.key,
    this.valueText,
    this.subtitle,
    this.updatedCaption,
    this.errorMessage,
    this.onTap,
    this.onRetry,
  });

  final String title;
  final IconData icon;
  final Color color;
  final HomeBlockAvailability availability;

  /// Shown when [availability] is `offline`.
  final String offlineText;

  /// The retry icon button's tooltip, shown when [availability] is `error`.
  final String retryTooltip;

  /// Only meaningful when [availability] is `ready`.
  final String? valueText;
  final String? subtitle;
  final String? updatedCaption;

  /// Only meaningful when [availability] is `error`.
  final String? errorMessage;

  final VoidCallback? onTap;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Container(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: color.withValues(alpha: .08),
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: color.withValues(alpha: .25)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Icon(icon, color: color, size: 18),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Styles.s13(
                        context,
                      ).copyWith(color: AppColors.textSecondaryColor),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              _body(context),
            ],
          ),
        ),
      ),
    );
  }

  Widget _body(BuildContext context) {
    switch (availability) {
      case HomeBlockAvailability.loading:
        return SizedBox(
          height: 22,
          width: 22,
          child: CircularProgressIndicator(strokeWidth: 2, color: color),
        );

      case HomeBlockAvailability.ready:
        // At most one caption line under the value, ever: stacking the scope
        // subtitle and the last-updated caption together is what overflowed
        // a two-column grid cell first (caught by a widget test, not by eye).
        // Staleness is the more useful thing to say once there is any, so it
        // wins over the generic subtitle rather than being appended to it.
        final String? caption = updatedCaption ?? subtitle;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(valueText ?? '', style: Styles.s20(context).copyWith(color: color)),
            if (caption != null) ...<Widget>[
              const SizedBox(height: 2),
              Text(
                caption,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Styles.s12(
                  context,
                ).copyWith(color: AppColors.textSecondaryColor),
              ),
            ],
          ],
        );

      case HomeBlockAvailability.offline:
        return Row(
          children: <Widget>[
            const Icon(
              Icons.cloud_off_rounded,
              size: 16,
              color: AppColors.neutralColor,
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Text(
                offlineText,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Styles.s12(
                  context,
                ).copyWith(color: AppColors.neutralColor),
              ),
            ),
          ],
        );

      case HomeBlockAvailability.error:
        return Row(
          children: <Widget>[
            Expanded(
              child: Text(
                errorMessage ?? '',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Styles.s12(
                  context,
                ).copyWith(color: AppColors.dangerColor),
              ),
            ),
            if (onRetry != null)
              IconButton(
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                tooltip: retryTooltip,
                icon: const Icon(
                  Icons.refresh_rounded,
                  size: 18,
                  color: AppColors.dangerColor,
                ),
                onPressed: onRetry,
              ),
          ],
        );
    }
  }
}
