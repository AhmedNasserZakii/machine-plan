import { PartyType } from 'src/common/enums/transfer.enum';
import { SystemRole } from 'src/modules/roles/entities/role.entity';

/**
 * Which party a signed-in user *is*, derived from their role. Custody rules are written in terms
 * of parties, and a request only says "I am sending" — this is what turns the caller into a side
 * of the graph.
 *
 * A director is not a party of his own: he acts on behalf of the company warehouse, which is why
 * he can dispatch to a branch but cannot personally hold a machine.
 */
const PARTY_BY_ROLE: Record<string, PartyType> = {
  [SystemRole.DIRECTOR]: PartyType.WAREHOUSE,
  [SystemRole.BRANCH_SUPERVISOR]: PartyType.SUPERVISOR,
  [SystemRole.REPRESENTATIVE]: PartyType.REPRESENTATIVE,
};

export function partyForRole(roleCode: string): PartyType | null {
  return PARTY_BY_ROLE[roleCode] ?? null;
}

/**
 * The inverse, for listing who may receive a hand-off. Only meaningful for the two parties that
 * are people; a warehouse has no role code, which is why the caller checks `USER_PARTIES` first.
 */
export function roleCodeFor(party: PartyType): string | null {
  const match = Object.entries(PARTY_BY_ROLE).find(([, value]) => value === party);
  return match?.[0] ?? null;
}

/** Parties whose id is a `users.id`. Everything else is a warehouse, a merchant, or nothing. */
export const USER_PARTIES: readonly PartyType[] = [PartyType.SUPERVISOR, PartyType.REPRESENTATIVE];

/** Parties that exist only as a concept: there is no row and no signature to collect. */
export const ABSTRACT_PARTIES: readonly PartyType[] = [PartyType.FACTORY, PartyType.SERVICE_CENTER];

/**
 * Parties that never hold a login. When one of these is the *sender*, the hand-off is still real —
 * a merchant hands a machine back, a factory ships a repaired batch — but nobody on that side can
 * open the app. The receiving party books it in instead, which is exactly what happens on paper.
 */
export const UNREPRESENTED_PARTIES: readonly PartyType[] = [
  PartyType.FACTORY,
  PartyType.MERCHANT,
  PartyType.SERVICE_CENTER,
];
