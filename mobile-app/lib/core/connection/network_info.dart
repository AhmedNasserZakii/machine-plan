import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

/// Exposes the app's current network transport availability.
abstract class NetworkInfo {
  Future<bool> get isConnected;
}

/// Reports whether the device has at least one network transport. This is
/// availability, not reachability of the backend — repositories treat a false
/// here as "offline, queue it".
class NetworkInfoImpl implements NetworkInfo {
  const NetworkInfoImpl({required this.connectivity});

  final Connectivity connectivity;

  /// iOS Simulator on newer runtimes can report [ConnectivityResult.none]
  /// even while HTTP to the API succeeds. Pass
  /// `--dart-define=FORCE_ONLINE=true` for local UI / Maestro runs.
  static const bool _forceOnline = bool.fromEnvironment('FORCE_ONLINE');

  @override
  Future<bool> get isConnected async {
    if (kDebugMode && _forceOnline) return true;

    final List<ConnectivityResult> results = await connectivity
        .checkConnectivity();
    return results.any((result) => result != ConnectivityResult.none);
  }
}
