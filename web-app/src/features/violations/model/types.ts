import type { Schema } from '@/lib/api/types';

export type Violation = Schema<'ViolationResponse'>;
export type ViolationType = Schema<'ViolationTypeResponse'>;
export type ViolationTypeRef = Schema<'ViolationTypeRefResponse'>;
export type ViolationSummary = Schema<'ViolationSummaryResponse'>;
export type CreateViolationBody = Schema<'CreateViolationDto'>;
export type UpdateViolationBody = Schema<'UpdateViolationDto'>;
export type ChargeViolationBody = Schema<'ChargeViolationDto'>;
export type WaiveViolationBody = Schema<'WaiveViolationDto'>;
export type LookupRow = Schema<'LookupResponse'>;

export type ViolationStatus = Violation['status'];
export type ViolationSeverity = Violation['severity'];
export type ViolationTrend = ViolationSummary['trend'];

/** OpenAPI codegen maps some nullable scalars oddly; coerce for display. */
export function asText(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function isViolationSettled(status: ViolationStatus): boolean {
  return status === 'CHARGED' || status === 'WAIVED' || status === 'CLOSED';
}

export function canAcknowledgeViolation(
  violation: Pick<Violation, 'status' | 'user'>,
  currentUserId: string | null | undefined,
): boolean {
  return (
    violation.status === 'OPEN' &&
    Boolean(currentUserId) &&
    currentUserId === violation.user.id
  );
}

export function canChargeViolation(status: ViolationStatus): boolean {
  return !isViolationSettled(status) && status !== 'CHARGED';
}

export function canWaiveViolation(status: ViolationStatus): boolean {
  return !isViolationSettled(status);
}
