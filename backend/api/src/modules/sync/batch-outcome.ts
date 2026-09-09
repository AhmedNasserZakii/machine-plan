import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from 'src/common/constants/error-codes';
import { SyncOperationStatus, SyncResolution } from 'src/common/enums/sync.enum';

export interface BatchOutcome {
  status: SyncOperationStatus;
  resolution: SyncResolution;
}

/**
 * Evidence the operation referenced has not reached the server yet. Uploads are supposed to run
 * before the batch (`20`, media in offline mode), but a queue that was drained out of order is
 * a timing problem, not a bad request — the same push will work once the photo lands.
 */
const RETRYABLE_CODES: readonly string[] = [
  ErrorCode.MEDIA_NOT_FOUND,
  ErrorCode.MEDIA_NOT_CONFIRMED,
];

/**
 * Wrong in a way no retry can fix and no person needs to arbitrate: the payload itself, the
 * caller's permissions, or a device clock nobody on the server can correct. Checked ahead of the
 * status rules because a rejected `occurredAt` answers `422` and would otherwise read as a
 * conflict with server state, which it is not.
 */
const DISCARD_CODES: readonly string[] = [
  ErrorCode.VALIDATION_FAILED,
  ErrorCode.INSUFFICIENT_PERMISSIONS,
  ErrorCode.INVALID_OCCURRED_AT,
];

/**
 * Custody and lifecycle collisions. These are reported as conflicts whatever status they carry:
 * `NOT_IN_YOUR_CUSTODY` answers HTTP `403` here, but for a device that has been offline it is not
 * a permission problem — the machine was moved by somebody else, and only a person can decide
 * what to do about that (`20`, conflict cases).
 */
const CONFLICT_CODES: readonly string[] = [
  ErrorCode.NOT_IN_YOUR_CUSTODY,
  ErrorCode.MACHINE_ALREADY_IN_TRANSIT,
  ErrorCode.TRANSFER_NOT_PENDING,
  ErrorCode.NOT_THE_RECEIVER,
];

/**
 * Turns a rejected operation into the pair the client acts on: what happened, and what to do
 * with the item still sitting in its queue.
 *
 * The server never loses a custody argument, so a conflict is always `MANUAL`: the app shows the
 * representative what actually happened rather than silently re-pushing his version of events.
 */
export function classifyFailure(status: HttpStatus, code: string): BatchOutcome {
  if (RETRYABLE_CODES.includes(code)) {
    return { status: SyncOperationStatus.FAILED, resolution: SyncResolution.RETRY };
  }

  if (DISCARD_CODES.includes(code)) {
    return { status: SyncOperationStatus.FAILED, resolution: SyncResolution.DISCARD };
  }

  if (
    CONFLICT_CODES.includes(code) ||
    status === HttpStatus.CONFLICT ||
    status === HttpStatus.UNPROCESSABLE_ENTITY
  ) {
    return { status: SyncOperationStatus.CONFLICT, resolution: SyncResolution.MANUAL };
  }

  // A timeout, a lost connection to the database, a deadlock: nothing the payload can fix, and
  // nothing a person needs to see either.
  if (status >= HttpStatus.INTERNAL_SERVER_ERROR || status === HttpStatus.REQUEST_TIMEOUT) {
    return { status: SyncOperationStatus.FAILED, resolution: SyncResolution.RETRY };
  }

  return { status: SyncOperationStatus.FAILED, resolution: SyncResolution.DISCARD };
}
