import 'package:equatable/equatable.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/utils/enums.dart';

/// Partial `PUT /notification-preferences` body — only named templates change.
class UpdateNotificationPreferencesParams extends Equatable {
  const UpdateNotificationPreferencesParams({
    this.locale,
    this.preferences = const <PreferenceUpdateEntry>[],
  });

  final String? locale;
  final List<PreferenceUpdateEntry> preferences;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      if (locale != null) ApiKeys.locale: locale,
      if (preferences.isNotEmpty)
        ApiKeys.preferences: preferences
            .map((PreferenceUpdateEntry entry) => entry.toJson())
            .toList(growable: false),
    };
  }

  @override
  List<Object?> get props => <Object?>[locale, preferences];
}

class PreferenceUpdateEntry extends Equatable {
  const PreferenceUpdateEntry({
    required this.templateCode,
    this.push,
    this.inApp,
  });

  final NotificationTemplateCode templateCode;
  final bool? push;
  final bool? inApp;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      ApiKeys.templateCode: templateCode.value,
      if (push != null) ApiKeys.push: push,
      if (inApp != null) ApiKeys.inApp: inApp,
    };
  }

  @override
  List<Object?> get props => <Object?>[templateCode, push, inApp];
}
