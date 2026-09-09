import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/machines/domain/entities/machine_lookup_result.dart';
import 'package:machinery/feature/scanning/data/logic/scanner/scanner_cubit.dart';
import 'package:machinery/feature/scanning/data/logic/scanner/scanner_state.dart';
import 'package:machinery/feature/scanning/domain/entities/scan_decision.dart';
import 'package:machinery/feature/scanning/presentation/widgets/manual_entry_sheet.dart';
import 'package:machinery/feature/scanning/presentation/widgets/scanner_overlay.dart';
import 'package:machinery/feature/scanning/presentation/widgets/scanner_result_sheet.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

/// Whether one hit ends the session or the camera keeps running.
enum ScannerMode {
  /// Read one code, resolve it, pop the machine. Used by "find a machine".
  singleShot,

  /// Every hit is handed to [ScannerScreen.onContinuousHit] and the camera
  /// keeps running — built for adding many machines to one transfer without
  /// closing and reopening the camera forty times (`8.2`).
  continuous,
}

/// The one scanner screen, in either of two modes (`8.2`).
///
/// Manual entry sits beside the camera rather than behind an error, because a
/// scratched or sun-bleached sticker is the normal case in a warehouse, not an
/// exception — and a camera permission that was denied must not be a dead end.
/// Manual entry goes through [ScannerCubit.resolve] exactly like a camera hit,
/// so it is covered by the same mode logic below with no special-casing.
class ScannerScreen extends StatefulWidget {
  const ScannerScreen({
    super.key,
    this.mode = ScannerMode.singleShot,
    this.onContinuousHit,
  }) : assert(
         mode == ScannerMode.singleShot || onContinuousHit != null,
         'ScannerMode.continuous needs onContinuousHit',
       );

  final ScannerMode mode;

  /// Decides what one hit means (eligible? already added?) without the
  /// scanner ever closing. Required in continuous mode, unused otherwise.
  final Future<ScanDecision> Function(MachineLookupResult)? onContinuousHit;

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  late final MobileScannerController _controller = MobileScannerController(
    formats: const <BarcodeFormat>[BarcodeFormat.qrCode, BarcodeFormat.code128],
    detectionSpeed: DetectionSpeed.noDuplicates,
  );

  /// Most often a denied permission. Everything that talks about aiming a
  /// camera — the viewfinder, the torch, the "hold it over the sticker" hint —
  /// has to come off the screen when there is no camera to aim.
  bool _cameraFailed = false;

  /// Continuous mode only: how many hits this session has accepted, shown in
  /// the app bar so a rep scanning forty units can see progress without
  /// counting the pile in his hand.
  int _acceptedCount = 0;

  bool get _isContinuous => widget.mode == ScannerMode.continuous;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (capture.barcodes.isEmpty) {
      return;
    }

