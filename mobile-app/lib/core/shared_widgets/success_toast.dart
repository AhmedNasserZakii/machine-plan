import 'package:easy_localization/easy_localization.dart';
import 'package:elegant_notification/elegant_notification.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

void showSuccessToast(String message, BuildContext context, {double? height}) {
  final String displayedMessage = trExists(message) ? message.tr() : message;

  ElegantNotification.success(
    title: Text(
      LocaleKeys.success.tr(),
      style: Styles.s15(context).copyWith(color: AppColors.successColor),
    ),
    description: Text(
      displayedMessage,
      maxLines: 4,
      softWrap: true,
      overflow: TextOverflow.fade,
      style: Styles.s14(context).copyWith(color: AppColors.successColor),
    ),
    icon: const Icon(
      Icons.check_circle_outline_rounded,
      color: AppColors.successColor,
      size: 28,
    ),
    background: AppColors.surfaceColor,
    height: height ?? 100,
    width: MediaQuery.sizeOf(context).width * 0.9,
    borderRadius: BorderRadius.circular(AppRadius.md),
    animationDuration: const Duration(milliseconds: 600),
    toastDuration: const Duration(seconds: 4),
    autoDismiss: true,
    progressIndicatorBackground: AppColors.dividerColor,
    verticalDividerColor: AppColors.dividerColor,
  ).show(context);
}
