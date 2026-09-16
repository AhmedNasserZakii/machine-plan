import type { MachineStatus } from './types';

export const MACHINE_STATUSES: MachineStatus[] = [
  'IN_COMPANY_WAREHOUSE',
  'IN_BRANCH_WAREHOUSE',
  'WITH_SUPERVISOR',
  'WITH_REPRESENTATIVE',
  'WITH_MERCHANT',
  'IN_TRANSIT',
  'UNDER_MAINTENANCE',
  'AT_FACTORY',
  'AT_SERVICE_CENTER',
  'DECOMMISSIONED',
  'REPLACED',
];

/** Statuses offered in list filters (retired hidden unless includeRetired). */
export const FILTERABLE_MACHINE_STATUSES: MachineStatus[] = [
  'IN_COMPANY_WAREHOUSE',
  'IN_BRANCH_WAREHOUSE',
  'WITH_SUPERVISOR',
  'WITH_REPRESENTATIVE',
  'WITH_MERCHANT',
  'IN_TRANSIT',
  'UNDER_MAINTENANCE',
  'AT_FACTORY',
  'AT_SERVICE_CENTER',
];

export const HOLDER_TYPES = [
  'FACTORY',
  'WAREHOUSE',
  'SUPERVISOR',
  'REPRESENTATIVE',
  'MERCHANT',
  'SERVICE_CENTER',
] as const;

export const MACHINE_SORTABLE = [
  'createdAt',
  'serial',
  'status',
  'warrantyEnd',
  'totalRepairCost',
] as const;

export const WAREHOUSE_STATUSES: MachineStatus[] = [
  'IN_COMPANY_WAREHOUSE',
  'IN_BRANCH_WAREHOUSE',
];

export function isWarehouseStatus(status: MachineStatus): boolean {
  return WAREHOUSE_STATUSES.includes(status);
}

export function isRetiredStatus(status: MachineStatus): boolean {
  return status === 'DECOMMISSIONED' || status === 'REPLACED';
}
