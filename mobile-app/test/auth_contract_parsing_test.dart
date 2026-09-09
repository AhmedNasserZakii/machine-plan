import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/feature/auth/data/models/auth_profile_response_model.dart';
import 'package:machinery/feature/auth/data/models/auth_session_response_model.dart';

/// Guards the two auth payload shapes. A silent change to either one shows up
/// here as a failed expectation instead of as a user who skips the forced
/// password change, which is how it was found the first time.
void main() {
  Map<String, dynamic> dataOf(String body) {
    return (jsonDecode(body) as Map<String, dynamic>)['data']
        as Map<String, dynamic>;
  }

  test('POST /auth/login carries the tokens and the password-change flag', () {
    final AuthSessionResponseModel session =
        AuthSessionResponseModel.fromDataJson(
          dataOf('''
{
  "success": true,
  "data": {
    "accessToken": "access-token-01000000002",
    "refreshToken": "refresh-token-01000000002",
    "expiresIn": 900,
    "refreshExpiresAt": "2099-01-01T00:00:00Z",
    "mustChangePassword": true
  }
}
'''),
        );

    expect(session.accessToken, 'access-token-01000000002');
    expect(session.refreshToken, 'refresh-token-01000000002');
    expect(session.mustChangePassword, isTrue);
  });

  test('GET /auth/me is flat, with role and branch as nested objects', () {
    final AuthProfileResponseModel profile =
        AuthProfileResponseModel.fromDataJson(
          dataOf('''
{
  "success": true,
  "data": {
    "id": "u-002",
    "fullName": "منى سعيد",
    "phone": "01000000002",
    "email": "mona@example.com",
    "role": { "code": "SUPERVISOR", "name": "Supervisor" },
    "branch": { "id": "b-002", "name": "فرع طنطا" },
    "mustChangePassword": true,
    "permissions": ["machines.read", "transfers.read"]
  }
}
'''),
        );

    expect(profile.user.name, 'منى سعيد');
    expect(profile.user.roleName, 'Supervisor');
    expect(profile.user.branchName, 'فرع طنطا');
    expect(profile.user.mustChangePassword, isTrue);
    expect(profile.permissions, <String>['machines.read', 'transfers.read']);
  });

  test('a company-level user with no branch parses instead of throwing', () {
    final AuthProfileResponseModel profile =
        AuthProfileResponseModel.fromDataJson(
          dataOf('''
{
  "success": true,
  "data": {
    "id": "u-009",
    "fullName": "مدير عام",
    "phone": "01000000009",
    "role": { "code": "DIRECTOR", "name": "Director" },
    "branch": null,
    "mustChangePassword": false,
    "permissions": []
  }
}
'''),
        );

    expect(profile.user.branchId, isNull);
    expect(profile.user.branchName, isNull);
    expect(profile.permissions, isEmpty);
  });

  test('the payload recorded from the running API parses field for field', () {
    // Captured verbatim from `GET /auth/me` on the local backend, signed in as the
    // seeded Cairo supervisor. Anything the server renames breaks this first.
    final AuthProfileResponseModel profile =
        AuthProfileResponseModel.fromDataJson(
          dataOf('''
{
  "success": true,
  "data": {
    "id": "7fcd822b-3b2e-4ef8-baba-334394d76f4b",
    "fullName": "مشرف فرع القاهرة",
    "phone": "01000000002",
    "email": null,
    "role": { "code": "BRANCH_SUPERVISOR", "name": "مشرف فرع" },
    "branch": {
      "id": "84177053-e1af-454c-93bb-92ea822ede1a",
      "name": "فرع القاهرة"
    },
    "permissions": [
      "machines.read",
      "machines.update",
      "transfers.confirm",
      "violations.create"
    ],
    "mustChangePassword": false,
    "biometricEnabled": false,
    "signatureImageUrl": null
  }
}
'''),
        );

    expect(profile.user.id, '7fcd822b-3b2e-4ef8-baba-334394d76f4b');
    expect(profile.user.name, 'مشرف فرع القاهرة');
    expect(profile.user.phone, '01000000002');
    expect(profile.user.email, isNull);
    expect(profile.user.roleCode, 'BRANCH_SUPERVISOR');
    expect(profile.user.roleName, 'مشرف فرع');
    expect(profile.user.branchId, '84177053-e1af-454c-93bb-92ea822ede1a');
    expect(profile.user.branchName, 'فرع القاهرة');
    expect(profile.user.mustChangePassword, isFalse);
    expect(profile.permissions, contains('transfers.confirm'));
  });

  test('the cached profile round-trips through the same parser', () {
    final AuthProfileResponseModel original =
        AuthProfileResponseModel.fromDataJson(
          dataOf('''
{
  "success": true,
  "data": {
    "id": "u-001",
    "fullName": "أحمد ناصر",
    "phone": "01000000001",
    "role": { "code": "DIRECTOR", "name": "Director" },
    "branch": { "id": "b-001", "name": "الفرع الرئيسي" },
    "mustChangePassword": false,
    "permissions": ["machines.read"]
  }
}
'''),
        );

    // This is what offline start-up reads back out of local storage.
    final AuthProfileResponseModel restored =
        AuthProfileResponseModel.fromDataJson(original.toJson());

    expect(restored.user.name, original.user.name);
    expect(restored.user.roleName, original.user.roleName);
    expect(restored.user.branchName, original.user.branchName);
    expect(restored.permissions, original.permissions);
  });
}
