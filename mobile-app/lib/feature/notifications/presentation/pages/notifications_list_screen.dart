import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/paginated_list_view.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/notifications/data/logic/notifications_list/notifications_list_cubit.dart';
import 'package:machinery/feature/notifications/data/logic/notifications_list/notifications_list_state.dart';
import 'package:machinery/feature/notifications/domain/entities/notification_entity.dart';
import 'package:machinery/feature/notifications/presentation/helpers/notification_deep_link_router.dart';
import 'package:machinery/feature/notifications/presentation/helpers/notification_labels.dart';
import 'package:machinery/feature/notifications/presentation/widgets/mark_all_read_button.dart';
import 'package:machinery/feature/notifications/presentation/widgets/notification_tile.dart';
import 'package:machinery/feature/notifications/presentation/widgets/notifications_empty_state.dart';
import 'package:machinery/feature/notifications/presentation/widgets/notifications_group_header.dart';

class NotificationsListScreen extends StatefulWidget {
  const NotificationsListScreen({super.key});

  @override
  State<NotificationsListScreen> createState() =>
      _NotificationsListScreenState();
}

class _NotificationsListScreenState extends State<NotificationsListScreen> {
  @override
  void initState() {
    super.initState();
    context.read<NotificationsListCubit>().load();
  }

  Future<void> _openNotification(NotificationEntity notification) async {
    final NotificationsListCubit cubit = context.read<NotificationsListCubit>();
    await cubit.markRead(notification.id);

    if (!mounted) {
      return;
    }

    await NotificationDeepLinkRouter.open(context, notification.deepLink);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(LocaleKeys.notifications.tr()),
        actions: <Widget>[
          BlocBuilder<NotificationsListCubit, NotificationsListState>(
            builder: (BuildContext context, NotificationsListState state) {
              if (state is! NotificationsListLoaded) {
                return const SizedBox.shrink();
              }

              return MarkAllReadButton(
                enabled: state.hasUnread,
                isLoading: state.isMarkingAll,
                onPressed: () =>
                    context.read<NotificationsListCubit>().markAllRead(),
              );
            },
          ),
          IconButton(
            onPressed: () =>
                AppRoute.goToNotificationPreferences(context: context),
            tooltip: LocaleKeys.notificationPreferencesTitle.tr(),
            icon: Semantics(
              identifier: 'notifications_preferences_button',
              child: const Icon(Icons.settings_outlined),
            ),
          ),
        ],
      ),
      body: BlocBuilder<NotificationsListCubit, NotificationsListState>(
        builder: (BuildContext context, NotificationsListState state) {
          return switch (state) {
            NotificationsListFailure(
              :final String errorMessage,
              :final bool isOffline,
            ) =>
              AppErrorView(
                message: isOffline
                    ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                    : errorMessage,
                onRetry: () => context.read<NotificationsListCubit>().load(),
              ),
            NotificationsListLoaded() => _buildList(context, state),
            _ => const AppLoadingIndicator(),
          };
        },
      ),
    );
  }

  Widget _buildList(BuildContext context, NotificationsListLoaded state) {
    final NotificationsListCubit cubit = context.read<NotificationsListCubit>();

    return PaginatedListView<NotificationEntity>(
      items: state.notifications,
      hasNext: state.hasNext,
      isLoadingMore: state.isLoadingMore,
      onRefresh: () => cubit.load(showLoader: false),
      onLoadMore: cubit.loadMore,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      emptyState: const NotificationsEmptyState(),
      itemBuilder:
          (BuildContext context, NotificationEntity notification, int index) {
            final bool showHeader =
                index == 0 ||
                !NotificationLabels.isSameDayGroup(
                  state.notifications[index - 1].createdAt,
                  notification.createdAt,
                );

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                if (showHeader)
                  NotificationsGroupHeader(
                    label: NotificationLabels.dayGroup(notification.createdAt),
                  ),
                NotificationTile(
                  notification: notification,
                  onTap: () => _openNotification(notification),
                ),
              ],
            );
          },
    );
  }
}
