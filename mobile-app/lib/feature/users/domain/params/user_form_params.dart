import 'package:equatable/equatable.dart';
import 'package:machinery/core/constants/api_keys.dart';

/// `POST /users`. Every field the backend marks required is non-nullable here,
/// so a malformed create cannot be constructed in the first place.
class CreateUserParams extends Equatable {
  const CreateUserParams({
    required this.fullName,
    required this.phone,
    required this.roleId,
    required this.password,
    this.email,
    this.branchId,
  });

  final String fullName;
  final String phone;
  final String roleId;
  final String password;
  final String? email;

  /// Only sent for branch-scoped roles; the API rejects a branch on a
  /// company-level role.
  final String? branchId;

  Map<String, dynamic> toJson() {
    final String? trimmedEmail = email?.trim();

    return <String, dynamic>{
      ApiKeys.fullName: fullName.trim(),
      ApiKeys.phone: phone.trim(),
      ApiKeys.roleId: roleId,
      ApiKeys.password: password,
      if (trimmedEmail != null && trimmedEmail.isNotEmpty)
        ApiKeys.email: trimmedEmail,
      if (branchId != null) ApiKeys.branchId: branchId,
    };
  }

  @override
  List<Object?> get props => <Object?>[
    fullName,
    phone,
    roleId,
    password,
    email,
    branchId,
  ];
}

/// `PATCH /users/:id`. Everything is optional, and null is meaningful for
/// `email` and `branchId` — it clears them — so those are sent explicitly
/// when the caller asks for it rather than being dropped.
class UpdateUserParams extends Equatable {
  const UpdateUserParams({
    this.fullName,
    this.phone,
    this.email,
    this.roleId,
    this.branchId,
    this.clearEmail = false,
    this.clearBranch = false,
  });

  final String? fullName;
  final String? phone;
  final String? email;
  final String? roleId;
  final String? branchId;

  final bool clearEmail;
  final bool clearBranch;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      if (fullName != null) ApiKeys.fullName: fullName!.trim(),
      if (phone != null) ApiKeys.phone: phone!.trim(),
      if (clearEmail)
        ApiKeys.email: null
      else if (email != null)
        ApiKeys.email: email!.trim(),
      if (roleId != null) ApiKeys.roleId: roleId,
      if (clearBranch)
        ApiKeys.branchId: null
      else if (branchId != null)
        ApiKeys.branchId: branchId,
    };
  }

  bool get isEmpty => toJson().isEmpty;

  @override
  List<Object?> get props => <Object?>[
    fullName,
    phone,
    email,
    roleId,
    branchId,
    clearEmail,
    clearBranch,
  ];
}
