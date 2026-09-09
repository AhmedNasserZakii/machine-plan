/// How many locally-queued operations have not reached the server yet.
///
/// Logout has to warn before discarding unsent work, but the queue itself
/// arrives with the offline-sync phase. This seam lets the warning be written
/// and tested now; the sqflite-backed implementation replaces the default
/// later without touching any caller.
abstract class PendingSyncCounter {
  Future<int> pendingCount();
}

class EmptyPendingSyncCounter implements PendingSyncCounter {
  const EmptyPendingSyncCounter();

  @override
  Future<int> pendingCount() async => 0;
}
