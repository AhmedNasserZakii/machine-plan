import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/services/biometric/handover_biometric_service.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/transfers/presentation/widgets/signature_pad.dart';

/// Holds both signature methods' state so a screen can ask, at submit time,
/// "what do I actually have" without caring how it got there.
///
/// Deliberately not a `SignaturePadController` subtype: a biometric
/// confirmation has no strokes to rasterise, and pretending otherwise would
/// make the drawn path's `toPngBytes()` meaningless for the other method.
class HandoverSignatureController extends ChangeNotifier {
  HandoverSignatureController() : drawn = SignaturePadController();

  final SignaturePadController drawn;
  SignatureMethod method = SignatureMethod.drawn;
  String? verifiedDeviceId;
  String? verifiedDeviceModel;

  bool get isBiometricVerified => verifiedDeviceId != null;

  /// Switching away from biometric drops whatever was verified — a stale
  /// verification must not survive back into a signature for a method the
  /// person no longer intends to use.
  void selectMethod(SignatureMethod value) {
    if (method == value) return;
    method = value;
    if (value == SignatureMethod.drawn) {
      verifiedDeviceId = null;
      verifiedDeviceModel = null;
    }
    notifyListeners();
  }

  void setBiometricVerified({required String deviceId, String? deviceModel}) {
    verifiedDeviceId = deviceId;
    verifiedDeviceModel = deviceModel;
    notifyListeners();
  }

  /// The document changed underneath a signature already in progress
  /// (`PAYLOAD_CHANGED`) — neither a drawn mark nor a biometric check made
  /// against the old list means anything now, so both are dropped rather
  /// than silently carried over to the reloaded one.
  void reset() {
    drawn.clear();
    verifiedDeviceId = null;
    verifiedDeviceModel = null;
    notifyListeners();
  }

  @override
  void dispose() {
    drawn.dispose();
    super.dispose();
  }
}

/// The signing card itself: a method toggle (only shown when the hardware
/// actually supports it — never a dead-end choice), then either the
/// fingerprint prompt or the drawn pad.
class HandoverSignatureCard extends StatefulWidget {
  const HandoverSignatureCard({
    required this.controller,
    required this.reason,
    this.trailing,
    super.key,
  });

  final HandoverSignatureController controller;

  /// What `local_auth` shows the user while prompting — e.g. "أكّد استلامك
  /// للماكينات بالبصمة" for a receiver, "أكّد إنك سلّمت الماكينات بالبصمة" for
  /// a self-attested sender.
  final String reason;
  final Widget? trailing;

  @override
  State<HandoverSignatureCard> createState() => _HandoverSignatureCardState();
}

class _HandoverSignatureCardState extends State<HandoverSignatureCard> {
  final HandoverBiometricService _biometric = getIt<HandoverBiometricService>();
  bool _biometricAvailable = false;
  bool _authenticating = false;
  String? _failureMessage;

  @override
  void initState() {
    super.initState();
    _checkAvailability();
  }

  Future<void> _checkAvailability() async {
    final bool available = await _biometric.isAvailable();
    if (!mounted) return;
    setState(() => _biometricAvailable = available);
  }

  Future<void> _authenticate() async {
    setState(() {
      _authenticating = true;
      _failureMessage = null;
    });

    final bool success = await _biometric.authenticate(reason: widget.reason);

    if (!mounted) return;

    if (!success) {
      setState(() {
        _authenticating = false;
        _failureMessage = LocaleKeys.signatureBiometricFailed.tr();
      });
      return;
    }

    final String deviceId = _biometric.deviceId();
    final String? deviceModel = await _biometric.deviceModel();

    if (!mounted) return;

    setState(() => _authenticating = false);
    widget.controller.setBiometricVerified(
      deviceId: deviceId,
      deviceModel: deviceModel,
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (BuildContext context, Widget? _) {
        return DetailCard(
          title: LocaleKeys.transferSignatureTitle.tr(),
          icon: Icons.draw_outlined,
          children: <Widget>[
            if (_biometricAvailable) ...<Widget>[
              _MethodToggle(
                method: widget.controller.method,
                onChanged: widget.controller.selectMethod,
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            if (widget.controller.method == SignatureMethod.biometric)
              _BiometricSection(
                isVerified: widget.controller.isBiometricVerified,
                isAuthenticating: _authenticating,
                failureMessage: _failureMessage,
                onTap: _authenticate,
              )
            else
              SignaturePad(controller: widget.controller.drawn),
            if (widget.trailing != null) ...<Widget>[
              const SizedBox(height: AppSpacing.sm),
              widget.trailing!,
            ],
          ],
        );
      },
    );
  }
}

class _MethodToggle extends StatelessWidget {
  const _MethodToggle({required this.method, required this.onChanged});

  final SignatureMethod method;
  final ValueChanged<SignatureMethod> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(
          child: ChoiceChip(
            label: Text(LocaleKeys.signatureMethodBiometric.tr()),
            selected: method == SignatureMethod.biometric,
            onSelected: (_) => onChanged(SignatureMethod.biometric),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: ChoiceChip(
            label: Text(LocaleKeys.signatureMethodDrawn.tr()),
            selected: method == SignatureMethod.drawn,
            onSelected: (_) => onChanged(SignatureMethod.drawn),
          ),
        ),
      ],
    );
  }
}

class _BiometricSection extends StatelessWidget {
  const _BiometricSection({
    required this.isVerified,
    required this.isAuthenticating,
    required this.failureMessage,
    required this.onTap,
  });

  final bool isVerified;
  final bool isAuthenticating;
  final String? failureMessage;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    if (isVerified) {
      return Row(
        children: <Widget>[
          const Icon(
            Icons.fingerprint,
            color: AppColors.successColor,
            size: 22,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              LocaleKeys.signatureBiometricVerified.tr(),
              style: Styles.s13(
                context,
              ).copyWith(color: AppColors.successColor, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        CustomButton(
          title: LocaleKeys.signatureBiometricConfirm.tr(),
          isLoading: isAuthenticating,
          height: 44,
          identifier: 'signature_biometric_button',
          onPressed: isAuthenticating ? null : onTap,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              const Icon(Icons.fingerprint, size: 18),
              const SizedBox(width: AppSpacing.sm),
              Text(LocaleKeys.signatureBiometricConfirm.tr()),
            ],
          ),
        ),
        if (failureMessage != null) ...<Widget>[
          const SizedBox(height: AppSpacing.sm),
          Text(
            failureMessage!,
            style: Styles.s12(context).copyWith(color: AppColors.dangerColor),
          ),
        ],
      ],
    );
  }
}
