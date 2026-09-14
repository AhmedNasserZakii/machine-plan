import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/notifications/domain/entities/notification_entity.dart';

class NotificationResponseModel {
  const NotificationResponseModel({required this.entity});

  final NotificationEntity entity;

  factory NotificationResponseModel.fromJson(Map<String, dynamic> json) {
    return NotificationResponseModel(
      entity: NotificationEntity(
        id: json[ApiKeys.id]?.toString() ?? '',
        templateCode: NotificationTemplateCode.fromJson(
          json[ApiKeys.templateCode] as String?,
        ),
        title: json[ApiKeys.title] as String? ?? '',
        body: json[ApiKeys.body] as String? ?? '',
        locale: json[ApiKeys.locale] as String? ?? '',
        entityType: json[ApiKeys.entityType] == null
            ? null
            : NotificationEntityType.fromJson(
                json[ApiKeys.entityType] as String?,
              ),
        entityId: json[ApiKeys.entityId]?.toString(),
        deepLink: json[ApiKeys.deepLink] as String?,
        data: _stringMap(json[ApiKeys.data]),
        isRead: json[ApiKeys.isRead] as bool? ?? false,
        readAt: _dateOrNull(json[ApiKeys.readAt]),
        pushStatus: json[ApiKeys.pushStatus] as String?,
        pushSkipReason: json[ApiKeys.pushSkipReason] as String?,
        createdAt: _dateOrNull(json[ApiKeys.createdAt]),
      ),
    );
  }

  NotificationEntity toEntity() => entity;

  static Map<String, String> _stringMap(dynamic raw) {
    if (raw is! Map) {
      return const <String, String>{};
    }
    return raw.map(
      (dynamic key, dynamic value) =>
          MapEntry<String, String>(key.toString(), value?.toString() ?? ''),
    );
  }

  static DateTime? _dateOrNull(dynamic value) {
    if (value is! String || value.isEmpty) return null;
    return DateTime.tryParse(value)?.toLocal();
  }
}

class NotificationPreferencesModel {
  const NotificationPreferencesModel({required this.entity});

  final NotificationPreferencesEntity entity;

  factory NotificationPreferencesModel.fromJson(Map<String, dynamic> json) {
    final List<Map<String, dynamic>> rows = json[ApiKeys.preferences] is List
        ? (json[ApiKeys.preferences] as List)
              .whereType<Map<String, dynamic>>()
              .toList(growable: false)
        : const <Map<String, dynamic>>[];

    return NotificationPreferencesModel(
      entity: NotificationPreferencesEntity(
        locale: json[ApiKeys.locale] as String? ?? '',
        preferences: rows
            .map(
              (Map<String, dynamic> row) => NotificationPreferenceEntry(
                templateCode: NotificationTemplateCode.fromJson(
                  row[ApiKeys.templateCode] as String?,
                ),
                push: row[ApiKeys.push] as bool? ?? true,
                inApp: row[ApiKeys.inApp] as bool? ?? true,
                inAppLocked: row[ApiKeys.inAppLocked] as bool? ?? false,
              ),
            )
            .toList(growable: false),
      ),
    );
  }

  NotificationPreferencesEntity toEntity() => entity;
}
