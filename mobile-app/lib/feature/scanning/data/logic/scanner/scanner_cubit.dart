import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/machines/domain/entities/machine_lookup_result.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo.dart';
import 'package:machinery/feature/scanning/data/logic/scanner/scanner_state.dart';

/// Resolves a scanned or typed code into a machine.
///
/// The camera fires a detection event many times a second while a sticker is in
/// frame, so this cubit — not the widget — owns the decision of what counts as
/// one scan: it ignores everything until the current lookup has finished, and
/// then ignores a repeat of the same code so a user staring at a "not found"
/// message is not fighting their own camera.
class ScannerCubit extends Cubit<ScannerState> {
  ScannerCubit({required this.machinesRepo}) : super(const ScannerScanning());

  final MachinesRepo machinesRepo;

  String? _lastCode;

  bool get isBusy => state is ScannerResolving;

  Future<void> onCodeDetected(String? raw) {
    final String code = raw?.trim() ?? '';

    if (code.isEmpty || isBusy || code == _lastCode) {
      return Future<void>.value();
    }

    return resolve(code);
  }

  /// Also the manual-entry path: someone reading a scratched sticker out loud
  /// should land in exactly the same place as the camera.
  Future<void> resolve(String code) async {
    final String trimmed = code.trim();
    if (trimmed.isEmpty) {
      return;
    }

    _lastCode = trimmed;
    emit(ScannerResolving(code: trimmed));

    final result = await machinesRepo.lookup(code: trimmed);

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) => emit(
        // A 404 here is not an error the user can retry their way out of — it
        // means this sticker belongs to no machine on file, and saying so is
        // more useful than showing the server's generic message.
        failure.statusCode == 404
            ? ScannerNotFound(code: trimmed)
            : ScannerFailure(
                code: trimmed,
                errorMessage: failure.errorMessage,
                isOffline: failure is OfflineFailure,
              ),
      ),
      (MachineLookupResult lookup) => emit(ScannerResolved(result: lookup)),
    );
  }

  /// Back to a live camera after a miss. The last code is forgotten so the same
  /// sticker can be tried again deliberately.
  void retry() {
    _lastCode = null;
    emit(const ScannerScanning());
  }
}
