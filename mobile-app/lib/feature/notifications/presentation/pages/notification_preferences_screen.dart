import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/notifications/data/logic/notification_preferences/notification_preferences_cubit.dart';
import 'package:machinery/feature/notifications/data/logic/notification_preferences/notification_preferences_state.dart';
import 'package:machinery/feature/notifications/domain/entities/notification_entity.dart';
import 'package:machinery/feature/notifications/presentation/widgets/preference_switch_tile.dart';
import 'package:machinery/feature/notifications/presentation/widgets/quiet_hours_field.dart';

class NotificationPreferencesScreen extends StatefulWidget {
  const NotificationPreferencesScreen({super.key});

  @override
  State<NotificationPreferencesScreen> createState() =>
      _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState
    extends State<NotificationPreferencesScreen> {
  @override
  void initState() {
    super.initState();
    context.read<NotificationPreferencesCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(LocaleKeys.notificationPreferencesTitle.tr()),
      ),
      body: BlocConsumer<
        NotificationPreferencesCubit,
        NotificationPreferencesState
      >(
        listener:
            (
              BuildContext context,
              NotificationPreferencesState state,
            ) {
              if (state is NotificationPreferencesLoaded &&
                  state.saveError != null &&
                  state.saveError!.isNotEmpty) {
                showErrorToast(state.saveError!, context);
              }
            },
        builder:
            (BuildContext context, NotificationPreferencesState state) {
              return switch (state) {
                NotificationPreferencesFailure(
                  :final String errorMessage,
                  :final bool isOffline,
                ) =>
                  AppErrorView(
                    message: isOffline
                        ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                        : errorMessage,
                    onRetry: () =>
                        context.read<NotificationPreferencesCubit>().load(),
                  ),
                NotificationPreferencesLoaded(:final preferences) =>
                  _buildBody(context, preferences),
                _ => const AppLoadingIndicator(),
              };
            },
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    NotificationPreferencesEntity preferences,
  ) {
    final NotificationPreferencesCubit cubit = context
        .read<NotificationPreferencesCubit>();

    // DIGEST is system-generated; hide it from channel toggles.
    final List<NotificationPreferenceEntry> entries = preferences.preferences
        .where(
          (NotificationPreferenceEntry e) =>
              e.templateCode != NotificationTemplateCode.digest &&
              e.templateCode != NotificationTemplateCode.unknown,
        )
        .toList(growable: false);

    return ListView(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      children: <Widget>[
        const QuietHoursField(),
        const SizedBox(height: AppSpacing.lg),
        ...entries.map(
          (NotificationPreferenceEntry entry) => PreferenceSwitchTile(
            entry: entry,
            onPushChanged: (bool value) =>
                cubit.togglePush(entry.templateCode, value: value),
            onInAppChanged: (bool value) =>
                cubit.toggleInApp(entry.templateCode, value: value),
          ),
        ),
      ],
    );
  }
}
