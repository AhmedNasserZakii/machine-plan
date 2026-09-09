import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MachineStatus, MACHINE_STATUSES } from 'src/common/enums/machine-status.enum';
import {
  ItemCondition,
  ITEM_CONDITIONS,
  PartyType,
  PARTY_TYPES,
  SignatureMethod,
  SignaturePartyRole,
  TransferDirection,
  TransferStatus,
  TRANSFER_STATUSES,
  TransferType,
  TRANSFER_TYPES,
} from 'src/common/enums/transfer.enum';

export class TransferPartyResponse {
  @ApiProperty({ enum: PARTY_TYPES }) type: PartyType;
  @ApiPropertyOptional({ nullable: true }) id: string | null;
  /** Resolved for users and warehouses; null for the factory and the scrapyard. */
  @ApiPropertyOptional({ nullable: true }) name: string | null;
}

export class TransferBranchResponse {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

export class TransferItemMachineResponse {
  @ApiProperty() id: string;
  @ApiProperty() serial: string;
  @ApiPropertyOptional({ nullable: true }) model: string | null;
}

export class TransferItemPhotoResponse {
  @ApiProperty() id: string;
  @ApiProperty() mediaId: string;
}

export class TransferItemResponse {
  @ApiProperty() id: string;
  @ApiProperty({ type: TransferItemMachineResponse }) machine: TransferItemMachineResponse;

  @ApiPropertyOptional({ nullable: true }) batterySerialScanned: string | null;
  /** `null` means nobody scanned it — not that it failed. */
  @ApiPropertyOptional({ nullable: true }) batteryMatches: boolean | null;
  @ApiPropertyOptional({ nullable: true }) simSerialScanned: string | null;
  @ApiPropertyOptional({ nullable: true }) simMatches: boolean | null;
  @ApiPropertyOptional({ nullable: true }) boxSerialScanned: string | null;
  @ApiPropertyOptional({ nullable: true }) boxMatches: boolean | null;

  @ApiProperty() hasCharger: boolean;
  @ApiProperty() hasBox: boolean;
  @ApiProperty({ enum: ITEM_CONDITIONS }) condition: ItemCondition;
  @ApiPropertyOptional({ nullable: true }) notes: string | null;
  @ApiProperty({ type: [TransferItemPhotoResponse] }) photos: TransferItemPhotoResponse[];
}

export class TransferSignatureResponse {
  @ApiProperty({ enum: ['SENDER', 'RECEIVER'] }) partyRole: SignaturePartyRole;
  @ApiProperty() userId: string;
  @ApiPropertyOptional({ nullable: true }) userFullName: string | null;
  @ApiProperty({ enum: ['DRAWN_SIGNATURE', 'BIOMETRIC'] }) method: SignatureMethod;
  @ApiPropertyOptional({ nullable: true }) signatureMediaId: string | null;
  @ApiProperty() signedAt: string;
  @ApiPropertyOptional({ nullable: true }) deviceModel: string | null;
  @ApiProperty() payloadHash: string;
}

export class TransferListItemResponse {
  @ApiProperty() id: string;
  @ApiProperty() referenceNo: string;
  @ApiProperty({ enum: TRANSFER_TYPES }) type: TransferType;
  @ApiProperty({ enum: ['OUT', 'RETURN'] }) direction: TransferDirection;
  @ApiProperty({ enum: TRANSFER_STATUSES }) status: TransferStatus;
  @ApiProperty({ type: TransferPartyResponse }) from: TransferPartyResponse;
  @ApiProperty({ type: TransferPartyResponse }) to: TransferPartyResponse;
  @ApiPropertyOptional({ type: TransferBranchResponse, nullable: true })
  branch: TransferBranchResponse | null;
  @ApiProperty() occurredAt: string;
  @ApiPropertyOptional({ nullable: true }) confirmedAt: string | null;
  @ApiProperty() itemsCount: number;
  @ApiProperty() createdAt: string;
}

export class TransferResponse extends TransferListItemResponse {
  @ApiProperty({ type: [TransferItemResponse] }) items: TransferItemResponse[];
  @ApiProperty({ type: [TransferSignatureResponse] }) signatures: TransferSignatureResponse[];
  @ApiProperty({ description: 'Mismatches recorded on items; the violation module acts on these' })
  violationsCount: number;
  @ApiPropertyOptional({ nullable: true }) rejectionReason: string | null;
  @ApiPropertyOptional({ nullable: true }) notes: string | null;
  /** Echo this back on confirm; a mismatch means the document changed after you read it. */
  @ApiProperty() payloadHash: string;
}

export class CreatableTransferTypeResponse {
  @ApiProperty({ enum: TRANSFER_TYPES }) type: TransferType;

  @ApiProperty({
    enum: ['USER', 'WAREHOUSE', 'MERCHANT', 'NONE'],
    description: 'What the client must make the user pick as the receiver, if anything',
  })
  receiverKind: string;

  @ApiProperty({ description: 'Confirms on create; the sender signs for himself' })
  selfAttested: boolean;

  @ApiProperty({ enum: MACHINE_STATUSES, isArray: true })
  allowedFromStatuses: MachineStatus[];
}

export class TransferRecipientResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'محمود عبد الله' }) name: string;

  @ApiProperty({ nullable: true, description: 'Branch name, or null for a warehouse' })
  subtitle: string | null;
}

export class TransferValidationResponse {
  @ApiProperty() valid: boolean;
  @ApiProperty({ type: [Object] }) problems: unknown[];
}
