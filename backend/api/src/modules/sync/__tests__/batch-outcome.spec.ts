import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from 'src/common/constants/error-codes';
import { SyncOperationStatus, SyncResolution } from 'src/common/enums/sync.enum';
import { classifyFailure } from '../batch-outcome';

describe('classifyFailure', () => {
  it('reports a machine somebody else moved as a conflict for a person to settle', () => {
    expect(classifyFailure(HttpStatus.CONFLICT, ErrorCode.MACHINE_ALREADY_IN_TRANSIT)).toEqual({
      status: SyncOperationStatus.CONFLICT,
      resolution: SyncResolution.MANUAL,
    });
  });

  it('treats custody as a conflict even though it answers 403', () => {
    expect(classifyFailure(HttpStatus.FORBIDDEN, ErrorCode.NOT_IN_YOUR_CUSTODY)).toEqual({
      status: SyncOperationStatus.CONFLICT,
      resolution: SyncResolution.MANUAL,
    });
  });

  it('reports a transfer the sender withdrew as a conflict', () => {
    expect(classifyFailure(HttpStatus.CONFLICT, ErrorCode.TRANSFER_NOT_PENDING)).toEqual({
      status: SyncOperationStatus.CONFLICT,
      resolution: SyncResolution.MANUAL,
    });
  });

  it('reports a category that was deleted meanwhile as a conflict', () => {
    expect(
      classifyFailure(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.CATEGORY_KIND_MISMATCH),
    ).toEqual({
      status: SyncOperationStatus.CONFLICT,
      resolution: SyncResolution.MANUAL,
    });
  });

  it('asks the client to retry an operation whose photo has not been uploaded yet', () => {
    expect(classifyFailure(HttpStatus.NOT_FOUND, ErrorCode.MEDIA_NOT_FOUND)).toEqual({
      status: SyncOperationStatus.FAILED,
      resolution: SyncResolution.RETRY,
    });
  });

  it('retries an unconfirmed upload rather than calling it a conflict, despite the 422', () => {
    expect(classifyFailure(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.MEDIA_NOT_CONFIRMED)).toEqual(
      {
        status: SyncOperationStatus.FAILED,
        resolution: SyncResolution.RETRY,
      },
    );
  });

  it('tells the client to discard a payload that will never validate', () => {
    expect(classifyFailure(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED)).toEqual({
      status: SyncOperationStatus.FAILED,
      resolution: SyncResolution.DISCARD,
    });
  });

  it('discards a timestamp the device made up, rather than asking a human about it', () => {
    expect(classifyFailure(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.INVALID_OCCURRED_AT)).toEqual(
      {
        status: SyncOperationStatus.FAILED,
        resolution: SyncResolution.DISCARD,
      },
    );
  });

  it('discards an operation the caller is not allowed to perform', () => {
    expect(classifyFailure(HttpStatus.FORBIDDEN, ErrorCode.INSUFFICIENT_PERMISSIONS)).toEqual({
      status: SyncOperationStatus.FAILED,
      resolution: SyncResolution.DISCARD,
    });
  });

  it('discards a reference to something that does not exist on the server', () => {
    expect(classifyFailure(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND)).toEqual({
      status: SyncOperationStatus.FAILED,
      resolution: SyncResolution.DISCARD,
    });
  });

  it('retries anything the server itself got wrong', () => {
    expect(classifyFailure(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR)).toEqual({
      status: SyncOperationStatus.FAILED,
      resolution: SyncResolution.RETRY,
    });
  });

  it('retries a timeout', () => {
    expect(classifyFailure(HttpStatus.REQUEST_TIMEOUT, ErrorCode.REQUEST_TIMEOUT)).toEqual({
      status: SyncOperationStatus.FAILED,
      resolution: SyncResolution.RETRY,
    });
  });
});
