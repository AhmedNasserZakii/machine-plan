import { TransferType } from 'src/common/enums/transfer.enum';
import { WarehouseType } from 'src/common/enums/operations.enum';
import {
  MaintenanceLocationCode,
  routeFor,
  suggestFreeUnderWarranty,
  WarrantyWindow,
} from '../maintenance-rules';

function window(overrides: Partial<WarrantyWindow> = {}): WarrantyWindow {
  return { warrantyStart: '2026-01-01', warrantyEnd: '2026-12-31', ...overrides };
}

describe('suggestFreeUnderWarranty', () => {
  it('suggests free cover for a machine sent inside the window', () => {
    expect(suggestFreeUnderWarranty(window(), new Date('2026-06-15T09:00:00.000Z'))).toBe(true);
  });

  /** The window is stored as two dates, so the last day of cover is a full day of cover. */
  it('includes both boundary days', () => {
    expect(suggestFreeUnderWarranty(window(), new Date('2026-01-01T23:59:00.000Z'))).toBe(true);
    expect(suggestFreeUnderWarranty(window(), new Date('2026-12-31T00:01:00.000Z'))).toBe(true);
  });

  it('does not suggest cover once the window has closed', () => {
    expect(suggestFreeUnderWarranty(window(), new Date('2027-01-01T09:00:00.000Z'))).toBe(false);
  });

  it('does not suggest cover before it opens', () => {
    expect(suggestFreeUnderWarranty(window(), new Date('2025-12-31T09:00:00.000Z'))).toBe(false);
  });

  /** Some factories issue an end date only; that still reads as covered from day one. */
  it('treats a missing start date as covered from the beginning', () => {
    const covered = window({ warrantyStart: null });

    expect(suggestFreeUnderWarranty(covered, new Date('2020-05-05T09:00:00.000Z'))).toBe(true);
  });

  /** An open-ended warranty is not something the company can be held to. */
  it('suggests nothing when there is no end date', () => {
    const open = window({ warrantyEnd: null });

    expect(suggestFreeUnderWarranty(open, new Date('2026-06-15T09:00:00.000Z'))).toBe(false);
  });

  it('suggests nothing for a machine with no warranty at all', () => {
    const none = { warrantyStart: null, warrantyEnd: null };

    expect(suggestFreeUnderWarranty(none, new Date('2026-06-15T09:00:00.000Z'))).toBe(false);
  });
});

describe('routeFor', () => {
  it('sends the internal workshop through the maintenance store', () => {
    const route = routeFor(MaintenanceLocationCode.INTERNAL_WORKSHOP)!;

    expect(route.out).toBe(TransferType.COMPANY_TO_MAINTENANCE);
    expect(route.back).toBe(TransferType.MAINTENANCE_TO_COMPANY);
    expect(route.warehouseType).toBe(WarehouseType.MAINTENANCE);
  });

  /** The factory and a service centre are parties, not stores: there is nothing to point at. */
  it('gives the factory and the service centre no warehouse', () => {
    expect(routeFor(MaintenanceLocationCode.FACTORY)).toEqual({
      out: TransferType.COMPANY_TO_FACTORY,
      back: TransferType.FACTORY_TO_COMPANY_RETURN,
    });
    expect(routeFor(MaintenanceLocationCode.SERVICE_CENTER)).toEqual({
      out: TransferType.COMPANY_TO_SERVICE_CENTER,
      back: TransferType.SERVICE_CENTER_TO_COMPANY,
    });
  });

  it('has no route for a location code the transfer graph has never heard of', () => {
    expect(routeFor('NEIGHBOURS_GARAGE')).toBeUndefined();
  });
});
