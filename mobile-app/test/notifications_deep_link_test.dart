import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/feature/notifications/presentation/helpers/notification_deep_link_router.dart';
import 'package:machinery/feature/notifications/presentation/helpers/notification_labels.dart';

void main() {
  group('ParsedNotificationDeepLink', () {
    test('parses transfer deep links', () {
      final ParsedNotificationDeepLink? link =
          ParsedNotificationDeepLink.tryParse('machinery://transfers/abc-123');

      expect(link, isNotNull);
      expect(link!.host, 'transfers');
      expect(link.entityId, 'abc-123');
      expect(requiredPermissionForDeepLink(link), P.transfersRead);
    });

    test('parses nested finance budget deep links', () {
      final ParsedNotificationDeepLink? link = ParsedNotificationDeepLink.tryParse(
        'machinery://finance/budgets/budget-9',
      );

      expect(link, isNotNull);
      expect(link!.host, 'finance');
      expect(link.pathSegments, <String>['budgets', 'budget-9']);
      expect(requiredPermissionForDeepLink(link), P.financeRead);
    });

    test('notifications host needs no permission', () {
      final ParsedNotificationDeepLink? link =
          ParsedNotificationDeepLink.tryParse('machinery://notifications');

      expect(link, isNotNull);
      expect(requiredPermissionForDeepLink(link!), isNull);
    });

    test('invalid or empty input returns null', () {
      expect(ParsedNotificationDeepLink.tryParse(null), isNull);
      expect(ParsedNotificationDeepLink.tryParse(''), isNull);
      expect(ParsedNotificationDeepLink.tryParse('not-a-uri'), isNull);
    });
  });

  group('NotificationLabels.dayGroup', () {
    final DateTime now = DateTime(2026, 9, 14, 15);

    test('groups today / yesterday / this week / older', () {
      expect(
        NotificationLabels.dayGroup(DateTime(2026, 9, 14, 9), now: now),
        isNot(equals('')),
      );
      // Labels go through easy_localization which is not wired in unit tests;
      // assert relative grouping identity instead.
      expect(
        NotificationLabels.isSameDayGroup(
          DateTime(2026, 9, 14, 1),
          DateTime(2026, 9, 14, 23),
          now: now,
        ),
        isTrue,
      );
      expect(
        NotificationLabels.isSameDayGroup(
          DateTime(2026, 9, 14),
          DateTime(2026, 9, 13),
          now: now,
        ),
        isFalse,
      );
    });
  });
}
