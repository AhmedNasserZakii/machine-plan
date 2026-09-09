import 'package:equatable/equatable.dart';
import 'package:machinery/feature/users/domain/entities/permission_catalogue_entity.dart';
import 'package:machinery/feature/users/domain/entities/permission_draft.dart';

abstract class UserPermissionsState extends Equatable {
  const UserPermissionsState();

  @override
  List<Object?> get props => <Object?>[];
}

class UserPermissionsLoading extends UserPermissionsState {
  const UserPermissionsLoading();
}

class UserPermissionsReady extends UserPermissionsState {
  const UserPermissionsReady({
    required this.groups,
    required this.draft,
    this.searchTerm = '',
    this.expandedGroups = const <String>{},
    this.isSaving = false,
  });

  final List<PermissionGroupEntity> groups;
  final PermissionDraft draft;
  final String searchTerm;

  /// Groups start collapsed; the badge tells the Director which ones are worth
  /// opening.
  final Set<String> expandedGroups;
  final bool isSaving;

  bool get hasChanges => draft.hasChanges;

  bool get isSearching => searchTerm.trim().isNotEmpty;

  /// While searching, every group opens and only matching rows survive — an
  /// empty group is dropped rather than shown as an empty header.
  List<PermissionGroupEntity> get visibleGroups {
    final String term = searchTerm.trim().toLowerCase();
    if (term.isEmpty) {
      return groups;
    }

    return groups
        .map((PermissionGroupEntity group) {
          final List<PermissionEntity> matches = group.permissions
              .where(
                (PermissionEntity p) =>
                    p.displayName.toLowerCase().contains(term) ||
                    p.code.toLowerCase().contains(term),
              )
              .toList(growable: false);

          return PermissionGroupEntity(
            group: group.group,
            label: group.label,
            permissions: matches,
          );
        })
        .where((PermissionGroupEntity group) => group.permissions.isNotEmpty)
        .toList(growable: false);
  }

  bool isExpanded(String group) =>
      isSearching || expandedGroups.contains(group);

  UserPermissionsReady copyWith({
    List<PermissionGroupEntity>? groups,
    PermissionDraft? draft,
    String? searchTerm,
    Set<String>? expandedGroups,
    bool? isSaving,
  }) {
    return UserPermissionsReady(
      groups: groups ?? this.groups,
      draft: draft ?? this.draft,
      searchTerm: searchTerm ?? this.searchTerm,
      expandedGroups: expandedGroups ?? this.expandedGroups,
      isSaving: isSaving ?? this.isSaving,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    groups,
    draft,
    searchTerm,
    expandedGroups,
    isSaving,
  ];
}

class UserPermissionsLoadFailure extends UserPermissionsState {
  const UserPermissionsLoadFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}

class UserPermissionsSaved extends UserPermissionsState {
  const UserPermissionsSaved();
}

class UserPermissionsSaveFailure extends UserPermissionsState {
  const UserPermissionsSaveFailure({required this.errorMessage});

  final String errorMessage;

  @override
  List<Object?> get props => <Object?>[errorMessage];
}
