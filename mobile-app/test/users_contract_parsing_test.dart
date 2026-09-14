import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/feature/users/data/models/permission_group_model.dart';
import 'package:machinery/feature/users/data/models/role_model.dart';
import 'package:machinery/feature/users/data/models/user_custody_model.dart';
import 'package:machinery/feature/users/data/models/user_model.dart';
import 'package:machinery/feature/users/data/models/user_permissions_model.dart';
import 'package:machinery/feature/users/domain/entities/user_permissions_entity.dart';
import 'package:machinery/feature/users/domain/params/role_write_params.dart';
import 'package:machinery/feature/users/domain/params/user_form_params.dart';
import 'package:machinery/feature/users/domain/params/users_query_params.dart';

/// Payloads copied from the running API. `GET /users` nests `role` as an
/// object and keeps `branchId` flat, which is *not* the shape `/auth/me` uses —
/// the two are easy to conflate and the difference is silent at runtime.
void main() {
  Map<String, dynamic> decode(String body) =>
      jsonDecode(body) as Map<String, dynamic>;

  test('GET /users row parses role, branch and the account flags', () {
    final UserModel model = UserModel.fromJson(
      decode('''
{
  "id": "f546db12-0682-487d-8577-752ea31dea97",
  "fullName": "مشاهد التطوير",
  "phone": "01000000006",
  "email": null,
  "role": {
    "id": "51f00dd6-99ec-486f-b0e8-86372568d7c0",
    "code": "VIEWER",
    "displayName": "مشاهد"
  },
  "branchId": null,
  "isActive": true,
  "mustChangePassword": false,
  "biometricEnabled": false,
  "lastLoginAt": "2026-09-07T22:19:47.961Z",
  "createdAt": "2026-09-07T21:33:11.076Z"
}
'''),
    );

    expect(model.fullName, 'مشاهد التطوير');
    expect(model.roleCode, 'VIEWER');
    expect(model.roleName, 'مشاهد');
    expect(model.branchId, isNull);
    expect(model.toEntity().hasSignedInBefore, isTrue);
  });

  test('an account that has never been used has no last login', () {
    final UserModel model = UserModel.fromJson(
      decode('''
{
  "id": "u-9",
  "fullName": "حساب جديد",
  "phone": "01000000099",
  "role": { "id": "r-1", "code": "REPRESENTATIVE", "displayName": "مندوب" },
  "branchId": "b-1",
  "isActive": true,
  "mustChangePassword": true,
  "lastLoginAt": null
}
'''),
    );

    expect(model.toEntity().hasSignedInBefore, isFalse);
    expect(model.mustChangePassword, isTrue);
    expect(model.branchId, 'b-1');
  });

  test('a malformed timestamp does not take the row down', () {
    final UserModel model = UserModel.fromJson(
      decode('''
{ "id": "u-1", "fullName": "x", "phone": "0", "lastLoginAt": "not-a-date" }
'''),
    );

    expect(model.lastLoginAt, isNull);
  });

  test('GET /roles carries the grants and the localized name', () {
    final RoleModel role = RoleModel.fromJson(
      decode('''
{
  "id": "ae7bee54-8f01-440d-84d9-e8ce39fb0c9f",
  "code": "ACCOUNTANT",
  "displayName": "محاسب",
  "description": "إدارة مصروفات وإيرادات الشركة",
  "isSystem": true,
  "permissions": ["finance.read", "machines.read"],
  "permissionCount": 2
}
'''),
    );

    expect(role.displayName, 'محاسب');
    expect(role.permissions, <String>['finance.read', 'machines.read']);
    expect(role.toEntity().isSystem, isTrue);
    expect(role.toEntity().isBranchScoped, isFalse);
  });

  test('raw role translations survive for the rename dialog', () {
    final RoleModel role = RoleModel.fromJson(
      decode('''
{
  "id": "r-1",
  "code": "VIEWER",
  "displayName": "مشاهد",
  "isSystem": false,
  "permissions": [],
  "translations": {
    "ar": { "displayName": "مشاهد", "description": "عرض فقط" },
    "en": { "displayName": "Viewer", "description": "Read only" }
  }
}
'''),
    );

    expect(role.translations['en']?.displayName, 'Viewer');
    expect(role.translations['ar']?.description, 'عرض فقط');
  });

  test('create-role body uppercases the code and trims names', () {
    final json = CreateRoleParams(
      code: ' field_ops ',
      translations: const RoleTranslations(
        arName: ' ميداني ',
        enName: ' Field ',
        arDescription: ' ',
        enDescription: 'On site',
      ),
      permissions: const <String>['machines.read'],
    ).toJson();

    expect(json['code'], 'FIELD_OPS');
    expect(json['translations']['ar']['displayName'], 'ميداني');
    expect(json['translations']['en']['description'], 'On site');
    expect(
      (json['translations']['ar'] as Map<String, dynamic>)
          .containsKey('description'),
      isFalse,
    );
  });

  test('user custody summary and merchant nesting parse', () {
    final custody = userCustodyFromJson(
      decode('''
{
  "summary": {
    "totalMachines": 4,
    "withMerchants": 2,
    "inHand": 2,
    "openViolations": 1
  },
  "machines": [
    {
      "id": "m-1",
      "serial": "SN-1",
      "model": "X1",
      "status": "WITH_MERCHANT",
      "heldSince": "2026-09-01T10:00:00.000Z",
        "merchant": { "id": "shop-1", "shopName": "محل النور" }
    }
  ],
  "machinesMeta": {
    "page": 1,
    "limit": 20,
    "total": 4,
    "totalPages": 1,
    "hasNext": false
  }
}
'''),
    );

    expect(custody.summary.totalMachines, 4);
    expect(custody.machines.single.merchantName, 'محل النور');
    expect(custody.machines.single.serial, 'SN-1');
    expect(custody.machinesMeta.hasNext, isFalse);
  });

  test('branch-scoped roles are the ones the form asks a branch for', () {
    RoleModel roleWith(String code) => RoleModel.fromJson(<String, dynamic>{
          'id': 'r',
          'code': code,
          'displayName': code,
        });

    expect(roleWith('REPRESENTATIVE').toEntity().isBranchScoped, isTrue);
    expect(roleWith('BRANCH_SUPERVISOR').toEntity().isBranchScoped, isTrue);
    expect(roleWith('DIRECTOR').toEntity().isBranchScoped, isFalse);
    expect(roleWith('ACCOUNTANT').toEntity().isBranchScoped, isFalse);
  });

  test('GET /permissions arrives grouped and localized', () {
    final PermissionGroupModel group = PermissionGroupModel.fromJson(
      decode('''
{
  "group": "machines",
  "label": "الماكينات",
  "permissions": [
    {
      "id": "c0da2382",
      "code": "machines.read",
      "group": "machines",
      "displayName": "عرض الماكينات",
      "description": null
    }
  ]
}
'''),
    );

    expect(group.label, 'الماكينات');
    expect(group.permissions.single.displayName, 'عرض الماكينات');
  });

  test('overrides map onto the two effects, and junk is dropped', () {
    final UserPermissionsModel model = UserPermissionsModel.fromJson(
      decode('''
{
  "userId": "cf5e88b4",
  "rolePermissions": ["machines.read"],
  "overrides": [
    { "code": "finance.read", "effect": "ALLOW" },
    { "code": "users.read", "effect": "DENY" },
    { "code": "broken", "effect": "MAYBE" },
    { "effect": "ALLOW" }
  ],
  "effectivePermissions": ["machines.read", "finance.read"]
}
'''),
    );

    expect(model.overrides['finance.read'], PermissionEffect.allow);
    expect(model.overrides['users.read'], PermissionEffect.deny);
    expect(model.overrides.containsKey('broken'), isFalse);
    expect(model.overrides.length, 2);
  });

  group('request bodies', () {
    test('create omits an empty email and a null branch', () {
      const CreateUserParams params = CreateUserParams(
        fullName: '  منى سعيد  ',
        phone: ' 01000000002 ',
        roleId: 'r-1',
        password: 'Dev#12345',
        email: '   ',
      );

      final Map<String, dynamic> json = params.toJson();

      expect(json['fullName'], 'منى سعيد');
      expect(json['phone'], '01000000002');
      expect(json.containsKey('email'), isFalse);
      expect(json.containsKey('branchId'), isFalse);
    });

    test('update sends null explicitly when a field is being cleared', () {
      const UpdateUserParams params = UpdateUserParams(
        fullName: 'اسم جديد',
        clearEmail: true,
        clearBranch: true,
      );

      final Map<String, dynamic> json = params.toJson();

      expect(json['fullName'], 'اسم جديد');
      expect(json.containsKey('email'), isTrue);
      expect(json['email'], isNull);
      expect(json['branchId'], isNull);
      expect(json.containsKey('phone'), isFalse);
    });

    test('an untouched update sends nothing at all', () {
      expect(const UpdateUserParams().isEmpty, isTrue);
    });

    test('the list query drops blank filters instead of sending them', () {
      const UsersQueryParams params = UsersQueryParams(search: '   ');
      final Map<String, dynamic> query = params.toQuery();

      expect(query.containsKey('search'), isFalse);
      expect(query.containsKey('roleId'), isFalse);
      expect(query['page'], 1);
    });

    test('isActive false is a real filter, not an absent one', () {
      const UsersQueryParams params = UsersQueryParams(isActive: false);

      expect(params.toQuery()['isActive'], 'false');
      expect(params.hasFilters, isTrue);
      expect(const UsersQueryParams().hasFilters, isFalse);
    });
  });
}
