import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';

class NotificationsEmptyState extends StatelessWidget {
  const NotificationsEmptyState({super.key});

  @override
  Widget build(BuildContext context) {
    return AppEmptyState(
      icon: Icons.notifications_none_rounded,
      title: LocaleKeys.notificationsEmptyTitle.tr(),
      subtitle: LocaleKeys.notificationsEmptySubtitle.tr(),
    );
  }
}
