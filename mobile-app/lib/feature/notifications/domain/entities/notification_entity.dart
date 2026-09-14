import 'package:equatable/equatable.dart';
import 'package:machinery/core/utils/enums.dart';

/// One in-app notification row as returned by `GET /notifications`.
///
/// Title and body arrive pre-rendered in the recipient's locale — the app
/// never builds notification copy itself.
class NotificationEntity extends Equatable {
  const NotificationEntity({
    required this.id,
    required this.templateCode,
    required this.title,
    required this.body,
    required this.locale,
    required this.isRead,
    required this.data,
    this.entityType,
    this.entityId,
    this.deepLink,
    this.readAt,
    this.pushStatus,
    this.pushSkipReason,
    this.createdAt,
  });

  final String id;
  final NotificationTemplateCode templateCode;
  final String title;
  final String body;
  final String locale;
  final NotificationEntityType? entityType;
  final String? entityId;
  final String? deepLink;
  final Map<String, String> data;
  final bool isRead;
  final DateTime? readAt;
  final String? pushStatus;
  final String? pushSkipReason;
  final DateTime? createdAt;

  NotificationEntity copyWith({
    bool? isRead,
    DateTime? readAt,
  }) {
    return NotificationEntity(
      id: id,
      templateCode: templateCode,
      title: title,
      body: body,
      locale: locale,
      entityType: entityType,
      entityId: entityId,
      deepLink: deepLink,
      data: data,
      isRead: isRead ?? this.isRead,
      readAt: readAt ?? this.readAt,
      pushStatus: pushStatus,
      pushSkipReason: pushSkipReason,
      createdAt: createdAt,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    id,
    templateCode,
    title,
    body,
    locale,
    entityType,
    entityId,
    deepLink,
    data,
    isRead,
    readAt,
    pushStatus,
    pushSkipReason,
    createdAt,
  ];
}

/// Per-template channel choices returned by `GET /notification-preferences`.
class NotificationPreferencesEntity extends Equatable {
  const NotificationPreferencesEntity({
    required this.locale,
    required this.preferences,
  });

  final String locale;
  final List<NotificationPreferenceEntry> preferences;

  NotificationPreferencesEntity copyWith({
    String? locale,
    List<NotificationPreferenceEntry>? preferences,
  }) {
    return NotificationPreferencesEntity(
      locale: locale ?? this.locale,
      preferences: preferences ?? this.preferences,
    );
  }

  @override
  List<Object?> get props => <Object?>[locale, preferences];
}

class NotificationPreferenceEntry extends Equatable {
  const NotificationPreferenceEntry({
    required this.templateCode,
    required this.push,
    required this.inApp,
    required this.inAppLocked,
  });

  final NotificationTemplateCode templateCode;
  final bool push;
  final bool inApp;

  /// Server-locked for operationally critical templates (`TRANSFER_PENDING`).
  final bool inAppLocked;

  NotificationPreferenceEntry copyWith({
    bool? push,
    bool? inApp,
  }) {
    return NotificationPreferenceEntry(
      templateCode: templateCode,
      push: push ?? this.push,
      inApp: inApp ?? this.inApp,
      inAppLocked: inAppLocked,
    );
  }

  @override
  List<Object?> get props => <Object?>[templateCode, push, inApp, inAppLocked];
}
