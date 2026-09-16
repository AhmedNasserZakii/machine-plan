import { describe, expect, it } from 'vitest';

import { can, canAll, canAny } from './can';
import { ANY_REPORT, P } from './permissions';

describe('permission helpers', () => {
  it('can / canAny / canAll', () => {
    const perms = [P.machinesRead, P.transfersRead];
    expect(can(perms, P.machinesRead)).toBe(true);
    expect(can(perms, P.machinesCreate)).toBe(false);
    expect(canAny(perms, ANY_REPORT)).toBe(false);
    expect(canAny(perms, [P.machinesRead, P.financeRead])).toBe(true);
    expect(canAll(perms, [P.machinesRead, P.transfersRead])).toBe(true);
    expect(canAll(perms, [P.machinesRead, P.financeRead])).toBe(false);
  });
});
