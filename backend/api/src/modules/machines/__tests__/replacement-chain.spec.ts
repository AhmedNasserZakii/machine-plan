import { MachineStatus } from 'src/common/enums/machine-status.enum';
import {
  ChainMember,
  chainLinks,
  chainTotals,
  monthsBetween,
  orderChain,
} from '../replacement-chain';

function member(overrides: Partial<ChainMember> & { id: string }): ChainMember {
  return {
    serial: `SN-${overrides.id}`,
    status: MachineStatus.REPLACED,
    purchasePrice: null,
    purchaseDate: null,
    repairCount: 0,
    repairCost: 0,
    replacesMachineId: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    replacedAt: null,
    replacedReason: null,
    ...overrides,
  };
}

/** The chain from `12`: SN-00341 → SN-00712 → SN-01108, the last one still in service. */
const FIRST = member({
  id: 'a',
  serial: 'SN-00341',
  purchasePrice: 4200,
  purchaseDate: '2025-02-10',
  repairCount: 3,
  repairCost: 1850,
  createdAt: new Date('2025-02-10T00:00:00.000Z'),
  replacedAt: new Date('2026-03-02T00:00:00.000Z'),
  replacedReason: 'لوحة رئيسية تالفة',
});

const SECOND = member({
  id: 'b',
  serial: 'SN-00712',
  purchasePrice: 4200,
  purchaseDate: '2025-02-10',
  repairCount: 1,
  repairCost: 400,
  replacesMachineId: 'a',
  createdAt: new Date('2026-03-02T00:00:00.000Z'),
  replacedAt: new Date('2026-07-19T00:00:00.000Z'),
});

const THIRD = member({
  id: 'c',
  serial: 'SN-01108',
  status: MachineStatus.WITH_MERCHANT,
  purchasePrice: 4200,
  purchaseDate: '2025-02-10',
  replacesMachineId: 'b',
  createdAt: new Date('2026-07-19T00:00:00.000Z'),
});

const CHAIN = [THIRD, FIRST, SECOND];

describe('orderChain', () => {
  it('puts the members oldest first whatever order they arrive in', () => {
    expect(orderChain(CHAIN).map((link) => link.serial)).toEqual([
      'SN-00341',
      'SN-00712',
      'SN-01108',
    ]);
  });

  it('leaves a single machine alone', () => {
    expect(orderChain([THIRD])).toEqual([THIRD]);
  });

  /**
   * A link the caller could not see would otherwise sink the whole list. The set is still
   * usable, so the unreachable members are appended rather than dropped.
   */
  it('keeps members it cannot reach from the root', () => {
    const orphaned = member({ id: 'z', replacesMachineId: 'missing' });

    expect(orderChain([FIRST, orphaned]).map((link) => link.id)).toEqual(['a', 'z']);
  });
});

describe('chainLinks', () => {
  it('numbers the positions from the oldest serial', () => {
    expect(chainLinks(CHAIN).map((link) => link.position)).toEqual([1, 2, 3]);
  });

  /** Service starts when the unit before it was swapped out, not when its row was typed up. */
  it('opens each window at the previous swap', () => {
    const links = chainLinks(CHAIN);

    expect(links[0].activeFrom.toISOString()).toBe('2025-02-10T00:00:00.000Z');
    expect(links[1].activeFrom).toEqual(FIRST.replacedAt);
    expect(links[2].activeFrom).toEqual(SECOND.replacedAt);
  });

  it('marks only the machine that has not been replaced as current', () => {
    expect(chainLinks(CHAIN).map((link) => link.isCurrent)).toEqual([false, false, true]);
  });

  it('closes every window except the live one', () => {
    expect(chainLinks(CHAIN).map((link) => link.activeTo)).toEqual([
      FIRST.replacedAt,
      SECOND.replacedAt,
      null,
    ]);
  });
});

describe('chainTotals', () => {
  const NOW = new Date('2026-09-08T00:00:00.000Z');

  it('sums the repair spend across every serial the asset has worn', () => {
    const totals = chainTotals(CHAIN, NOW);

    expect(totals.cumulativeRepairCost).toBe(2250);
    expect(totals.cumulativeRepairCount).toBe(4);
    expect(totals.chainLength).toBe(3);
  });

  /** The price is copied onto each replacement, so the root is what was actually bought. */
  it('reads the purchase price off the root', () => {
    expect(chainTotals(CHAIN, NOW).purchasePrice).toBe(4200);
    expect(chainTotals(CHAIN, NOW).costToValueRatio).toBe(0.54);
  });

  /** Measured from February 2025, when the first serial was bought — not from July 2026. */
  it('ages the asset from the root, not from the current serial', () => {
    expect(chainTotals(CHAIN, NOW).ageMonths).toBe(18);
    expect(chainTotals([THIRD], NOW).ageMonths).toBe(18);
  });

  it('withholds a ratio when nothing was paid for the machine', () => {
    const priceless = chainTotals([member({ id: 'a', repairCost: 900 })], NOW);

    expect(priceless.costToValueRatio).toBeNull();
    expect(priceless.cumulativeRepairCost).toBe(900);
  });

  it('reports an empty chain as zeros rather than throwing', () => {
    expect(chainTotals([], NOW)).toEqual({
      purchasePrice: null,
      cumulativeRepairCost: 0,
      cumulativeRepairCount: 0,
      costToValueRatio: null,
      ageMonths: 0,
      chainLength: 0,
    });
  });
});

describe('monthsBetween', () => {
  it('floors to whole months', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');

    expect(monthsBetween(from, new Date('2026-01-31T00:00:00.000Z'))).toBe(0);
    expect(monthsBetween(from, new Date('2026-02-05T00:00:00.000Z'))).toBe(1);
  });

  it('never reports a negative age', () => {
    expect(monthsBetween(new Date('2026-05-01Z'), new Date('2026-01-01Z'))).toBe(0);
  });
});
