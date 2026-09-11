import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/feature/users/domain/entities/permission_catalogue_entity.dart';

/// `GET /permissions` — the catalogue, already grouped by module and localized.
class PermissionGroupModel {
  const PermissionGroupModel({
    required this.group,
    required this.label,
    required this.permissions,
  });

  final String group;
  final String label;
  final List<PermissionModel> permissions;

  factory PermissionGroupModel.fromJson(Map<String, dynamic> json) {
    final dynamic rawPermissions = json[ApiKeys.permissions];

    return PermissionGroupModel(
      group: json[ApiKeys.group] as String? ?? '',
      label: json[ApiKeys.label] as String? ?? '',
      permissions: rawPermissions is List
          ? rawPermissions
              .whereType<Map<String, dynamic>>()
              .map(PermissionModel.fromJson)
              .toList(growable: false)
          : const <PermissionModel>[],
    );
  }

  PermissionGroupEntity toEntity() {
    return PermissionGroupEntity(
      group: group,
      label: label,
      permissions: permissions
          .map((PermissionModel p) => p.toEntity())
          .toList(growable: false),
    );
  }
}

class PermissionModel {
  const PermissionModel({
    required this.code,
    required this.group,
    required this.displayName,
    this.description,
  });

  final String code;
  final String group;
  final String displayName;
  final String? description;

  factory PermissionModel.fromJson(Map<String, dynamic> json) {
    return PermissionModel(
      code: json[ApiKeys.code] as String? ?? '',
      group: json[ApiKeys.group] as String? ?? '',
      displayName: json[ApiKeys.displayName] as String? ?? '',
      description: json[ApiKeys.description] as String?,
    );
  }

  PermissionEntity toEntity() {
    return PermissionEntity(
      code: code,
      group: group,
      displayName: displayName,
      description: description,
    );
  }
}
