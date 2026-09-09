import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/scanning/presentation/widgets/manual_entry_sheet.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

/// Reads one barcode and pops with the raw string — no lookup, no machine
/// record required.
///
/// The main [ScannerScreen] resolves a code against a known machine, which is
/// right for "find a machine" but wrong for battery scanning during a
/// transfer confirmation (`8.2`): a receiver has to be able to record
/// whatever the sticker actually says, including a battery that was swapped
/// in and never registered anywhere — the mismatch itself is the point, and
/// the server compares it against the expected serial, not this screen.
class RawBarcodeScannerScreen extends StatefulWidget {
  const RawBarcodeScannerScreen({super.key, this.titleKey});

  final String? titleKey;

  @override
  State<RawBarcodeScannerScreen> createState() =>
      _RawBarcodeScannerScreenState();
}

class _RawBarcodeScannerScreenState extends State<RawBarcodeScannerScreen> {
  late final MobileScannerController _controller = MobileScannerController(
    formats: const <BarcodeFormat>[BarcodeFormat.qrCode, BarcodeFormat.code128],
    detectionSpeed: DetectionSpeed.noDuplicates,
  );

  bool _cameraFailed = false;
  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled || capture.barcodes.isEmpty) {
      return;
    }

    final String? raw = capture.barcodes.first.rawValue?.trim();
    if (raw == null || raw.isEmpty) {
      return;
    }

    _handled = true;
    Navigator.of(context).pop(raw);
  }

  Future<void> _openManualEntry() async {
    final String? code = await ManualEntrySheet.show(context);

    if (code == null || !mounted) {
      return;
    }

    Navigator.of(context).pop(code);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text((widget.titleKey ?? LocaleKeys.scanTitle).tr()),
        actions: <Widget>[
          if (!_cameraFailed)
            IconButton(
              onPressed: _controller.toggleTorch,
              icon: const Icon(Icons.flashlight_on_outlined),
              tooltip: LocaleKeys.scanTorch.tr(),
            ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: <Widget>[
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            errorBuilder: (BuildContext context, MobileScannerException error) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted && !_cameraFailed) {
                  setState(() => _cameraFailed = true);
                }
              });

              return Center(
                child: Padding(
                  padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      const Icon(Icons.no_photography_outlined, size: 48),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        LocaleKeys.scanCameraDenied.tr(),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      FilledButton.icon(
                        onPressed: _openManualEntry,
                        icon: const Icon(Icons.keyboard_alt_outlined),
                        label: Text(LocaleKeys.scanManualEntry.tr()),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
          if (!_cameraFailed)
            PositionedDirectional(
              start: AppSpacing.lg,
              end: AppSpacing.lg,
              bottom: AppSpacing.xl,
              child: SafeArea(
                child: FilledButton.tonalIcon(
                  onPressed: _openManualEntry,
                  icon: const Icon(Icons.keyboard_alt_outlined),
                  label: Semantics(
                    identifier: 'raw_scanner_manual_entry_button',
                    child: Text(LocaleKeys.scanManualEntry.tr()),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
