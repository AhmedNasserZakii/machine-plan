import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/feature/users/domain/entities/role_entity.dart';

/// `GET /roles`.
class RoleModel {
  const RoleModel({
    required this.id,
    required this.code,
    required this.displayName,
    required this.permissions,
    this.description,
    this.isSystem = false,
    this.translations = const <String, RoleTranslation>{},
  });

  final String id;
  final String code;
  final String displayName;
  final String? description;
  final bool isSystem;
  final List<String> permissions;
  final Map<String, RoleTranslation> translations;

  factory RoleModel.fromJson(Map<String, dynamic> json) {
    final dynamic rawPermissions = json[ApiKeys.permissions];

    final rawTranslations = json['translations'];
    final translations = <String, RoleTranslation>{};
    if (rawTranslations is Map<String, dynamic>) {
      for (final entry in rawTranslations.entries) {
        if (entry.value is Map<String, dynamic>) {
          final value = entry.value as Map<String, dynamic>;
          translations[entry.key] = RoleTranslation(
            displayName: value['displayName']?.toString() ?? '',
            description: value['description']?.toString(),
          );
        }
      }
    }
    return RoleModel(
      id: json[ApiKeys.id]?.toString() ?? '',
      code: json[ApiKeys.code] as String? ?? '',
      displayName:
          json[ApiKeys.displayName] as String? ??
          json[ApiKeys.name] as String? ??
          '',
      description: json[ApiKeys.description] as String?,
      isSystem: json[ApiKeys.isSystem] as bool? ?? false,
      permissions: rawPermissions is List
          ? rawPermissions.whereType<String>().toList(growable: false)
          : const <String>[],
      translations: Map<String, RoleTranslation>.unmodifiable(translations),
    );
  }

  RoleEntity toEntity() {
    return RoleEntity(
      id: id,
      code: code,
      displayName: displayName,
      description: description,
      isSystem: isSystem,
      permissions: permissions,
      translations: translations,
    );
  }
}
