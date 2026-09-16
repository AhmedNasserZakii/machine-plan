import { describe, expect, it } from 'vitest';

import { ApiError, errorTreatment } from './client';
import { ErrorCode } from './error-codes';

describe('errorTreatment', () => {
  it('splits 409 from 422', () => {
    expect(errorTreatment(new ApiError(409, 'SERIAL_EXISTS', 'exists'))).toBe('conflict');
    expect(errorTreatment(new ApiError(422, 'SERIAL_IMMUTABLE', 'no'))).toBe('illegal');
  });

  it('maps 400 with details to field errors', () => {
    expect(
      errorTreatment(new ApiError(400, ErrorCode.VALIDATION_FAILED, 'bad', [{ field: 'phone' }])),
    ).toBe('field');
    expect(errorTreatment(new ApiError(400, ErrorCode.VALIDATION_FAILED, 'bad'))).toBe('form');
  });
});
