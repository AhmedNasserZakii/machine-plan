import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/transfers/presentation/widgets/handover_signature_card.dart';

/// The two screens that use this controller (`9.3`, `9.4`) both trust it to
/// answer "what does this person actually have" at submit time — worth
/// pinning the state machine down directly rather than only through them.
void main() {
  test('defaults to the drawn method with nothing verified', () {
    final HandoverSignatureController controller = HandoverSignatureController();

    expect(controller.method, SignatureMethod.drawn);
    expect(controller.isBiometricVerified, isFalse);

    controller.dispose();
  });

  test('setBiometricVerified records the device evidence', () {
    final HandoverSignatureController controller = HandoverSignatureController();

    controller.selectMethod(SignatureMethod.biometric);
    controller.setBiometricVerified(
      deviceId: 'device-1',
      deviceModel: 'Pixel 8',
    );

    expect(controller.isBiometricVerified, isTrue);
    expect(controller.verifiedDeviceId, 'device-1');
    expect(controller.verifiedDeviceModel, 'Pixel 8');

    controller.dispose();
  });

  test('switching back to drawn drops a prior biometric verification', () {
    final HandoverSignatureController controller = HandoverSignatureController();

    controller.selectMethod(SignatureMethod.biometric);
    controller.setBiometricVerified(deviceId: 'device-1');
    controller.selectMethod(SignatureMethod.drawn);

    expect(controller.isBiometricVerified, isFalse);
    expect(controller.verifiedDeviceId, isNull);

    controller.dispose();
  });

  test('reset clears both a verified biometric and any drawn strokes', () {
    final HandoverSignatureController controller = HandoverSignatureController();

    controller.selectMethod(SignatureMethod.biometric);
    controller.setBiometricVerified(deviceId: 'device-1');
    controller.reset();

    expect(controller.isBiometricVerified, isFalse);
    expect(controller.drawn.isEmpty, isTrue);

    controller.dispose();
  });
}
