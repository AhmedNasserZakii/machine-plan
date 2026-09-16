export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

export const MACHINE_STATUS_TONE: Record<string, Tone> = {
  IN_COMPANY_WAREHOUSE: 'neutral',
  IN_BRANCH_WAREHOUSE: 'info',
  WITH_SUPERVISOR: 'info',
  // Dart paints this with primaryLightColor, not primaryColor.
  WITH_REPRESENTATIVE: 'primary',
  WITH_MERCHANT: 'success',
  IN_TRANSIT: 'warning',
  UNDER_MAINTENANCE: 'warning',
  AT_FACTORY: 'warning',
  AT_SERVICE_CENTER: 'warning',
  REPLACED: 'neutral',
  DECOMMISSIONED: 'danger',
  UNKNOWN: 'neutral',
};

export const TRANSFER_STATUS_TONE: Record<string, Tone> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  UNKNOWN: 'neutral',
};

export const MAINTENANCE_STATUS_TONE: Record<string, Tone> = {
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  RETURNED: 'primary',
  CLOSED: 'success',
  CANCELLED: 'neutral',
  UNKNOWN: 'neutral',
};

export const VIOLATION_STATUS_TONE: Record<string, Tone> = {
  OPEN: 'warning',
  ACKNOWLEDGED: 'info',
  WAIVED: 'neutral',
  CHARGED: 'danger',
  CLOSED: 'success',
  UNKNOWN: 'neutral',
};

export const SEVERITY_TONE: Record<string, Tone> = {
  LOW: 'info',
  MEDIUM: 'warning',
  HIGH: 'danger',
  UNKNOWN: 'neutral',
};

export const BUDGET_TONE: Record<string, Tone> = {
  OK: 'success',
  WARNING: 'warning',
  EXCEEDED: 'danger',
  UNKNOWN: 'neutral',
};

export function toneColorVar(tone: Tone, status?: string): string {
  if (status === 'WITH_REPRESENTATIVE') return 'var(--color-primary-light)';
  switch (tone) {
    case 'success':
      return 'var(--color-success)';
    case 'warning':
      return 'var(--color-warning)';
    case 'danger':
      return 'var(--color-danger)';
    case 'info':
      return 'var(--color-info)';
    case 'primary':
      return 'var(--color-primary)';
    default:
      return 'var(--color-neutral)';
  }
}

export function toneSurfaceVar(tone: Tone, status?: string): string {
  if (status === 'WITH_REPRESENTATIVE') return 'var(--color-info-surface)';
  switch (tone) {
    case 'success':
      return 'var(--color-success-surface)';
    case 'warning':
      return 'var(--color-warning-surface)';
    case 'danger':
      return 'var(--color-danger-surface)';
    case 'info':
    case 'primary':
      return 'var(--color-info-surface)';
    default:
      return 'var(--color-neutral-surface)';
  }
}