    context.read<ScannerCubit>().onCodeDetected(
      capture.barcodes.first.rawValue,
    );
  }

  Future<void> _openManualEntry() async {
    final String? code = await ManualEntrySheet.show(context);

    if (code == null || !mounted) {
      return;
    }

    await context.read<ScannerCubit>().resolve(code);
  }

  Future<void> _onResolved(MachineLookupResult result) async {
    if (_isContinuous) {
      final ScanDecision decision = await widget.onContinuousHit!(result);

      if (!mounted) {
        return;
      }

      // Neither branch closes the scanner (`8.2`) — the whole point of
      // continuous mode is that an ineligible or duplicate hit is just one
      // more thing to say out loud before the camera keeps looking.
      if (decision.isAccepted) {
        setState(() => _acceptedCount++);
        showSuccessToast(
          LocaleKeys.scanAdded.tr(args: <String>[result.machine.serial]),
          context,
        );
      } else {
        showErrorToast(decision.rejectionReason!, context);
      }

      context.read<ScannerCubit>().retry();
      return;
    }

    // A confirmation step, not a straight pop: the scan may have matched on the
    // battery or SIM sticker, and the user has to see which machine that is
    // before the app acts on it.
    final bool? confirmed = await ScannerResultSheet.show(
      context: context,
      result: result,
    );

    if (!mounted) {
      return;
    }

    if (confirmed ?? false) {
      Navigator.of(context).pop(result);
      return;
    }

    context.read<ScannerCubit>().retry();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(
          _isContinuous
              ? LocaleKeys.scanContinuousTitle.tr(
                  args: <String>['$_acceptedCount'],
                )
              : LocaleKeys.scanTitle.tr(),
        ),
        actions: <Widget>[
          if (_isContinuous)
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Semantics(
                identifier: 'scanner_done_button',
                child: Text(LocaleKeys.done.tr()),
              ),
            ),
          if (!_cameraFailed)
            IconButton(
              onPressed: _controller.toggleTorch,
              icon: const Icon(Icons.flashlight_on_outlined),
              tooltip: LocaleKeys.scanTorch.tr(),
            ),
        ],
      ),
      body: BlocConsumer<ScannerCubit, ScannerState>(
        listener: (BuildContext context, ScannerState state) {
          if (state is ScannerResolved) {
            _onResolved(state.result);
          }

          if (state is ScannerFailure) {
            showErrorToast(state.errorMessage, context);
            context.read<ScannerCubit>().retry();
          }
        },
        builder: (BuildContext context, ScannerState state) {
          return Stack(
            fit: StackFit.expand,
            children: <Widget>[
              MobileScanner(
                controller: _controller,
                onDetect: _onDetect,
                errorBuilder:
                    (BuildContext context, MobileScannerException error) {
                      // The flag is read by the rest of the tree, so it has to
                      // be set outside this build pass.
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        if (mounted && !_cameraFailed) {
                          setState(() => _cameraFailed = true);
                        }
                      });

                      return _CameraUnavailable(
                        onManualEntry: _openManualEntry,
                      );
                    },
              ),
              if (!_cameraFailed) ...<Widget>[
                ScannerOverlay(state: state),
                PositionedDirectional(
                  start: AppSpacing.lg,
                  end: AppSpacing.lg,
                  bottom: AppSpacing.xl,
                  child: SafeArea(
                    child: _BottomActions(
                      state: state,
                      onManualEntry: _openManualEntry,
                      onRetry: () => context.read<ScannerCubit>().retry(),
                    ),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _BottomActions extends StatelessWidget {
  const _BottomActions({
    required this.state,
    required this.onManualEntry,
    required this.onRetry,
  });

  final ScannerState state;
  final VoidCallback onManualEntry;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    if (state is ScannerNotFound) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: Text(LocaleKeys.scanRetry.tr()),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextButton(
            onPressed: onManualEntry,
            child: Text(LocaleKeys.scanManualEntry.tr()),
          ),
        ],
      );
    }

    return FilledButton.tonalIcon(
      onPressed: onManualEntry,
      icon: const Icon(Icons.keyboard_alt_outlined),
      label: Semantics(
        identifier: 'scanner_manual_entry_button',
        child: Text(LocaleKeys.scanManualEntry.tr()),
      ),
    );
  }
}

/// Shown when the camera cannot start at all — most often a denied permission.
/// Typing the serial still works, so this is a detour rather than a wall.
class _CameraUnavailable extends StatelessWidget {
  const _CameraUnavailable({required this.onManualEntry});

  final VoidCallback onManualEntry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Icon(Icons.no_photography_outlined, size: 48),
            const SizedBox(height: AppSpacing.md),
            Text(LocaleKeys.scanCameraDenied.tr(), textAlign: TextAlign.center),
            const SizedBox(height: AppSpacing.sm),
            Text(
              LocaleKeys.scanCameraDeniedHint.tr(),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.lg),
            FilledButton.icon(
              onPressed: onManualEntry,
              icon: const Icon(Icons.keyboard_alt_outlined),
              label: Text(LocaleKeys.scanManualEntry.tr()),
            ),
          ],
        ),
      ),
    );
  }
}
