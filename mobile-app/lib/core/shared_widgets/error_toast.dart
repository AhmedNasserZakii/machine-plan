import 'package:easy_localization/easy_localization.dart';
import 'package:elegant_notification/elegant_notification.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/connection/network_connection_status.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/network_services/unauthorized_session_handler.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

String? _lastErrorMessage;
DateTime? _lastErrorShownAt;

/// The one error surface for request failures. Screens stay put and show this;
/// they never navigate to a dedicated failure page for an API error.
void showErrorToast(String message, BuildContext context, {double? height}) {
  if (UnauthorizedSessionHandler.shouldSuppressErrorToast) {
    return;
  }

  final String displayedMessage = trExists(message) ? message.tr() : message;

  // Losing the network is handled by the offline banner, not a toast.
  if (message == LocaleKeys.noInternetConnection ||
      displayedMessage == LocaleKeys.noInternetConnection.tr()) {
    reportNetworkConnectionStatus(false);
    return;
  }

  final DateTime now = DateTime.now();
  final bool isDuplicate =
      displayedMessage == _lastErrorMessage &&
      _lastErrorShownAt != null &&
      now.difference(_lastErrorShownAt!) < const Duration(seconds: 5);

  if (isDuplicate) {
    return;
  }

  _lastErrorMessage = displayedMessage;
  _lastErrorShownAt = now;

  ElegantNotification.error(
    title: Text(
      LocaleKeys.error.tr(),
      style: Styles.s15(context).copyWith(color: AppColors.dangerColor),
    ),
    description: Text(
      displayedMessage,
      maxLines: 4,
      softWrap: true,
      overflow: TextOverflow.fade,
      style: Styles.s14(context).copyWith(color: AppColors.dangerColor),
    ),
    icon: const Icon(
      Icons.error_outline_rounded,
      color: AppColors.dangerColor,
      size: 28,
    ),
    background: AppColors.surfaceColor,
    height: height ?? _resolveToastHeight(displayedMessage),
    width: MediaQuery.sizeOf(context).width * 0.9,
    borderRadius: BorderRadius.circular(AppRadius.md),
    animationDuration: const Duration(milliseconds: 600),
    toastDuration: const Duration(seconds: 5),
    autoDismiss: true,
    progressIndicatorBackground: AppColors.dividerColor,
    verticalDividerColor: AppColors.dividerColor,
  ).show(context);
}

/// Backend messages can be long; a fixed tiny height clips them.
double _resolveToastHeight(String message) {
  final int lineBreaks = '\n'.allMatches(message).length;
  final int estimatedLineCount =
      (message.length / 34).ceil().clamp(1, 4) + lineBreaks;

  return switch (estimatedLineCount) {
    <= 1 => 90,
    2 => 108,
    3 => 124,
    _ => 140,
  };
}
