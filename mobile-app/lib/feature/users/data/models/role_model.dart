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
  });

  final String id;
  final String code;
  final String displayName;
  final String? description;
  final bool isSystem;
  final List<String> permissions;

  factory RoleModel.fromJson(Map<String, dynamic> json) {
    final dynamic rawPermissions = json[ApiKeys.permissions];

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
    );
  }
}
