import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/notifications/domain/entities/notification_entity.dart';
import 'package:machinery/feature/notifications/presentation/helpers/notification_labels.dart';

class PreferenceSwitchTile extends StatelessWidget {
  const PreferenceSwitchTile({
    required this.entry,
    required this.onPushChanged,
    required this.onInAppChanged,
    super.key,
  });

  final NotificationPreferenceEntry entry;
  final ValueChanged<bool> onPushChanged;
  final ValueChanged<bool> onInAppChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surfaceColor,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            NotificationLabels.template(entry.templateCode),
            style: Styles.s15(context).copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: AppSpacing.sm),
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: Text(
              LocaleKeys.notificationsChannelPush.tr(),
              style: Styles.s14(context),
            ),
            value: entry.push,
            onChanged: onPushChanged,
          ),
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: Text(
              LocaleKeys.notificationsChannelInApp.tr(),
              style: Styles.s14(context),
            ),
            subtitle: entry.inAppLocked
                ? Text(
                    LocaleKeys.notificationsInAppLockedHint.tr(),
                    style: Styles.s12(context).copyWith(
                      color: AppColors.textSecondaryColor,
                    ),
                  )
                : null,
            value: entry.inApp,
            onChanged: entry.inAppLocked ? null : onInAppChanged,
          ),
        ],
      ),
    );
  }
}
