import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

/// A titled block on a detail screen.
class DetailCard extends StatelessWidget {
  const DetailCard({
    required this.title,
    required this.children,
    super.key,
    this.icon,
    this.trailing,
  });

  final String title;
  final IconData? icon;
  final Widget? trailing;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
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
              if (icon != null) ...<Widget>[
                Icon(icon, size: 18, color: AppColors.textSecondaryColor),
                const SizedBox(width: AppSpacing.sm),
              ],
              Expanded(
                child: Text(
                  title,
                  style: Styles.s15(
                    context,
                  ).copyWith(fontWeight: FontWeight.w600),
                ),
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          ...children,
        ],
      ),
    );
  }
}

/// A label/value line inside a [DetailCard]. Renders nothing when the value is
/// missing, so a half-filled record does not become a wall of dashes.
class DetailRow extends StatelessWidget {
  const DetailRow({
    required this.label,
    this.value,
    this.valueWidget,
    this.valueColor,
    super.key,
  });

  final String label;
  final String? value;
  final Widget? valueWidget;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    if (valueWidget == null && (value == null || value!.isEmpty)) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Expanded(
            child: Text(
              label,
              style: Styles.s13(
                context,
              ).copyWith(color: AppColors.textSecondaryColor),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Align(
              alignment: AlignmentDirectional.centerEnd,
              child:
                  valueWidget ??
                  Text(
                    value!,
                    textAlign: TextAlign.end,
                    style: Styles.s14(
                      context,
                    ).copyWith(color: valueColor, fontWeight: FontWeight.w500),
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The quiet explanatory line under a card's rows — the place a rule gets
/// stated once instead of being learned from a rejected save.
class DetailNote extends StatelessWidget {
  const DetailNote(this.text, {super.key, this.icon, this.color});

  final String text;
  final IconData? icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final Color resolved = color ?? AppColors.textSecondaryColor;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Icon(icon ?? Icons.info_outline_rounded, size: 14, color: resolved),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            text,
            style: Styles.s12(context).copyWith(color: resolved),
          ),
        ),
      ],
    );
  }
}
