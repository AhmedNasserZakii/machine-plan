import { ErrorCode } from '../../constants/error-codes';
import { resolveErrorMessage } from '../error-messages';

describe('resolveErrorMessage', () => {
  it('returns the Arabic message by default', () => {
    expect(resolveErrorMessage(ErrorCode.INVALID_CREDENTIALS)).toBe(
      'رقم الهاتف أو كلمة المرور غير صحيحة',
    );
  });

  it('returns the English message when the locale is en', () => {
    expect(resolveErrorMessage(ErrorCode.INVALID_CREDENTIALS, 'en')).toBe(
      'Invalid phone number or password',
    );
  });

  it('interpolates params into the template', () => {
    expect(
      resolveErrorMessage(ErrorCode.MACHINE_ALREADY_IN_TRANSIT, 'en', { serial: 'SN-00341' }),
    ).toBe('Machine SN-00341 is already part of a pending transfer');
  });

  it('leaves the placeholder in place when a param is missing', () => {
    expect(resolveErrorMessage(ErrorCode.SERIAL_EXISTS, 'en')).toContain('{serial}');
  });

  it('falls back to the code itself for an unknown code', () => {
    expect(resolveErrorMessage('NOT_A_REAL_CODE', 'en')).toBe('NOT_A_REAL_CODE');
  });

  it('has both locales defined for every declared error code', () => {
    for (const code of Object.values(ErrorCode)) {
      expect(resolveErrorMessage(code, 'ar')).not.toBe(code);
      expect(resolveErrorMessage(code, 'en')).not.toBe(code);
    }
  });
});
