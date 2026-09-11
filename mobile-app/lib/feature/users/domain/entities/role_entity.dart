import 'package:equatable/equatable.dart';

/// A system role and the permission codes it grants.
///
/// [displayName] arrives localized to the request locale, so it is shown as-is
/// and never mapped through a client-side table.
class RoleEntity extends Equatable {
  const RoleEntity({
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

  /// Company-level roles have no branch, so the form must not ask for one.
  /// The branch-scoped roles are the ones whose work is bounded by a branch.
  static const Set<String> branchScopedCodes = <String>{
    'BRANCH_SUPERVISOR',
    'REPRESENTATIVE',
  };

  bool get isBranchScoped => branchScopedCodes.contains(code);

  @override
  List<Object?> get props => <Object?>[
        id,
        code,
        displayName,
        description,
        isSystem,
        permissions,
        translations,
      ];
}

class RoleTranslation extends Equatable {
  const RoleTranslation({required this.displayName, this.description});
  final String displayName;
  final String? description;

  @override
  List<Object?> get props => <Object?>[displayName, description];
}
