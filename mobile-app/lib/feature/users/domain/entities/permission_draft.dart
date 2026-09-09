import 'package:equatable/equatable.dart';
import 'package:machinery/feature/users/domain/entities/user_permissions_entity.dart';

/// One pending change, used to spell out what is about to be saved.
class PermissionChange extends Equatable {
  const PermissionChange({
    required this.code,
    required this.from,
    required this.to,
  });

  final String code;
  final PermissionAssignment from;
  final PermissionAssignment to;

  @override
  List<Object?> get props => <Object?>[code, from, to];
}

/// The editable copy of a user's overrides.
///
/// Immutable on purpose: the cubit swaps one draft for the next, so an
/// interrupted edit can never leave half-applied state behind, and the
/// "unsaved changes" check is a comparison rather than a flag someone has to
/// remember to set.
class PermissionDraft extends Equatable {
  const PermissionDraft({
    required this.rolePermissions,
    required this.original,
    required this.overrides,
  });

  factory PermissionDraft.from(UserPermissionsEntity permissions) {
    return PermissionDraft(
      rolePermissions: permissions.rolePermissions,
      original: Map<String, PermissionEffect>.unmodifiable(
        permissions.overrides,
      ),
      overrides: Map<String, PermissionEffect>.unmodifiable(
        permissions.overrides,
      ),
    );
  }

  final Set<String> rolePermissions;

  /// The overrides as they were loaded, to diff against.
  final Map<String, PermissionEffect> original;

  /// The overrides as edited.
  final Map<String, PermissionEffect> overrides;

  bool grantedByRole(String code) => rolePermissions.contains(code);

  PermissionAssignment assignmentOf(String code) {
    return switch (overrides[code]) {
      PermissionEffect.allow => PermissionAssignment.allowed,
      PermissionEffect.deny => PermissionAssignment.denied,
      null => PermissionAssignment.inherited,
    };
  }

  /// What the user would actually be able to do if this draft were saved.
  bool effectivelyGranted(String code) {
    return switch (overrides[code]) {
      PermissionEffect.allow => true,
      PermissionEffect.deny => false,
      null => grantedByRole(code),
    };
  }

  /// Tapping a row walks `inherited → allowed → denied → inherited`, which
  /// keeps one gesture for the whole cycle and always offers a way back to
  /// "just do what the role says".
  PermissionDraft cycle(String code) {
    final Map<String, PermissionEffect> next =
        Map<String, PermissionEffect>.from(overrides);

    switch (assignmentOf(code)) {
      case PermissionAssignment.inherited:
        next[code] = PermissionEffect.allow;
      case PermissionAssignment.allowed:
        next[code] = PermissionEffect.deny;
      case PermissionAssignment.denied:
        next.remove(code);
    }

    return PermissionDraft(
      rolePermissions: rolePermissions,
      original: original,
      overrides: Map<String, PermissionEffect>.unmodifiable(next),
    );
  }

  PermissionDraft reset() {
    return PermissionDraft(
      rolePermissions: rolePermissions,
      original: original,
      overrides: original,
    );
  }

  /// Every code touched since load, in a stable order so the confirmation
  /// dialog does not reshuffle between builds.
  List<PermissionChange> get changes {
    final Set<String> touched = <String>{...original.keys, ...overrides.keys};

    final List<PermissionChange> result = touched
        .map((String code) {
          final PermissionAssignment from = _assignmentIn(original, code);
          final PermissionAssignment to = _assignmentIn(overrides, code);
          return PermissionChange(code: code, from: from, to: to);
        })
        .where((PermissionChange change) => change.from != change.to)
        .toList();

    result.sort(
      (PermissionChange a, PermissionChange b) => a.code.compareTo(b.code),
    );

    return List<PermissionChange>.unmodifiable(result);
  }

  bool get hasChanges => changes.isNotEmpty;

  /// How many overrides a module carries, for the collapsed group badge.
  int overrideCountIn(Iterable<String> codes) {
    return codes.where(overrides.containsKey).length;
  }

  List<String> get allowList => _codesWith(PermissionEffect.allow);

  List<String> get denyList => _codesWith(PermissionEffect.deny);

  List<String> _codesWith(PermissionEffect effect) {
    final List<String> codes = overrides.entries
        .where((MapEntry<String, PermissionEffect> e) => e.value == effect)
        .map((MapEntry<String, PermissionEffect> e) => e.key)
        .toList();
    codes.sort();
    return List<String>.unmodifiable(codes);
  }

  static PermissionAssignment _assignmentIn(
    Map<String, PermissionEffect> source,
    String code,
  ) {
    return switch (source[code]) {
      PermissionEffect.allow => PermissionAssignment.allowed,
      PermissionEffect.deny => PermissionAssignment.denied,
      null => PermissionAssignment.inherited,
    };
  }

  @override
  List<Object?> get props => <Object?>[rolePermissions, original, overrides];
}
