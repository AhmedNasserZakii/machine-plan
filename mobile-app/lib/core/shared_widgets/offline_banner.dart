import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/connection/network_connection_status.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

/// A thin persistent strip, not a blocking screen. The app is offline-first:
/// losing the network changes what happens to writes, it does not stop work.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: networkConnectionStatus,
      builder: (context, isConnected, _) {
        if (isConnected) {
          return const SizedBox.shrink();
        }

        return Container(
          width: double.infinity,
          color: AppColors.offlineBannerColor,
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              const Icon(
                Icons.wifi_off_rounded,
                size: 16,
                color: AppColors.textOnPrimaryColor,
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                LocaleKeys.offlineBannerMessage.tr(),
                style: Styles.s12(
                  context,
                ).copyWith(color: AppColors.textOnPrimaryColor),
              ),
            ],
          ),
        );
      },
    );
  }
}
