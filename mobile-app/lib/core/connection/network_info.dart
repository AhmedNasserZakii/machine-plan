import 'package:connectivity_plus/connectivity_plus.dart';

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

  @override
  Future<bool> get isConnected async {
    final List<ConnectivityResult> results = await connectivity
        .checkConnectivity();
    return results.any((result) => result != ConnectivityResult.none);
  }
}
