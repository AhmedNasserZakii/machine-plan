import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/feature/users/domain/entities/permission_draft.dart';
import 'package:machinery/feature/users/domain/entities/user_permissions_entity.dart';

/// The override editor decides who can see the company's money, so the cycle
/// and the resolution rule are pinned here rather than checked by hand on a
/// phone.
void main() {
  UserPermissionsEntity loaded({
    Set<String> role = const <String>{'machines.read'},
    Map<String, PermissionEffect> overrides =
        const <String, PermissionEffect>{},
  }) {
    return UserPermissionsEntity(
      userId: 'u-1',
      rolePermissions: role,
      overrides: overrides,
      effectivePermissions: role,
    );
  }

  group('cycling', () {
    test('walks inherited to allowed to denied and back', () {
      PermissionDraft draft = PermissionDraft.from(loaded());

      expect(
        draft.assignmentOf('finance.read'),
        PermissionAssignment.inherited,
      );

      draft = draft.cycle('finance.read');
      expect(draft.assignmentOf('finance.read'), PermissionAssignment.allowed);

      draft = draft.cycle('finance.read');
      expect(draft.assignmentOf('finance.read'), PermissionAssignment.denied);

      draft = draft.cycle('finance.read');
      expect(
        draft.assignmentOf('finance.read'),
        PermissionAssignment.inherited,
      );
    });

    test('leaves the loaded copy untouched', () {
      final PermissionDraft original = PermissionDraft.from(loaded());
      original.cycle('finance.read');

      expect(original.overrides, isEmpty);
    });
  });

  group('effective access', () {
    test('an allow grants a permission the role does not', () {
      final PermissionDraft draft = PermissionDraft.from(
        loaded(),
      ).cycle('finance.read');

      expect(draft.effectivelyGranted('finance.read'), isTrue);
    });

    test('a deny beats the role, which is the whole point of an override', () {
      final PermissionDraft draft = PermissionDraft.from(
        loaded(role: <String>{'finance.read'}),
      ).cycle('finance.read').cycle('finance.read');

      expect(draft.assignmentOf('finance.read'), PermissionAssignment.denied);
      expect(draft.effectivelyGranted('finance.read'), isFalse);
    });

    test('inherited follows the role in both directions', () {
      final PermissionDraft draft = PermissionDraft.from(
        loaded(role: <String>{'machines.read'}),
      );

      expect(draft.effectivelyGranted('machines.read'), isTrue);
      expect(draft.effectivelyGranted('finance.read'), isFalse);
    });
  });

  group('changes', () {
    test('a full cycle back to inherited is not a change', () {
      final PermissionDraft draft = PermissionDraft.from(
        loaded(),
      ).cycle('finance.read').cycle('finance.read').cycle('finance.read');

      expect(draft.hasChanges, isFalse);
      expect(draft.changes, isEmpty);
    });

    test('removing an existing override is reported as a change', () {
      final PermissionDraft draft = PermissionDraft.from(
        loaded(
          overrides: const <String, PermissionEffect>{
            'finance.read': PermissionEffect.deny,
          },
        ),
      ).cycle('finance.read');

      expect(draft.hasChanges, isTrue);
      expect(draft.changes.single.from, PermissionAssignment.denied);
      expect(draft.changes.single.to, PermissionAssignment.inherited);
    });

    test('reset returns to what was loaded', () {
      final PermissionDraft draft = PermissionDraft.from(
        loaded(),
      ).cycle('finance.read').cycle('machines.read').reset();

      expect(draft.hasChanges, isFalse);
    });

    test('changes come out in a stable order', () {
      final PermissionDraft draft = PermissionDraft.from(
        loaded(),
      ).cycle('users.read').cycle('finance.read').cycle('machines.create');

      expect(draft.changes.map((PermissionChange c) => c.code), <String>[
        'finance.read',
        'machines.create',
        'users.read',
      ]);
    });
  });

  group('payload', () {
    test('splits into the two lists the endpoint expects', () {
      final PermissionDraft draft = PermissionDraft.from(
        loaded(),
      ).cycle('finance.read').cycle('users.read').cycle('users.read');

      expect(draft.allowList, <String>['finance.read']);
      expect(draft.denyList, <String>['users.read']);
    });

    test('counts overrides per module for the collapsed badge', () {
      final PermissionDraft draft = PermissionDraft.from(
        loaded(),
      ).cycle('finance.read').cycle('finance.void');

      expect(
        draft.overrideCountIn(<String>[
          'finance.read',
          'finance.void',
          'finance.create',
        ]),
        2,
      );
      expect(draft.overrideCountIn(<String>['machines.read']), 0);
    });
  });
}
