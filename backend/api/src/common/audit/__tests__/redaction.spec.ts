import { redact, REDACTED_PLACEHOLDER } from '../redaction';

describe('redact', () => {
  it('redacts a known field at the top level', () => {
    expect(redact({ fullName: 'Ahmed', password: 'Temp#Pass1' })).toEqual({
      fullName: 'Ahmed',
      password: REDACTED_PLACEHOLDER,
    });
  });

  it('matches redacted fields case-insensitively and across snake_case / camelCase', () => {
    expect(redact({ PASSWORD_HASH: 'x', NationalId: '123' })).toEqual({
      PASSWORD_HASH: REDACTED_PLACEHOLDER,
      NationalId: REDACTED_PLACEHOLDER,
    });
  });

  it('redacts nested objects at any depth', () => {
    const input = { user: { profile: { nationalId: '29001010112345' } } };

    expect(redact(input)).toEqual({
      user: { profile: { nationalId: REDACTED_PLACEHOLDER } },
    });
  });

  it('redacts objects found inside arrays', () => {
    const input = { devices: [{ id: 'a', token: 'secret-token' }, { id: 'b' }] };

    expect(redact(input)).toEqual({
      devices: [{ id: 'a', token: REDACTED_PLACEHOLDER }, { id: 'b' }],
    });
  });

  it('leaves unrelated values, including null and dates, untouched', () => {
    const date = new Date('2026-09-08T00:00:00.000Z');
    const input = { status: 'ACTIVE', deletedAt: null, createdAt: date, count: 0 };

    expect(redact(input)).toEqual(input);
  });

  it('does not mutate the original object', () => {
    const input = { password: 'secret' };
    redact(input);
    expect(input.password).toBe('secret');
  });
});
