import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

/// Initials on a tinted disc. There are no profile photos in this system, so
/// this is the only avatar there will ever be.
class UserAvatar extends StatelessWidget {
  const UserAvatar({required this.fullName, super.key, this.size = 44});

  final String fullName;
  final double size;

  /// First letters of the first two words: "أحمد ناصر" reads as "أن".
  static String initialsOf(String name) {
    final List<String> words = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((String word) => word.isNotEmpty)
        .toList();

    if (words.isEmpty) {
      return '؟';
    }

    return words.take(2).map((String word) => word.characters.first).join();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        color: AppColors.primaryLightColor,
        shape: BoxShape.circle,
      ),
      child: Text(
        initialsOf(fullName),
        style: Styles.s15(
          context,
        ).copyWith(color: AppColors.primaryColor, fontWeight: FontWeight.w700),
      ),
    );
  }
}
