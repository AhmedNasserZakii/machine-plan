import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/notifications/data/models/notification_response_model.dart';
import 'package:machinery/feature/notifications/domain/entities/notification_entity.dart';

void main() {
  Map<String, dynamic> decode(String body) =>
      jsonDecode(body) as Map<String, dynamic>;

  const String unreadNotification = '''
{
  "id": "n1",
  "templateCode": "TRANSFER_PENDING",
  "title": "تسليمة محتاجة توقيعك",
  "body": "ماكينة SN-1 بانتظارك",
  "locale": "ar",
  "entityType": "transfer",
  "entityId": "t1",
  "deepLink": "machinery://transfers/t1",
  "data": { "notificationId": "n1", "templateCode": "TRANSFER_PENDING" },
  "isRead": false,
  "readAt": null,
  "pushStatus": "SENT",
  "pushSkipReason": null,
  "createdAt": "2026-09-14T10:00:00.000Z"
}
''';

  group('notification model', () {
    test('parses a full unread notification row', () {
      final NotificationEntity entity = NotificationResponseModel.fromJson(
        decode(unreadNotification),
      ).toEntity();

      expect(entity.id, 'n1');
      expect(entity.templateCode, NotificationTemplateCode.transferPending);
      expect(entity.title, 'تسليمة محتاجة توقيعك');
      expect(entity.entityType, NotificationEntityType.transfer);
      expect(entity.entityId, 't1');
      expect(entity.deepLink, 'machinery://transfers/t1');
      expect(entity.isRead, isFalse);
      expect(entity.readAt, isNull);
      expect(entity.pushStatus, 'SENT');
      expect(entity.data['notificationId'], 'n1');
    });

    test('unknown template and entity type degrade safely', () {
      final NotificationEntity entity = NotificationResponseModel.fromJson(
        decode(
          unreadNotification
              .replaceFirst('"TRANSFER_PENDING"', '"FUTURE_CODE"')
              .replaceFirst('"transfer"', '"spaceship"'),
        ),
      ).toEntity();

      expect(entity.templateCode, NotificationTemplateCode.unknown);
      expect(entity.entityType, NotificationEntityType.unknown);
    });

    test('preferences response parses channel locks', () {
      final NotificationPreferencesEntity prefs =
          NotificationPreferencesModel.fromJson(
            decode('''
{
  "locale": "ar",
  "preferences": [
    {
      "templateCode": "TRANSFER_PENDING",
      "push": true,
      "inApp": true,
      "inAppLocked": true
    },
    {
      "templateCode": "BUDGET_WARNING",
      "push": false,
      "inApp": true,
      "inAppLocked": false
    }
  ]
}
'''),
          ).toEntity();

      expect(prefs.locale, 'ar');
      expect(prefs.preferences, hasLength(2));
      expect(prefs.preferences.first.inAppLocked, isTrue);
      expect(prefs.preferences.last.push, isFalse);
    });
  });
}
