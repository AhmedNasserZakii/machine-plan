import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/utils/enums.dart';

/// Turns seeded system role codes into the words a user reads. Custom roles
/// keep the server [fallback] name so back-office renames still show through.
abstract class RoleLabels {
  static String label(SystemRole role) {
    return switch (role) {
      SystemRole.director => LocaleKeys.systemRoleDirector,
      SystemRole.branchSupervisor => LocaleKeys.systemRoleBranchSupervisor,
      SystemRole.representative => LocaleKeys.systemRoleRepresentative,
      SystemRole.accountant => LocaleKeys.systemRoleAccountant,
      SystemRole.viewer => LocaleKeys.systemRoleViewer,
      SystemRole.unknown => LocaleKeys.systemRoleUnknown,
    }.tr();
  }

  /// Prefer a localized system role; otherwise keep whatever the API sent.
  static String resolve(String? code, {required String fallback}) {
    final SystemRole role = SystemRole.fromJson(code);
    if (role == SystemRole.unknown) {
      return fallback;
    }
    return label(role);
  }
}
