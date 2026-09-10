/** The offline operations a device may queue and push through `POST /sync/batch` (`20`). */
export enum SyncOperationType {
  CREATE_TRANSFER = 'CREATE_TRANSFER',
  CONFIRM_TRANSFER = 'CONFIRM_TRANSFER',
  REJECT_TRANSFER = 'REJECT_TRANSFER',
  CREATE_MERCHANT = 'CREATE_MERCHANT',
  CREATE_SUBSCRIPTION = 'CREATE_SUBSCRIPTION',
  CREATE_FINANCE_TRANSACTION = 'CREATE_FINANCE_TRANSACTION',
}

export const SYNC_OPERATION_TYPES = Object.values(SyncOperationType);

export enum SyncOperationStatus {
  SUCCESS = 'SUCCESS',
  /** The server already had this `clientUuid`; the original id comes back untouched. */
  DUPLICATE = 'DUPLICATE',
  /** The world moved while the device was offline, and the server's version wins. */
  CONFLICT = 'CONFLICT',
  FAILED = 'FAILED',
}

/** What the app should do with the queued item it just got an answer for. */
export enum SyncResolution {
  /** Permanent: the operation will never succeed as queued. Drop it and tell the user. */
  DISCARD = 'DISCARD',
  /** Transient: push it again later, unchanged. */
  RETRY = 'RETRY',
  /** A human has to decide, because the server's state contradicts what the device recorded. */
  MANUAL = 'MANUAL',
}
