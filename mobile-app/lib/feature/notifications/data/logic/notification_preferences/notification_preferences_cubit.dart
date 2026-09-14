import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/notifications/data/logic/notification_preferences/notification_preferences_state.dart';
import 'package:machinery/feature/notifications/domain/entities/notification_entity.dart';
import 'package:machinery/feature/notifications/domain/params/notification_preferences_params.dart';
import 'package:machinery/feature/notifications/domain/repos/notifications_repo.dart';

class NotificationPreferencesCubit extends Cubit<NotificationPreferencesState> {
  NotificationPreferencesCubit({required this.notificationsRepo})
    : super(const NotificationPreferencesInitial());

  final NotificationsRepo notificationsRepo;

  Future<void> load() async {
    if (isClosed) {
      return;
    }

    emit(const NotificationPreferencesLoading());

    final result = await notificationsRepo.fetchPreferences();

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) => emit(
        NotificationPreferencesFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      ),
      (NotificationPreferencesEntity preferences) => emit(
        NotificationPreferencesLoaded(preferences: preferences),
      ),
    );
  }

  Future<void> togglePush(NotificationTemplateCode code, {required bool value}) {
    return _toggle(code, push: value);
  }

  Future<void> toggleInApp(
    NotificationTemplateCode code, {
    required bool value,
  }) {
    return _toggle(code, inApp: value);
  }

  Future<void> _toggle(
    NotificationTemplateCode code, {
    bool? push,
    bool? inApp,
  }) async {
    final NotificationPreferencesState current = state;
    if (current is! NotificationPreferencesLoaded || current.isSaving) {
      return;
    }

    NotificationPreferenceEntry? entry;
    for (final NotificationPreferenceEntry e
        in current.preferences.preferences) {
      if (e.templateCode == code) {
        entry = e;
        break;
      }
    }

    if (entry == null) {
      return;
    }

    // Locked in-app channel cannot be switched off — mirror the server rule.
    if (inApp != null && entry.inAppLocked && !inApp) {
      return;
    }

    final NotificationPreferenceEntry optimistic = entry.copyWith(
      push: push,
      inApp: inApp,
    );

    emit(
      current.copyWith(
        isSaving: true,
        clearSaveError: true,
        preferences: current.preferences.copyWith(
          preferences: current.preferences.preferences
              .map(
                (NotificationPreferenceEntry e) =>
                    e.templateCode == code ? optimistic : e,
              )
              .toList(growable: false),
        ),
      ),
    );

    final result = await notificationsRepo.updatePreferences(
      params: UpdateNotificationPreferencesParams(
        preferences: <PreferenceUpdateEntry>[
          PreferenceUpdateEntry(
            templateCode: code,
            push: push,
            inApp: inApp,
          ),
        ],
      ),
    );

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) => emit(
        current.copyWith(
          isSaving: false,
          saveError: failure.errorMessage,
        ),
      ),
      (NotificationPreferencesEntity preferences) => emit(
        NotificationPreferencesLoaded(preferences: preferences),
      ),
    );
  }
}
