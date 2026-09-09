import 'package:flutter/foundation.dart';

/// App-wide connectivity signal.
///
/// Repositories and interceptors that discover the network is down report it
/// here so the offline banner reacts immediately instead of waiting for the
/// next connectivity poll.
final ValueNotifier<bool> networkConnectionStatus = ValueNotifier<bool>(true);

void reportNetworkConnectionStatus(bool isConnected) {
  if (networkConnectionStatus.value == isConnected) {
    return;
  }
  networkConnectionStatus.value = isConnected;
}
