import 'package:flutter/material.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/shared_widgets/clicked_widget.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/notifications/domain/entities/notification_entity.dart';
import 'package:machinery/feature/notifications/presentation/widgets/notification_unread_dot.dart';

class NotificationTile extends StatelessWidget {
  const NotificationTile({
    required this.notification,
    required this.onTap,
    super.key,
  });

  final NotificationEntity notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bool unread = !notification.isRead;

    return Semantics(
      identifier: 'notification_tile_${notification.id}',
      child: ClickedWidget(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: unread
                ? AppColors.infoSurfaceColor
                : AppColors.surfaceColor,
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: AppColors.borderColor),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Padding(
                padding: const EdgeInsetsDirectional.only(top: 6),
                child: NotificationUnreadDot(visible: unread),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      notification.title,
                      style: Styles.s15(context).copyWith(
                        fontWeight: unread ? FontWeight.w700 : FontWeight.w500,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (notification.body.isNotEmpty) ...<Widget>[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        notification.body,
                        style: Styles.s13(context).copyWith(
                          color: AppColors.textSecondaryColor,
                        ),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    if (notification.createdAt != null) ...<Widget>[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        Formatters.dateTime(notification.createdAt!),
                        style: Styles.s12(context).copyWith(
                          color: AppColors.textDisabledColor,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
