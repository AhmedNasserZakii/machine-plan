import { Locale } from 'src/common/constants/locales';
import { pickTranslation } from 'src/common/utils';
import { DecommissionResponse } from '../dto/responses/decommission.response';
import { Decommission } from '../entities/decommission.entity';

export function toDecommissionResponse(row: Decommission, locale: Locale): DecommissionResponse {
  const purchasePrice =
    row.purchasePriceAtDecision === null ? null : Number(row.purchasePriceAtDecision);
  const repairCost = Number(row.cumulativeRepairCostAtDecision);

  return {
    id: row.id,
    machine: {
      id: row.machineId,
      serial: row.machine?.serial ?? '',
      status: row.machine?.status ?? '',
    },
    reasonCode: row.reason?.code ?? '',
    reasonName: row.reason
      ? (pickTranslation(row.reason.translations, locale)?.name ?? row.reason.code)
      : '',
    notes: row.notes,
    decommissionedAt: row.decommissionedAt.toISOString(),
    decommissionedByUserId: row.decommissionedByUserId,
    snapshot: {
      purchasePrice,
      cumulativeRepairCost: repairCost,
      repairCount: row.repairCountAtDecision,
      costToValueRatio:
        purchasePrice && purchasePrice > 0
          ? Math.round((repairCost / purchasePrice) * 100) / 100
          : null,
      chainLength: row.chainLengthAtDecision,
    },
    transferId: row.transferId,
    revertedAt: row.revertedAt?.toISOString() ?? null,
    revertReason: row.revertReason,
    createdAt: row.createdAt.toISOString(),
  };
}
