import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/presentation/helpers/maintenance_close_rules.dart';

void main() {
  group('maintenanceCloseEffectFor — mirrors postClose() branch for branch', () {
    test('free under warranty posts nothing, regardless of party', () {
      final MaintenanceCloseEffect effect = maintenanceCloseEffectFor(
        isFreeUnderWarranty: true,
        cost: 500,
        responsibleParty: MaintenanceResponsibleParty.company,
      );

      expect(effect.kind, MaintenanceCloseEffectKind.none);
      expect(effect.amount, 0);
    });

    test('a zero cost posts nothing even when not marked free', () {
      final MaintenanceCloseEffect effect = maintenanceCloseEffectFor(
        isFreeUnderWarranty: false,
        cost: 0,
        responsibleParty: MaintenanceResponsibleParty.representative,
      );

      expect(effect.kind, MaintenanceCloseEffectKind.none);
    });

    test('the factory absorbs a real cost with nothing posted', () {
      final MaintenanceCloseEffect effect = maintenanceCloseEffectFor(
        isFreeUnderWarranty: false,
        cost: 350,
        responsibleParty: MaintenanceResponsibleParty.factory,
      );

      expect(effect.kind, MaintenanceCloseEffectKind.none);
    });

    test('company posts an expense for the exact cost', () {
      final MaintenanceCloseEffect effect = maintenanceCloseEffectFor(
        isFreeUnderWarranty: false,
        cost: 350,
        responsibleParty: MaintenanceResponsibleParty.company,
      );

      expect(effect.kind, MaintenanceCloseEffectKind.companyExpense);
      expect(effect.amount, 350);
    });

    test('representative opens a violation for the exact cost', () {
      final MaintenanceCloseEffect effect = maintenanceCloseEffectFor(
        isFreeUnderWarranty: false,
        cost: 1200,
        responsibleParty: MaintenanceResponsibleParty.representative,
      );

      expect(effect.kind, MaintenanceCloseEffectKind.representativeViolation);
      expect(effect.amount, 1200);
    });

    test('merchant is charged a one-time fee for the exact cost', () {
      final MaintenanceCloseEffect effect = maintenanceCloseEffectFor(
        isFreeUnderWarranty: false,
        cost: 220,
        responsibleParty: MaintenanceResponsibleParty.merchant,
      );

      expect(effect.kind, MaintenanceCloseEffectKind.merchantFee);
      expect(effect.amount, 220);
    });
  });

  group('maintenanceCloseBlockedReason — mirrors CloseMaintenanceOrderDto\'s @ValidateIf rules', () {
    MaintenanceCloseBlockedReason? blocked({
      bool isFreeUnderWarranty = false,
      double? cost = 100,
      MaintenanceOrderResult result = MaintenanceOrderResult.repaired,
      MaintenanceResponsibleParty responsibleParty = MaintenanceResponsibleParty.factory,
      String? responsibleUserId,
      String? responsibleMerchantId,
      String? paymentMethodId,
      bool hasReplacement = true,
    }) {
      return maintenanceCloseBlockedReason(
        isFreeUnderWarranty: isFreeUnderWarranty,
        cost: cost,
        result: result,
        responsibleParty: responsibleParty,
        responsibleUserId: responsibleUserId,
        responsibleMerchantId: responsibleMerchantId,
        paymentMethodId: paymentMethodId,
        hasReplacement: hasReplacement,
      );
    }

    test('a chargeable close with no cost is blocked', () {
      expect(
        blocked(cost: null),
        MaintenanceCloseBlockedReason.costRequired,
      );
      expect(blocked(cost: 0), MaintenanceCloseBlockedReason.costRequired);
    });

    test('free under warranty never needs a cost', () {
      expect(blocked(isFreeUnderWarranty: true, cost: null), isNull);
    });

    test('representative without a picked user is blocked', () {
      expect(
        blocked(responsibleParty: MaintenanceResponsibleParty.representative),
        MaintenanceCloseBlockedReason.responsibleUserRequired,
      );
      expect(
        blocked(
          responsibleParty: MaintenanceResponsibleParty.representative,
          responsibleUserId: 'u1',
        ),
        isNull,
      );
    });

    test('merchant without a picked merchant is blocked', () {
      expect(
        blocked(responsibleParty: MaintenanceResponsibleParty.merchant),
        MaintenanceCloseBlockedReason.responsibleMerchantRequired,
      );
      expect(
        blocked(
          responsibleParty: MaintenanceResponsibleParty.merchant,
          responsibleMerchantId: 'm1',
        ),
        isNull,
      );
    });

    test('a chargeable company close needs a payment method', () {
      expect(
        blocked(responsibleParty: MaintenanceResponsibleParty.company),
        MaintenanceCloseBlockedReason.paymentMethodRequired,
      );
      expect(
        blocked(
          responsibleParty: MaintenanceResponsibleParty.company,
          paymentMethodId: 'pm1',
        ),
        isNull,
      );
    });

    test('a free company close needs no payment method', () {
      expect(
        blocked(
          isFreeUnderWarranty: true,
          responsibleParty: MaintenanceResponsibleParty.company,
        ),
        isNull,
      );
    });

    test('a factory close never needs a payment method', () {
      expect(blocked(responsibleParty: MaintenanceResponsibleParty.factory), isNull);
    });

    test('REPLACED without the replacement fields is blocked', () {
      expect(
        blocked(
          result: MaintenanceOrderResult.replaced,
          hasReplacement: false,
        ),
        MaintenanceCloseBlockedReason.replacementRequired,
      );
      expect(
        blocked(result: MaintenanceOrderResult.replaced, hasReplacement: true),
        isNull,
      );
    });

    test('a fully valid factory-absorbed repair is never blocked', () {
      expect(blocked(), isNull);
    });
  });
}
