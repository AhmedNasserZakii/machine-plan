import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/status_chip.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';

/// Active or suspended. A deactivated account is the one thing on the row that
/// changes what the reader should do, so it never relies on colour alone.
class UserStatusChip extends StatelessWidget {
  const UserStatusChip({required this.isActive, super.key});

  final bool isActive;

  @override
  Widget build(BuildContext context) {
    return StatusChip(
      label: isActive
          ? LocaleKeys.userActive.tr()
          : LocaleKeys.userInactive.tr(),
      color: isActive ? AppColors.successColor : AppColors.neutralColor,
      icon: isActive
          ? Icons.check_circle_outline_rounded
          : Icons.block_outlined,
    );
  }
}
