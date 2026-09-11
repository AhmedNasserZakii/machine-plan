import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/feature/maintenance/presentation/helpers/replacement_form_rules.dart';

void main() {
  ReplacementFormErrors validate({
    String newSerial = 'SN-NEW',
    String newBattery = 'BT-NEW',
    String? newSim = 'SIM-NEW',
    bool requiresSim = true,
    String reason = 'Factory supplied another unit',
    String? warrantyStart = '2026-09-01',
    String? warrantyEnd = '2027-09-01',
  }) {
    return validateReplacementForm(
      oldSerial: 'SN-OLD',
      oldBatterySerial: 'BT-OLD',
      oldSimSerial: 'SIM-OLD',
      newSerial: newSerial,
      newBatterySerial: newBattery,
      newSimSerial: newSim,
      requiresSim: requiresSim,
      reason: reason,
      warrantyStart: warrantyStart,
      warrantyEnd: warrantyEnd,
      requiredMessage: 'required',
      tooShortMessage: 'short',
      mustBeDifferentMessage: 'different',
      warrantyOrderMessage: 'warranty order',
    );
  }

  test('accepts a complete replacement', () {
    expect(validate().isValid, isTrue);
  });

  test('requires machine, battery, SIM, and a five-character reason', () {
    final errors = validate(
      newSerial: '',
      newBattery: '',
      newSim: '',
      reason: 'bad',
    );

    expect(errors.newSerial, 'required');
    expect(errors.newBatterySerial, 'required');
    expect(errors.newSimSerial, 'required');
    expect(errors.reason, 'short');
  });

  test('does not require a SIM for a machine type without one', () {
    expect(validate(newSim: null, requiresSim: false).newSimSerial, isNull);
  });

  test('rejects serials copied from the old machine ignoring case', () {
    final errors = validate(
      newSerial: 'sn-old',
      newBattery: 'bt-old',
      newSim: 'sim-old',
    );

    expect(errors.newSerial, 'different');
    expect(errors.newBatterySerial, 'different');
    expect(errors.newSimSerial, 'different');
  });

  test('rejects an inverted warranty range', () {
    final errors = validate(
      warrantyStart: '2027-09-01',
      warrantyEnd: '2026-09-01',
    );

    expect(errors.warranty, 'warranty order');
  });
}
