import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';

class NotificationUnreadDot extends StatelessWidget {
  const NotificationUnreadDot({super.key, this.visible = true});

  final bool visible;

  @override
  Widget build(BuildContext context) {
    if (!visible) {
      return const SizedBox(width: 8, height: 8);
    }

    return Container(
      width: 8,
      height: 8,
      decoration: const BoxDecoration(
        color: AppColors.badgeColor,
        shape: BoxShape.circle,
      ),
    );
  }
}
