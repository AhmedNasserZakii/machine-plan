import {
  MaintenanceStatus,
  OPEN_MAINTENANCE_STATUSES,
  WarehouseType,
} from 'src/common/enums/operations.enum';
import { TransferType } from 'src/common/enums/transfer.enum';

/** The three destinations a fault can send a machine to (`11`), keyed by location code. */
export const MaintenanceLocationCode = {
  INTERNAL_WORKSHOP: 'INTERNAL_WORKSHOP',
  FACTORY: 'FACTORY',
  SERVICE_CENTER: 'SERVICE_CENTER',
} as const;

export interface MaintenanceRoute {
  /** The hand-off that takes the machine out of the company warehouse. */
  out: TransferType;
  /** …and the one that brings it home. */
  back: TransferType;
  /**
   * Set when the destination is a real store with a row in `warehouses`. The factory and a
   * service centre are abstract parties — there is nothing to point `toPartyId` at.
   */
  warehouseType?: WarehouseType;
}

/**
 * Which transfers a maintenance order produces. Declared as data for the same reason the custody
 * graph is: the machine's status after `send` is a property of the route, not something the
 * maintenance service should be deciding for itself.
 */
export const MAINTENANCE_ROUTES: Record<string, MaintenanceRoute> = {
  [MaintenanceLocationCode.INTERNAL_WORKSHOP]: {
    out: TransferType.COMPANY_TO_MAINTENANCE,
    back: TransferType.MAINTENANCE_TO_COMPANY,
    warehouseType: WarehouseType.MAINTENANCE,
  },
  [MaintenanceLocationCode.FACTORY]: {
    out: TransferType.COMPANY_TO_FACTORY,
    back: TransferType.FACTORY_TO_COMPANY_RETURN,
  },
  [MaintenanceLocationCode.SERVICE_CENTER]: {
    out: TransferType.COMPANY_TO_SERVICE_CENTER,
    back: TransferType.SERVICE_CENTER_TO_COMPANY,
  },
};

export function routeFor(locationCode: string): MaintenanceRoute | undefined {
  return MAINTENANCE_ROUTES[locationCode];
}

export interface WarrantyWindow {
  warrantyStart: string | null;
  warrantyEnd: string | null;
}

/**
 * The pre-computed suggestion (`11`): was the machine inside its free-maintenance window on the
 * day it was sent away?
 *
 * A missing start date reads as "covered from day one" — some factories issue an end date only —
 * but a missing end date is no cover at all, because an open-ended warranty is not something the
 * company can be held to. Compared on the date rather than the instant: the window is stored as
 * two dates, and a machine sent on the last morning of cover is covered.
 */
export function suggestFreeUnderWarranty(machine: WarrantyWindow, sentAt: Date): boolean {
  if (!machine.warrantyEnd) return false;

  const day = sentAt.toISOString().slice(0, 10);

  return (!machine.warrantyStart || machine.warrantyStart <= day) && day <= machine.warrantyEnd;
}

export function isOpenStatus(status: MaintenanceStatus): boolean {
  return OPEN_MAINTENANCE_STATUSES.includes(status);
}

export interface MaintenanceTotals {
  orders: number;
  totalCost: number;
  freeUnderWarranty: number;
  chargedToCompany: number;
  chargedToRepresentative: number;
  chargedToMerchant: number;
  chargedToFactory: number;
}
