import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorDetail } from 'src/common/errors';
import { FinanceKind } from 'src/common/enums/finance.enum';
import {
  SYNC_OPERATION_TYPES,
  SyncOperationStatus,
  SyncOperationType,
  SyncResolution,
} from 'src/common/enums/sync.enum';
import {
  LookupResponse,
  MachineModelResponse,
  MachineTypeResponse,
  ViolationTypeResponse,
} from 'src/modules/lookups/dto/responses/lookup.response';
import { MachineListItemResponse } from 'src/modules/machines/dto/responses/machine.response';
import { MerchantListItemResponse } from 'src/modules/merchants/dto/responses/merchant.response';
import { BranchResponse } from 'src/modules/organization/dto/responses/branch.response';
import { TransferResponse } from 'src/modules/transfers/dto/responses/transfer.response';

/**
 * Categories as an offline client needs them: enough to render the picker and to book a
 * transaction against one. The counts and totals `GET /finance-categories` carries are a
 * reporting concern and would be stale on the device the moment anyone else posted a row.
 */
export class SyncFinanceCategoryResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'FUEL', nullable: true }) code: string | null;
  @ApiProperty() name: string;
  @ApiProperty({ enum: FinanceKind }) kind: FinanceKind;
  @ApiProperty({ format: 'uuid', nullable: true }) parentId: string | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty() sortOrder: number;
}

export class SyncLookupsResponse {
  @ApiProperty({ type: [MachineTypeResponse] }) machineTypes: MachineTypeResponse[];
  @ApiProperty({ type: [MachineModelResponse] }) machineModels: MachineModelResponse[];
  @ApiProperty({ type: [LookupResponse] }) paymentMethods: LookupResponse[];
  @ApiProperty({ type: [ViolationTypeResponse] }) violationTypes: ViolationTypeResponse[];
  @ApiProperty({ type: [LookupResponse] }) maintenanceLocations: LookupResponse[];
  @ApiProperty({ type: [LookupResponse] }) decommissionReasons: LookupResponse[];
  @ApiProperty({ type: [SyncFinanceCategoryResponse] })
  financeCategories: SyncFinanceCategoryResponse[];
  @ApiProperty({ type: [BranchResponse] }) branches: BranchResponse[];
}

export class SyncBootstrapResponse {
  @ApiProperty({ description: "The server's clock. The client stores it and sends it back." })
  serverTime: string;

  @ApiProperty({ description: 'Bumped when a synced table changes shape; forces a re-bootstrap.' })
  schemaVersion: number;

  @ApiProperty({ type: SyncLookupsResponse }) lookups: SyncLookupsResponse;

  @ApiProperty({ type: [MachineListItemResponse], description: "In the caller's own custody." })
  myMachines: MachineListItemResponse[];

  @ApiProperty({ type: [MerchantListItemResponse] }) myMerchants: MerchantListItemResponse[];

  @ApiProperty({
    type: [TransferResponse],
    description:
      'Awaiting the caller’s signature, with items and photos so it can be signed offline.',
  })
  pendingTransfers: TransferResponse[];

  @ApiProperty({ example: ['transfers.create', 'merchants.read'] }) permissions: string[];
}

/** Ids the client must drop from its local database, per collection. */
export class SyncDeletedResponse {
  @ApiProperty({ type: [String], format: 'uuid' }) machines: string[];
  @ApiProperty({ type: [String], format: 'uuid' }) merchants: string[];
  @ApiProperty({ type: [String], format: 'uuid' }) transfers: string[];
}

export class SyncDeltaResponse extends SyncBootstrapResponse {
  @ApiProperty({ type: SyncDeletedResponse }) deleted: SyncDeletedResponse;

  @ApiProperty({ description: 'The cursor for the next call. Always the server’s timestamp.' })
  nextSince: string;
}

export class SyncStatusResponse {
  @ApiProperty() serverTime: string;
  @ApiProperty() schemaVersion: number;
}

export class SyncOperationErrorResponse {
  @ApiProperty({ example: 'MACHINE_ALREADY_IN_TRANSIT' }) code: string;
  @ApiProperty() message: string;
  @ApiPropertyOptional() details?: ErrorDetail[];
}

export class SyncOperationResultResponse {
  @ApiProperty({ format: 'uuid' }) clientUuid: string;
  @ApiProperty({ enum: SYNC_OPERATION_TYPES }) type: SyncOperationType;
  @ApiProperty({ enum: SyncOperationStatus }) status: SyncOperationStatus;

  @ApiProperty({ format: 'uuid', nullable: true, description: 'The row this operation became.' })
  serverId: string | null;

  @ApiPropertyOptional({ type: SyncOperationErrorResponse })
  error?: SyncOperationErrorResponse;

  @ApiPropertyOptional({ enum: SyncResolution, description: 'What to do with the queued item.' })
  resolution?: SyncResolution;

  @ApiPropertyOptional({
    description:
      'What the server holds instead, on a conflict — the current status of the transfer, or ' +
      'where the machines actually are now.',
    type: 'object',
    additionalProperties: true,
  })
  serverState?: Record<string, unknown>;
}

export class SyncBatchResponse {
  @ApiProperty({ type: [SyncOperationResultResponse] }) results: SyncOperationResultResponse[];
  @ApiProperty() serverTime: string;
}
