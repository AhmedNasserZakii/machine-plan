import 'package:equatable/equatable.dart';

/// One permission in the catalogue, with its label already localized.
class PermissionEntity extends Equatable {
  const PermissionEntity({
    required this.code,
    required this.group,
    required this.displayName,
    this.description,
  });

  final String code;
  final String group;
  final String displayName;
  final String? description;

  @override
  List<Object?> get props => <Object?>[code, group, displayName, description];
}

/// A module's worth of permissions — `GET /permissions` returns the catalogue
/// pre-grouped, which is exactly how the editor renders it.
class PermissionGroupEntity extends Equatable {
  const PermissionGroupEntity({
    required this.group,
    required this.label,
    required this.permissions,
  });

  final String group;
  final String label;
  final List<PermissionEntity> permissions;

  @override
  List<Object?> get props => <Object?>[group, label, permissions];
}
