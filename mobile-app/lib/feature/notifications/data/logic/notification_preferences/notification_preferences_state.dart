import 'package:equatable/equatable.dart';
import 'package:machinery/feature/notifications/domain/entities/notification_entity.dart';

sealed class NotificationPreferencesState extends Equatable {
  const NotificationPreferencesState();

  @override
  List<Object?> get props => <Object?>[];
}

class NotificationPreferencesInitial extends NotificationPreferencesState {
  const NotificationPreferencesInitial();
}

class NotificationPreferencesLoading extends NotificationPreferencesState {
  const NotificationPreferencesLoading();
}

class NotificationPreferencesLoaded extends NotificationPreferencesState {
  const NotificationPreferencesLoaded({
    required this.preferences,
    this.isSaving = false,
    this.saveError,
  });

  final NotificationPreferencesEntity preferences;
  final bool isSaving;
  final String? saveError;

  NotificationPreferencesLoaded copyWith({
    NotificationPreferencesEntity? preferences,
    bool? isSaving,
    String? saveError,
    bool clearSaveError = false,
  }) {
    return NotificationPreferencesLoaded(
      preferences: preferences ?? this.preferences,
      isSaving: isSaving ?? this.isSaving,
      saveError: clearSaveError ? null : (saveError ?? this.saveError),
    );
  }

  @override
  List<Object?> get props => <Object?>[preferences, isSaving, saveError];
}

class NotificationPreferencesFailure extends NotificationPreferencesState {
  const NotificationPreferencesFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}
