import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { PartyType } from 'src/common/enums/transfer.enum';
import { MachineModel } from 'src/modules/lookups/entities/machine-model.entity';
import { MachineType } from 'src/modules/lookups/entities/machine-type.entity';
import { Machine } from '../entities/machine.entity';
import { toMachineResponse, toWarrantyResponse } from '../mappers/machine.mapper';

const NOW = new Date('2026-06-15T12:00:00.000Z');

function machineType(): MachineType {
  return {
    id: 'type-1',
    code: 'MOBILE_POS',
    requiresSim: true,
    translations: [
      { locale: 'ar', name: 'ماكينة نقاط بيع محمولة' },
      { locale: 'en', name: 'Mobile POS' },
    ],
  } as unknown as MachineType;
}

function machineModel(): MachineModel {
  return {
    id: 'model-1',
    code: 'INGENICO_MOVE_5000',
    manufacturer: 'Ingenico',
    machineTypeId: 'type-1',
    translations: [
      { locale: 'ar', name: 'إنجينيكو موف 5000' },
      { locale: 'en', name: 'Ingenico Move 5000' },
    ],
  } as unknown as MachineModel;
}

function machine(overrides: Partial<Machine> = {}): Machine {
  return {
    id: 'machine-1',
    serial: 'SN-00341',
    simSerial: '8920011234567890123',
    boxSerial: 'BX-00341',
    qrPayload: null,
    status: MachineStatus.WITH_MERCHANT,
    hasBox: true,
    machineTypeId: 'type-1',
    machineModelId: 'model-1',
    machineType: machineType(),
    machineModel: machineModel(),
    battery: { id: 'battery-1', serial: 'BT-91223' },
    currentBranch: null,
    currentBranchId: null,
    currentHolderType: PartyType.MERCHANT,
    currentHolderId: 'merchant-1',
    purchasePrice: '4200.00',
    purchaseDate: '2025-02-10',
    factoryInvoiceNo: 'F-2231',
    warrantyStart: '2025-02-10',
    warrantyEnd: '2026-02-10',
    totalRepairCost: '1850.00',
    repairCount: 3,
    replacedByMachineId: null,
    replacesMachineId: null,
    decommissionedAt: null,
    notes: null,
    ...overrides,
  } as unknown as Machine;
}

describe('machine mapper', () => {
  describe('warranty', () => {
    it('is active with the remaining days when today falls inside the window', () => {
      const warranty = toWarrantyResponse(
        machine({ warrantyStart: '2026-01-01', warrantyEnd: '2026-07-01' }),
        NOW,
      );

      // The 15th itself still counts, so mid-June to the 1st of July is seventeen covered days.
      expect(warranty.isActive).toBe(true);
      expect(warranty.daysRemaining).toBe(17);
    });

    it('reports zero days rather than a negative count once expired', () => {
      const warranty = toWarrantyResponse(machine({ warrantyEnd: '2026-02-10' }), NOW);

      expect(warranty.isActive).toBe(false);
      expect(warranty.daysRemaining).toBe(0);
    });

    it('is not active before the window opens', () => {
      const warranty = toWarrantyResponse(
        machine({ warrantyStart: '2026-08-01', warrantyEnd: '2027-08-01' }),
        NOW,
      );

      expect(warranty.isActive).toBe(false);
      expect(warranty.daysRemaining).toBe(0);
    });

    it('covers the whole of the final day', () => {
      const warranty = toWarrantyResponse(machine({ warrantyEnd: '2026-06-15' }), NOW);

      expect(warranty.isActive).toBe(true);
      expect(warranty.daysRemaining).toBe(1);
    });

    it('is inactive when no end date was ever recorded', () => {
      const warranty = toWarrantyResponse(
        machine({ warrantyStart: '2025-01-01', warrantyEnd: null }),
        NOW,
      );

      expect(warranty.isActive).toBe(false);
      expect(warranty.end).toBeNull();
    });
  });

  describe('detail response', () => {
    it('resolves lookup names for the requested locale', () => {
      const response = toMachineResponse(machine(), 'en', NOW);

      expect(response.type.name).toBe('Mobile POS');
      expect(response.model.name).toBe('Ingenico Move 5000');
      expect(response.type.requiresSim).toBe(true);
    });

    it('falls back to the default locale when the requested one is missing', () => {
      const withoutEnglish = machine({
        machineType: {
          ...machineType(),
          translations: [{ locale: 'ar', name: 'ماكينة نقاط بيع محمولة' }],
        } as unknown as MachineType,
      });

      expect(toMachineResponse(withoutEnglish, 'en', NOW).type.name).toBe('ماكينة نقاط بيع محمولة');
    });

    it('converts the numeric columns pg returns as strings', () => {
      const response = toMachineResponse(machine(), 'ar', NOW);

      expect(response.purchase.price).toBe(4200);
      expect(response.maintenance.totalRepairCost).toBe(1850);
    });

    it('expresses the repair bill as a percentage of the purchase price', () => {
      const response = toMachineResponse(machine(), 'ar', NOW);

      expect(response.maintenance.costVsPricePercent).toBe(44);
    });

    it('withholds the ratio when there is no price to measure against', () => {
      const response = toMachineResponse(machine({ purchasePrice: null }), 'ar', NOW);

      expect(response.maintenance.costVsPricePercent).toBeNull();
      expect(response.purchase.price).toBeNull();
    });

    it('reports the holder as a typed pair and omits it entirely when unheld', () => {
      expect(toMachineResponse(machine(), 'ar', NOW).holder).toEqual({
        type: PartyType.MERCHANT,
        id: 'merchant-1',
      });

      const unheld = machine({ currentHolderType: null, currentHolderId: null });
      expect(toMachineResponse(unheld, 'ar', NOW).holder).toBeNull();
    });
  });
});
