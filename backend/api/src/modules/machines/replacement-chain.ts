import { MachineStatus } from 'src/common/enums/machine-status.enum';

/**
 * One machine as the chain query returns it: its own numbers, the link that produced it, and the
 * moment it was itself replaced.
 */
export interface ChainMember {
  id: string;
  serial: string;
  status: MachineStatus;
  purchasePrice: number | null;
  purchaseDate: string | null;
  repairCount: number;
  repairCost: number;
  replacesMachineId: string | null;
  createdAt: Date;
  /** When this machine was swapped out; null for the unit still in service. */
  replacedAt: Date | null;
  replacedReason: string | null;
}

export interface ChainLink extends ChainMember {
  /** 1-based, oldest first — the number the Director reads as "the third machine". */
  position: number;
  activeFrom: Date;
  activeTo: Date | null;
  isCurrent: boolean;
}

export interface ChainTotals {
  purchasePrice: number | null;
  cumulativeRepairCost: number;
  cumulativeRepairCount: number;
  /** Null while the asset has no purchase price: a ratio against nothing says nothing. */
  costToValueRatio: number | null;
  ageMonths: number;
  chainLength: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 30.44;

/**
 * Orders the members oldest first by following `replaces_machine_id` forward from the root.
 *
 * The database guarantees the chain is linear — both link columns are unique — but a member set
 * arriving with a missing row (a link the caller could not see) must still produce a usable list
 * rather than an empty one, so anything not reachable from the root is appended in insertion
 * order instead of dropped.
 */
export function orderChain(members: readonly ChainMember[]): ChainMember[] {
  if (members.length <= 1) return [...members];

  const byId = new Map(members.map((member) => [member.id, member]));
  const childOf = new Map<string, ChainMember>();

  for (const member of members) {
    if (member.replacesMachineId) childOf.set(member.replacesMachineId, member);
  }

  const root =
    members.find(
      (member) => member.replacesMachineId === null || !byId.has(member.replacesMachineId),
    ) ?? members[0];

  const ordered: ChainMember[] = [];
  const seen = new Set<string>();

  let cursor: ChainMember | undefined = root;
  while (cursor && !seen.has(cursor.id)) {
    ordered.push(cursor);
    seen.add(cursor.id);
    cursor = childOf.get(cursor.id);
  }

  for (const member of members) {
    if (!seen.has(member.id)) ordered.push(member);
  }

  return ordered;
}

/**
 * Adds the window each serial was the live unit for. A machine's service starts when the one
 * before it was swapped out, not when its row was created — the record is often typed up days
 * after the factory handed the replacement over.
 */
export function chainLinks(members: readonly ChainMember[]): ChainLink[] {
  const ordered = orderChain(members);

  return ordered.map((member, index) => {
    const previous = index === 0 ? null : ordered[index - 1];
    const activeFrom =
      previous?.replacedAt ??
      (index === 0 && member.purchaseDate
        ? new Date(`${member.purchaseDate}T00:00:00.000Z`)
        : member.createdAt);

    return {
      ...member,
      position: index + 1,
      activeFrom,
      activeTo: member.replacedAt,
      isCurrent: member.replacedAt === null,
    };
  });
}

/**
 * What the asset has cost across every serial it has worn (`12`). Per-machine numbers would hide
 * the history behind each swap, which is the whole reason the chain is modelled at all.
 */
export function chainTotals(members: readonly ChainMember[], now = new Date()): ChainTotals {
  const links = chainLinks(members);
  const root = links[0];

  const cumulativeRepairCost = links.reduce((sum, link) => sum + link.repairCost, 0);
  const cumulativeRepairCount = links.reduce((sum, link) => sum + link.repairCount, 0);

  // The price is copied onto every replacement (`12`, step 3), so any link carries it; the root is
  // read because it is the one that was actually bought.
  const purchasePrice = root?.purchasePrice ?? null;

  return {
    purchasePrice,
    cumulativeRepairCost,
    cumulativeRepairCount,
    costToValueRatio:
      purchasePrice && purchasePrice > 0
        ? Math.round((cumulativeRepairCost / purchasePrice) * 100) / 100
        : null,
    ageMonths: root ? monthsBetween(root.activeFrom, now) : 0,
    chainLength: links.length,
  };
}

/** Whole months, floored: an asset is "19 months old" until it is 20, never 19.6. */
export function monthsBetween(from: Date, to: Date): number {
  const days = (to.getTime() - from.getTime()) / MS_PER_DAY;
  return days <= 0 ? 0 : Math.floor(days / DAYS_PER_MONTH);
}
