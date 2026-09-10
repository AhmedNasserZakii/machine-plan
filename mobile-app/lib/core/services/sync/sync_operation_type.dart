/// The offline operations a device may queue and push through `POST
/// /sync/batch` (backend `src/common/enums/sync.enum.ts`).
///
/// Values match the backend's `SyncOperationType` enum exactly — they are
/// sent as-is in the batch payload's `type` field.
enum SyncOperationType {
  createTransfer('CREATE_TRANSFER'),
  confirmTransfer('CONFIRM_TRANSFER'),
  rejectTransfer('REJECT_TRANSFER'),
  createMerchant('CREATE_MERCHANT'),
  createSubscription('CREATE_SUBSCRIPTION'),
  createFinanceTransaction('CREATE_FINANCE_TRANSACTION');

  const SyncOperationType(this.value);

  final String value;

  static SyncOperationType? fromJson(String? value) {
    for (final SyncOperationType type in SyncOperationType.values) {
      if (type.value == value) return type;
    }
    return null;
  }
}

/// What the app should do with a queued item once the server has answered for
/// it (backend `SyncResolution`).
enum SyncResolution {
  /// Permanent: the operation will never succeed as queued. Drop it, tell the
  /// user why.
  discard('DISCARD'),

  /// Transient: push it again later, unchanged.
  retry('RETRY'),

  /// A human has to decide — the server's state contradicts what the device
  /// recorded (a custody or signed-transfer conflict).
  manual('MANUAL');

  const SyncResolution(this.value);

  final String value;

  static SyncResolution? fromJson(String? value) {
    for (final SyncResolution resolution in SyncResolution.values) {
      if (resolution.value == value) return resolution;
    }
    return null;
  }
}

/// The server's verdict on one queued operation (backend `SyncOperationStatus`).
enum SyncBatchOutcome {
  success('SUCCESS'),
  duplicate('DUPLICATE'),
  conflict('CONFLICT'),
  failed('FAILED');

  const SyncBatchOutcome(this.value);

  final String value;

  static SyncBatchOutcome? fromJson(String? value) {
    for (final SyncBatchOutcome outcome in SyncBatchOutcome.values) {
      if (outcome.value == value) return outcome;
    }
    return null;
  }
}
