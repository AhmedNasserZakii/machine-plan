import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMeta } from 'src/common/dto/paginated-result';
import {
  MAINTENANCE_RESULTS,
  MAINTENANCE_STATUSES,
  MaintenanceResult,
  MaintenanceStatus,
  RESPONSIBLE_PARTIES,
  ResponsibleParty,
} from 'src/common/enums/operations.enum';

export class MaintenanceMachineResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'SN-00311' }) serial: string;
  @ApiProperty({ example: 'IN_MAINTENANCE' }) status: string;
  @ApiPropertyOptional({ nullable: true }) model: string | null;
}

export class MaintenanceLocationRefResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'INTERNAL_WORKSHOP' }) code: string;
  @ApiProperty({ example: 'الورشة الداخلية' }) name: string;
}

export class MaintenanceOrderListItemResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'MNT-2026-000087' }) referenceNo: string;
  @ApiProperty({ type: MaintenanceMachineResponse }) machine: MaintenanceMachineResponse;
  @ApiProperty({ type: MaintenanceLocationRefResponse }) location: MaintenanceLocationRefResponse;
  @ApiProperty({ enum: MAINTENANCE_STATUSES }) status: MaintenanceStatus;
  @ApiProperty({ enum: MAINTENANCE_RESULTS, nullable: true }) result: MaintenanceResult | null;
  @ApiProperty({ example: '2026-02-14T08:30:00.000Z' }) sentAt: string;
  @ApiProperty({ nullable: true }) returnedAt: string | null;
  @ApiProperty({ example: 350, nullable: true }) cost: number | null;
  @ApiProperty() isFreeUnderWarranty: boolean;
  @ApiProperty({ enum: RESPONSIBLE_PARTIES, nullable: true })
  responsibleParty: ResponsibleParty | null;
  @ApiProperty({ nullable: true }) branch: { id: string; name: string } | null;
  @ApiProperty() createdAt: string;
}

export class MaintenanceOrderResponse extends MaintenanceOrderListItemResponse {
  @ApiProperty({ example: 'الشاشة لا تعمل' }) reportedFault: string;

  @ApiProperty({ description: 'What the warranty dates implied on the day it was sent.' })
  suggestedFreeUnderWarranty: boolean;

  @ApiProperty({ format: 'uuid', nullable: true }) responsibleUserId: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) responsibleMerchantId: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) paymentMethodId: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) supplierId: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) invoiceMediaId: string | null;
  @ApiProperty({ nullable: true }) performedByName: string | null;

  @ApiProperty({ format: 'uuid', nullable: true, description: 'The out and back hand-offs.' })
  outTransferId: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) inTransferId: string | null;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'The expense the close posted, when somebody paid.',
  })
  financeTransactionId: string | null;

  @ApiProperty({ format: 'uuid', nullable: true }) violationId: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) subscriptionId: string | null;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'The unit that came back in its place, when the result was REPLACED.',
  })
  replacementMachineId: string | null;

  @ApiProperty({ nullable: true }) closedAt: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) closedByUserId: string | null;
  @ApiProperty({ nullable: true }) cancelledAt: string | null;
  @ApiProperty({ nullable: true }) cancelReason: string | null;
  @ApiProperty({ nullable: true }) notes: string | null;
}

export class MaintenanceTotalsResponse {
  @ApiProperty({ example: 4 }) orders: number;
  @ApiProperty({ example: 1250.5 }) totalCost: number;
  @ApiProperty({ example: 1 }) freeUnderWarranty: number;
  @ApiProperty({ example: 2 }) chargedToCompany: number;
  @ApiProperty({ example: 1 }) chargedToRepresentative: number;
  @ApiProperty({ example: 0 }) chargedToMerchant: number;
  @ApiProperty({ example: 0 }) chargedToFactory: number;
}

export class MaintenanceHistoryResponse {
  @ApiProperty({ format: 'uuid' }) machineId: string;
  @ApiProperty({ example: 'SN-00311' }) serial: string;
  @ApiProperty({ type: MaintenanceTotalsResponse }) totals: MaintenanceTotalsResponse;
  @ApiProperty({ type: [MaintenanceOrderListItemResponse] })
  orders: MaintenanceOrderListItemResponse[];

  @ApiProperty({ type: PaginationMeta })
  ordersMeta: PaginationMeta;
}
