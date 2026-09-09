import { Locale } from 'src/common/constants/locales';
import { pickTranslation } from 'src/common/utils';
import { MachineModel } from 'src/modules/lookups/entities/machine-model.entity';
import { MachineType } from 'src/modules/lookups/entities/machine-type.entity';
import {
  BatteryResponse,
  MachineListItemResponse,
  MachineModelRefResponse,
  MachineResponse,
  MachineTypeRefResponse,
  MachineWarrantyResponse,
} from '../dto/responses/machine.response';
import { Machine } from '../entities/machine.entity';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Numeric columns come back from `pg` as strings so no precision is lost in transit. */
function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

/**
 * Warranty is derived, never stored: a cached "expired" flag would go stale overnight and the
 * whole point of the field is that maintenance decides who pays based on it *today*.
 */
export function toWarrantyResponse(machine: Machine, now = new Date()): MachineWarrantyResponse {
  const end = machine.warrantyEnd ? new Date(`${machine.warrantyEnd}T23:59:59.999Z`) : null;
  const start = machine.warrantyStart ? new Date(`${machine.warrantyStart}T00:00:00.000Z`) : null;

  const started = start === null || start.getTime() <= now.getTime();
  const isActive = end !== null && started && end.getTime() >= now.getTime();

  const daysRemaining =
    end === null || !isActive ? 0 : Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY);

  return {
    start: machine.warrantyStart,
    end: machine.warrantyEnd,
    isActive,
    daysRemaining,
  };
}

function toTypeRef(type: MachineType, locale: Locale): MachineTypeRefResponse {
  return {
    id: type.id,
    name: pickTranslation(type.translations, locale)?.name ?? type.code,
    requiresSim: type.requiresSim,
  };
}

function toModelRef(model: MachineModel, locale: Locale): MachineModelRefResponse {
  return {
    id: model.id,
    name: pickTranslation(model.translations, locale)?.name ?? model.code,
    manufacturer: model.manufacturer,
  };
}

function toBatteryRef(machine: Machine): BatteryResponse | null {
  return machine.battery ? { id: machine.battery.id, serial: machine.battery.serial } : null;
}

export function toMachineListItemResponse(
  machine: Machine,
  locale: Locale,
  now = new Date(),
): MachineListItemResponse {
  return {
    id: machine.id,
    serial: machine.serial,
    simSerial: machine.simSerial,
    boxSerial: machine.boxSerial,
    status: machine.status,
    hasBox: machine.hasBox,
    type: toTypeRef(machine.machineType, locale),
    model: toModelRef(machine.machineModel, locale),
    battery: toBatteryRef(machine),
    branch: machine.currentBranch
      ? { id: machine.currentBranch.id, name: machine.currentBranch.name }
      : null,
    holder: machine.currentHolderType
      ? { type: machine.currentHolderType, id: machine.currentHolderId }
      : null,
    warranty: toWarrantyResponse(machine, now),
  };
}

export function toMachineResponse(
  machine: Machine,
  locale: Locale,
  now = new Date(),
): MachineResponse {
  const purchasePrice = toNumber(machine.purchasePrice);
  const totalRepairCost = Number(machine.totalRepairCost);

  return {
    ...toMachineListItemResponse(machine, locale, now),
    qrPayload: machine.qrPayload,
    purchase: {
      price: purchasePrice,
      date: machine.purchaseDate,
      invoiceNo: machine.factoryInvoiceNo,
    },
    maintenance: {
      repairCount: machine.repairCount,
      totalRepairCost,
      // The ratio is what tells a director to scrap rather than repair again, but it only means
      // something once the machine has a price to be measured against.
      costVsPricePercent:
        purchasePrice && purchasePrice > 0
          ? Math.round((totalRepairCost / purchasePrice) * 1000) / 10
          : null,
    },
    notes: machine.notes,
    decommissionedAt: machine.decommissionedAt?.toISOString() ?? null,
    replacedByMachineId: machine.replacedByMachineId,
    replacesMachineId: machine.replacesMachineId,
  };
}
