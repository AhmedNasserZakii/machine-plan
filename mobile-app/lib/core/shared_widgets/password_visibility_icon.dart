import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';

class PasswordVisibilityIcon extends StatelessWidget {
  const PasswordVisibilityIcon({required this.isVisible, super.key});

  final bool isVisible;

  @override
  Widget build(BuildContext context) {
    return Icon(
      isVisible ? Icons.visibility_outlined : Icons.visibility_off_outlined,
      size: 20,
      color: AppColors.textSecondaryColor,
    );
  }
}
