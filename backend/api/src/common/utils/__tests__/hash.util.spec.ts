import { sha256Object } from '../hash.util';

describe('sha256Object', () => {
  it('is stable regardless of key order', () => {
    const a = sha256Object({ machineId: 'm1', hasCharger: true, condition: 'GOOD' });
    const b = sha256Object({ condition: 'GOOD', hasCharger: true, machineId: 'm1' });

    expect(a).toBe(b);
  });

  it('changes when a value changes', () => {
    const before = sha256Object({ items: [{ machineId: 'm1', hasCharger: true }] });
    const after = sha256Object({ items: [{ machineId: 'm1', hasCharger: false }] });

    expect(before).not.toBe(after);
  });

  it('is order-sensitive for arrays', () => {
    const first = sha256Object({ items: ['a', 'b'] });
    const second = sha256Object({ items: ['b', 'a'] });

    expect(first).not.toBe(second);
  });

  it('treats a missing key and an explicit undefined as equal', () => {
    expect(sha256Object({ a: 1, b: undefined })).toBe(sha256Object({ a: 1 }));
  });

  it('serializes dates deterministically', () => {
    const iso = '2026-09-07T12:00:00.000Z';
    expect(sha256Object({ at: new Date(iso) })).toBe(sha256Object({ at: new Date(iso) }));
  });

  it('produces a 64-character hex digest', () => {
    expect(sha256Object({ any: 'value' })).toMatch(/^[0-9a-f]{64}$/);
  });
});
