import 'package:flutter/material.dart';
import 'package:machinery/core/shared_widgets/clicked_widget.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

class MoreTile extends StatelessWidget {
  const MoreTile({
    required this.icon,
    required this.label,
    required this.onTap,
    super.key,
    this.trailingLabel,
    this.isDestructive = false,
    this.identifier,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  /// Right-hand value, e.g. the current language or a pending count.
  final String? trailingLabel;
  final bool isDestructive;
  final String? identifier;

  @override
  Widget build(BuildContext context) {
    final Color accent = isDestructive
        ? AppColors.dangerColor
        : AppColors.textPrimaryColor;

    final Widget tile = ClickedWidget(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
          vertical: 14,
        ),
        child: Row(
          children: <Widget>[
            Icon(icon, size: 22, color: accent),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                label,
                style: Styles.s15(context).copyWith(color: accent),
              ),
            ),
            if (trailingLabel != null) ...<Widget>[
              Text(
                trailingLabel!,
                style: Styles.s13(
                  context,
                ).copyWith(color: AppColors.textSecondaryColor),
              ),
              const SizedBox(width: AppSpacing.sm),
            ],
            if (!isDestructive)
              const Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: AppColors.textSecondaryColor,
              ),
          ],
        ),
      ),
    );

    if (identifier == null) {
      return tile;
    }

    return Semantics(identifier: identifier, child: tile);
  }
}
