import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { PartyType } from 'src/common/enums/transfer.enum';

export class MachineTypeRefResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'ماكينة نقاط بيع' }) name: string;

  /** Drives whether the intake form asks for a SIM at all. */
  @ApiProperty() requiresSim: boolean;
}

export class MachineModelRefResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) manufacturer: string | null;
}

export class BatteryResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'BT-91223' }) serial: string;
}

export class BranchRefResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
}

export class MachineHolderResponse {
  @ApiProperty({ enum: PartyType }) type: PartyType;
  @ApiProperty({ format: 'uuid', nullable: true }) id: string | null;
}

export class MachineWarrantyResponse {
  @ApiProperty({ nullable: true }) start: string | null;
  @ApiProperty({ nullable: true }) end: string | null;

  /** Computed against today, so a client with a wrong clock still sees the truth. */
  @ApiProperty() isActive: boolean;
  @ApiProperty({ description: 'Zero once expired; never negative.' }) daysRemaining: number;
}

export class MachinePurchaseResponse {
  @ApiProperty({ nullable: true }) price: number | null;
  @ApiProperty({ nullable: true }) date: string | null;
  @ApiProperty({ nullable: true }) invoiceNo: string | null;
}

export class MachineMaintenanceResponse {
  @ApiProperty() repairCount: number;
  @ApiProperty() totalRepairCost: number;

  /** Null until a purchase price is known — a ratio against nothing is meaningless. */
  @ApiProperty({ nullable: true }) costVsPricePercent: number | null;
}

/** The row shape for `GET /machines`. */
export class MachineListItemResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'SN-00341' }) serial: string;
  @ApiProperty({ nullable: true }) simSerial: string | null;
  @ApiProperty({ nullable: true }) boxSerial: string | null;
  @ApiProperty({ enum: MachineStatus }) status: MachineStatus;
  @ApiProperty() hasBox: boolean;
  @ApiProperty({ type: MachineTypeRefResponse }) type: MachineTypeRefResponse;
  @ApiProperty({ type: MachineModelRefResponse }) model: MachineModelRefResponse;
  @ApiProperty({ type: BatteryResponse, nullable: true }) battery: BatteryResponse | null;
  @ApiProperty({ type: BranchRefResponse, nullable: true }) branch: BranchRefResponse | null;
  @ApiProperty({ type: MachineHolderResponse, nullable: true })
  holder: MachineHolderResponse | null;
  @ApiProperty({ type: MachineWarrantyResponse }) warranty: MachineWarrantyResponse;
}

export class MachineResponse extends MachineListItemResponse {
  @ApiProperty({ nullable: true }) qrPayload: string | null;
  @ApiProperty({ type: MachinePurchaseResponse }) purchase: MachinePurchaseResponse;
  @ApiProperty({ type: MachineMaintenanceResponse }) maintenance: MachineMaintenanceResponse;
  @ApiProperty({ nullable: true }) notes: string | null;
  @ApiProperty({ nullable: true }) decommissionedAt: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  replacedByMachineId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  replacesMachineId: string | null;
}

export const MATCHED_ON = ['MACHINE', 'BATTERY', 'SIM', 'BOX'] as const;
export type MatchedOn = (typeof MATCHED_ON)[number];

/**
 * A scan resolves to one machine plus *which* serial matched, so the app can tell the user it
 * scanned the battery rather than the machine — the two stickers sit next to each other.
 */
export class MachineLookupResponse {
  @ApiProperty({ enum: MATCHED_ON }) matchedOn: MatchedOn;
  @ApiProperty({ type: MachineResponse }) machine: MachineResponse;
}

export class BulkCreateMachinesResponse {
  @ApiProperty({ description: 'How many rows were committed.' }) created: number;
  @ApiProperty({ type: [MachineResponse] }) machines: MachineResponse[];
}
