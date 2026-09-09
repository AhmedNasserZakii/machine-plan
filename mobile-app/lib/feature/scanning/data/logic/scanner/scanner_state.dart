import 'package:equatable/equatable.dart';
import 'package:machinery/feature/machines/domain/entities/machine_lookup_result.dart';

sealed class ScannerState extends Equatable {
  const ScannerState();

  @override
  List<Object?> get props => <Object?>[];
}

/// The camera is live and nothing has been read yet.
class ScannerScanning extends ScannerState {
  const ScannerScanning();
}

/// A code was captured and is being resolved. The camera stays paused for the
/// duration, otherwise the same sticker fires the lookup a dozen more times.
class ScannerResolving extends ScannerState {
  const ScannerResolving({required this.code});

  final String code;

  @override
  List<Object?> get props => <Object?>[code];
}

class ScannerResolved extends ScannerState {
  const ScannerResolved({required this.result});

  final MachineLookupResult result;

  @override
  List<Object?> get props => <Object?>[result];
}

/// The code scanned cleanly but matched no machine, which is a different
/// problem from the camera failing and gets a different message.
class ScannerNotFound extends ScannerState {
  const ScannerNotFound({required this.code});

  final String code;

  @override
  List<Object?> get props => <Object?>[code];
}

class ScannerFailure extends ScannerState {
  const ScannerFailure({
    required this.code,
    required this.errorMessage,
    this.isOffline = false,
  });

  final String code;
  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[code, errorMessage, isOffline];
}
