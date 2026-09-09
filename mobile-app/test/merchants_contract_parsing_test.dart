import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/merchants/data/logic/merchant_form/merchant_form_state.dart';
import 'package:machinery/feature/merchants/data/models/merchant_response_model.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/domain/params/merchant_form_params.dart';
import 'package:machinery/feature/merchants/domain/params/merchants_query_params.dart';

/// Payloads copied verbatim from the running API.
///
/// The list row and the detail record are different shapes — the row stops at
/// `isActive` and omits the national ID, registrar, subscription and notes —
/// so a parser that assumes one shape silently produces half-empty cards in
/// the other. Both are pinned here, along with the money and date fields the
/// API returns as bare numbers and `yyyy-MM-dd` strings.
void main() {
  Map<String, dynamic> decode(String body) =>
      jsonDecode(body) as Map<String, dynamic>;

  group('merchants', () {
    test('GET /merchants row parses the trimmed list shape', () {
      final MerchantEntity merchant = MerchantResponseModel.fromJson(
        decode('''
{
  "id": "8b3a74d3-ae2d-495f-9af6-e8603642a983",
  "name": "محمد عبد الله",
  "shopName": "سوبر ماركت النور",
  "phone": "01018850275",
  "address": "شارع الجمهورية، المنصورة",
  "branch": null,
  "machinesCount": 0,
  "isActive": true
}
'''),
      ).toEntity();

      expect(merchant.name, 'محمد عبد الله');
      expect(merchant.shopName, 'سوبر ماركت النور');
      expect(merchant.phone, '01018850275');
      expect(merchant.machinesCount, 0);
      expect(merchant.isActive, isTrue);

      // The row carries no branch, registrar or subscription. Those must come
      // back as null rather than throwing or defaulting to a blank object.
      expect(merchant.branch, isNull);
      expect(merchant.registeredBy, isNull);
      expect(merchant.activeSubscription, isNull);
    });

    test('GET /merchants/:id parses the full record', () {
      final MerchantEntity merchant = MerchantResponseModel.fromJson(
        decode('''
{
  "id": "448e22a6-c240-45e9-9f47-bd54b44ad7f6",
  "name": "محمد عبد الله",
  "shopName": "سوبر ماركت النور",
  "phone": "01018850195",
  "address": "شارع الجمهورية، المنصورة",
  "branch": { "id": "84177053-1111-2222-3333-444455556666", "name": "فرع القاهرة" },
  "machinesCount": 2,
  "isActive": true,
  "nationalId": "29801088850195",
  "registeredBy": { "id": "79caacfe-5cb9-4afc-af58-b4b797a696b5", "fullName": "مدير التطوير" },
  "activeSubscription": {
    "id": "e0b032f0-e0cb-4ba7-b2dd-6e06e4f2c392",
    "planType": "MONTHLY",
    "machineId": null,
    "machineSerial": null,
    "amount": 500,
    "startDate": "2026-09-01",
    "endDate": null,
    "nextDueDate": "2026-10-01",
    "isOverdue": false,
    "totalCollected": 500,
    "collectionCount": 1,
    "lastCollectedAt": "2026-09-08T06:50:37.474Z",
    "isActive": true,
    "notes": null
  },
  "totalPaid": 500,
  "notes": "محل كبير",
  "createdAt": "2026-09-08T06:49:55.746Z"
}
'''),
      ).toEntity();

      expect(merchant.nationalId, '29801088850195');
      expect(merchant.branch?.name, 'فرع القاهرة');
      expect(merchant.registeredBy?.fullName, 'مدير التطوير');
      expect(merchant.totalPaid, 500);
      expect(merchant.notes, 'محل كبير');
      expect(merchant.createdAt?.toUtc().year, 2026);

      final SubscriptionEntity? plan = merchant.activeSubscription;
      expect(plan?.planType, SubscriptionPlanType.monthly);
      expect(plan?.amount, 500);
      expect(plan?.totalCollected, 500);
      expect(plan?.collectionCount, 1);
      expect(plan?.isOverdue, isFalse);
      expect(plan?.lastCollectedAt, isNotNull);

      // Dates arrive as yyyy-MM-dd and are kept verbatim — parsing them into a
      // DateTime would drag the device timezone into a calendar-only value and
      // shift the due date by a day either side of midnight.
      expect(plan?.startDate, '2026-09-01');
      expect(plan?.nextDueDate, '2026-10-01');
      expect(plan?.endDate, isNull);

      // A plan not tied to one machine leaves both machine fields null.
      expect(plan?.machineId, isNull);
      expect(plan?.machineSerial, isNull);
    });

    test('a fresh plan reports itself overdue on its own start date', () {
      final SubscriptionEntity plan = SubscriptionResponseModel.fromJson(
        decode('''
{
  "id": "e0b032f0-e0cb-4ba7-b2dd-6e06e4f2c392",
  "planType": "MONTHLY",
  "machineId": null,
  "machineSerial": null,
  "amount": 500,
  "startDate": "2026-09-01",
  "endDate": null,
  "nextDueDate": "2026-09-01",
  "isOverdue": true,
  "totalCollected": 0,
  "collectionCount": 0,
  "lastCollectedAt": null,
  "isActive": true,
  "notes": null
}
'''),
      ).toEntity();

      expect(plan.isOverdue, isTrue);
      expect(plan.totalCollected, 0);
      expect(plan.lastCollectedAt, isNull);
    });

    test(
      'POST /merchants/check surfaces both warnings and the existing row',
      () {
        final MerchantDuplicateCheck check =
            MerchantDuplicateCheckModel.fromJson(
              decode('''
{
  "warnings": ["DUPLICATE_PHONE", "DUPLICATE_NATIONAL_ID"],
  "existing": [
    {
      "id": "448e22a6-c240-45e9-9f47-bd54b44ad7f6",
      "name": "محمد عبد الله",
      "shopName": "سوبر ماركت النور",
      "phone": "01018850195",
      "address": "شارع الجمهورية، المنصورة",
      "branch": null,
      "machinesCount": 0,
      "isActive": true
    }
  ]
}
'''),
            ).toEntity();

        expect(check.warnings, <MerchantDuplicateWarning>[
          MerchantDuplicateWarning.duplicatePhone,
          MerchantDuplicateWarning.duplicateNationalId,
        ]);
        expect(check.existing.single.shopName, 'سوبر ماركت النور');
        expect(check.isClean, isFalse);

        // A duplicate phone is advisory; a duplicate national ID is fatal. The
        // form relies on this split to decide whether to block submission.
        expect(MerchantFormReady(warnings: check.warnings).isBlocked, isTrue);
      },
    );

    test('a phone-only match warns without blocking', () {
      final MerchantDuplicateCheck check = MerchantDuplicateCheckModel.fromJson(
        decode('{"warnings":["DUPLICATE_PHONE"],"existing":[]}'),
      ).toEntity();

      expect(check.warnings.single, MerchantDuplicateWarning.duplicatePhone);

      final MerchantFormReady state = MerchantFormReady(
        warnings: check.warnings,
      );
      expect(state.isBlocked, isFalse);
      expect(state.hasPhoneWarning, isTrue);
    });

    test('GET /merchants/:id/timeline parses a subscription entry', () {
      final MerchantTimelineEntry entry = MerchantTimelineEntryModel.fromJson(
        decode('''
{
  "kind": "SUBSCRIPTION_STARTED",
  "occurredAt": "2026-09-08T06:49:55.886Z",
  "referenceNo": null,
  "machineSerial": null,
  "amount": 500,
  "code": "PLAN_MONTHLY"
}
'''),
      ).toEntity();

      expect(entry.kind, MerchantTimelineKind.subscriptionStarted);
      expect(entry.amount, 500);
      expect(entry.code, 'PLAN_MONTHLY');
      expect(entry.occurredAt.toUtc().day, 8);
      expect(entry.referenceNo, isNull);
    });
  });

  group('merchant request params', () {
    test('the default query leans on the server-side active-only default', () {
      final Map<String, dynamic> query = const MerchantsQueryParams().toQuery();

      // The backend applies `is_active = true` whenever includeInactive is
      // absent, so the client sends neither flag on the common path.
      expect(query.containsKey('isActive'), isFalse);
      expect(query.containsKey('includeInactive'), isFalse);
      expect(query['page'], 1);
    });

    test('includeInactive is the only way to widen the filter', () {
      final Map<String, dynamic> query = const MerchantsQueryParams(
        includeInactive: true,
      ).toQuery();

      expect(query['includeInactive'], true);
      expect(query.containsKey('isActive'), isFalse);
    });

    test('a blank search is dropped rather than sent as an empty term', () {
      expect(
        const MerchantsQueryParams(
          search: '   ',
        ).toQuery().containsKey('search'),
        isFalse,
      );
      expect(
        const MerchantsQueryParams(search: '  النور ').toQuery()['search'],
        'النور',
      );
    });

    test('collect sends the ISO timestamp the backend requires', () {
      final Map<String, dynamic> body = const CollectSubscriptionParams(
        amount: 500,
        collectedAt: '2026-09-08T06:50:37.474Z',
        paymentMethodId: 'cfe51c79-b724-46c7-977f-c51c7ce78bc5',
        notes: '  تحصيل نقدي  ',
      ).toJson();

      expect(body['amount'], 500);
      expect(body['collectedAt'], '2026-09-08T06:50:37.474Z');
      expect(body['paymentMethodId'], 'cfe51c79-b724-46c7-977f-c51c7ce78bc5');
      expect(body['notes'], 'تحصيل نقدي');

      // An unphotographed collection must omit the key rather than send null.
      expect(body.containsKey('invoiceMediaId'), isFalse);
    });
  });
}
