import { Locale } from 'src/common/constants/locales';
import { pickTranslation } from 'src/common/utils';
import {
  MaintenanceOrderListItemResponse,
  MaintenanceOrderResponse,
} from '../dto/responses/maintenance.response';
import { MaintenanceOrder } from '../entities/maintenance-order.entity';

export function toMaintenanceListItemResponse(
  order: MaintenanceOrder,
  locale: Locale,
): MaintenanceOrderListItemResponse {
  return {
    id: order.id,
    referenceNo: order.referenceNo,
    machine: {
      id: order.machineId,
      serial: order.machine?.serial ?? '',
      status: order.machine?.status ?? '',
      model: order.machine?.machineModel
        ? (pickTranslation(order.machine.machineModel.translations, locale)?.name ??
          order.machine.machineModel.code)
        : null,
    },
    location: {
      id: order.maintenanceLocationId,
      code: order.maintenanceLocation?.code ?? '',
      name: order.maintenanceLocation
        ? (pickTranslation(order.maintenanceLocation.translations, locale)?.name ??
          order.maintenanceLocation.code)
        : '',
    },
    status: order.status,
    result: order.result,
    sentAt: order.sentAt.toISOString(),
    returnedAt: order.returnedAt?.toISOString() ?? null,
    cost: order.cost === null ? null : Number(order.cost),
    isFreeUnderWarranty: order.isFreeUnderWarranty,
    responsibleParty: order.responsibleParty,
    branch: order.branch ? { id: order.branch.id, name: order.branch.name } : null,
    createdAt: order.createdAt.toISOString(),
  };
}

export function toMaintenanceOrderResponse(
  order: MaintenanceOrder,
  locale: Locale,
  replacementMachineId: string | null = null,
): MaintenanceOrderResponse {
  return {
    ...toMaintenanceListItemResponse(order, locale),
    reportedFault: order.reportedFault,
    suggestedFreeUnderWarranty: order.suggestedFreeUnderWarranty,
    responsibleUserId: order.responsibleUserId,
    responsibleMerchantId: order.responsibleMerchantId,
    paymentMethodId: order.paymentMethodId,
    supplierId: order.supplierId,
    invoiceMediaId: order.invoiceMediaId,
    performedByName: order.performedByName,
    outTransferId: order.outTransferId,
    inTransferId: order.inTransferId,
    financeTransactionId: order.financeTransactionId,
    violationId: order.violationId,
    subscriptionId: order.subscriptionId,
    replacementMachineId,
    closedAt: order.closedAt?.toISOString() ?? null,
    closedByUserId: order.closedByUserId,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancelReason: order.cancelReason,
    notes: order.notes,
  };
}
