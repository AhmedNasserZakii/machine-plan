import { diffSnapshots } from '../audit-diff';
import { REDACTED_PLACEHOLDER } from '../redaction';

describe('diffSnapshots', () => {
  it('treats a null before as a creation: the whole after is kept, before stays null', () => {
    const result = diffSnapshots(null, { status: 'PENDING', cost: 0 });

    expect(result).toEqual({ before: null, after: { status: 'PENDING', cost: 0 } });
  });

  it('treats a null after as a deletion: the whole before is kept, after stays null', () => {
    const result = diffSnapshots({ status: 'ACTIVE' }, null);

    expect(result).toEqual({ before: { status: 'ACTIVE' }, after: null });
  });

  it('returns nulls on both sides when nothing changed', () => {
    const result = diffSnapshots({ status: 'PENDING' }, { status: 'PENDING' });

    expect(result).toEqual({ before: null, after: null });
  });

  it('keeps only the keys whose value actually changed', () => {
    const result = diffSnapshots(
      { status: 'RETURNED', cost: 0, location: 'branch-1' },
      { status: 'CLOSED', cost: 450, location: 'branch-1' },
    );

    expect(result).toEqual({
      before: { status: 'RETURNED', cost: 0 },
      after: { status: 'CLOSED', cost: 450 },
    });
  });

  it('treats a null-to-value change as a change', () => {
    const result = diffSnapshots({ signedAt: null }, { signedAt: '2026-09-08T10:00:00.000Z' });

    expect(result).toEqual({
      before: { signedAt: null },
      after: { signedAt: '2026-09-08T10:00:00.000Z' },
    });
  });

  it('treats a value-to-null change as a change', () => {
    const result = diffSnapshots({ merchantId: 'merchant-1' }, { merchantId: null });

    expect(result).toEqual({
      before: { merchantId: 'merchant-1' },
      after: { merchantId: null },
    });
  });

  it('compares array values by content, ignoring order-insensitive false negatives on equal arrays', () => {
    const same = diffSnapshots({ tags: [1, 2, 3] }, { tags: [1, 2, 3] });
    expect(same).toEqual({ before: null, after: null });

    const changed = diffSnapshots({ tags: [1, 2] }, { tags: [1, 2, 3] });
    expect(changed).toEqual({ before: { tags: [1, 2] }, after: { tags: [1, 2, 3] } });
  });

  it('compares nested objects as a whole value at the top-level key', () => {
    const result = diffSnapshots({ address: { city: 'Cairo' } }, { address: { city: 'Giza' } });

    expect(result).toEqual({
      before: { address: { city: 'Cairo' } },
      after: { address: { city: 'Giza' } },
    });
  });

  it('reports a key present on only one side as changed', () => {
    const result = diffSnapshots({ status: 'PENDING' }, { status: 'PENDING', confirmedBy: 'u1' });

    expect(result).toEqual({ before: null, after: { confirmedBy: 'u1' } });
  });

  it('redacts a changed field on both sides', () => {
    const result = diffSnapshots(
      { passwordHash: 'old-hash', fullName: 'Ahmed' },
      { passwordHash: 'new-hash', fullName: 'Ahmed' },
    );

    expect(result).toEqual({
      before: { passwordHash: REDACTED_PLACEHOLDER },
      after: { passwordHash: REDACTED_PLACEHOLDER },
    });
  });

  it('redacts the whole-entity creation and deletion paths too', () => {
    expect(diffSnapshots(null, { nationalId: '123' })).toEqual({
      before: null,
      after: { nationalId: REDACTED_PLACEHOLDER },
    });
    expect(diffSnapshots({ nationalId: '123' }, null)).toEqual({
      before: { nationalId: REDACTED_PLACEHOLDER },
      after: null,
    });
  });
});
