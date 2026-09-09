import 'package:flutter/foundation.dart';
import 'package:machinery/core/local_storage/local_storage.dart';

/// Holds the permission list the whole UI is built from.
///
/// The list is a `ValueNotifier` so navigation and every `PermissionGate`
/// rebuild the moment the Director grants or revokes access — no restart, no
/// manual refresh. `AuthCubit` is the only writer.
///
/// Client-side gating is UX, not security. The server enforces the real
/// boundary on every request, which is why a stale list offline is acceptable.
class PermissionService {
  PermissionService() {
    permissions = ValueNotifier<List<String>>(
      LocalStorage.getCachedPermissions(),
    );
  }

  late final ValueNotifier<List<String>> permissions;

  List<String> get _current => permissions.value;

  bool has(String permission) => _current.contains(permission);

  bool hasAny(List<String> candidates) => candidates.any(has);

  bool hasAll(List<String> candidates) => candidates.every(has);

  /// True when the user can see beyond their own branch.
  bool canSeeAllBranches(String resource) => has('$resource.read.all');

  /// Called by `AuthCubit` after every successful `/auth/me` and login.
  Future<void> update(List<String> updated) async {
    if (listEquals(_current, updated)) {
      return;
    }
    permissions.value = List<String>.unmodifiable(updated);
    await LocalStorage.setCachedPermissions(updated);
  }

  Future<void> clear() async {
    permissions.value = const <String>[];
    LocalStorage.deleteCachedPermissions();
  }
}
