import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { RecommendationValue } from '../../machine-economics';

export class ChainLinkResponse {
  @ApiProperty({ example: 1, description: 'Oldest serial first.' }) position: number;
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'SN-00341' }) serial: string;
  @ApiProperty({ enum: MachineStatus }) status: MachineStatus;
  @ApiProperty({ description: 'When this serial became the live unit.' }) activeFrom: string;
  @ApiProperty({ nullable: true, description: 'Null for the unit still in service.' })
  activeTo: string | null;

  @ApiProperty() repairCount: number;
  @ApiProperty() repairCost: number;
  @ApiProperty({ nullable: true }) replacedReason: string | null;
  @ApiProperty() isCurrent: boolean;
}

export class ChainTotalsResponse {
  @ApiProperty({ nullable: true }) purchasePrice: number | null;
  @ApiProperty() cumulativeRepairCost: number;
  @ApiProperty() cumulativeRepairCount: number;
  @ApiProperty({ nullable: true }) costToValueRatio: number | null;
  @ApiProperty() ageMonths: number;
}

export class ReplacementChainResponse {
  @ApiProperty({ format: 'uuid' }) requestedMachineId: string;
  @ApiProperty({ example: 3 }) chainLength: number;
  @ApiProperty({ type: [ChainLinkResponse] }) chain: ChainLinkResponse[];
  @ApiProperty({ type: ChainTotalsResponse }) chainTotals: ChainTotalsResponse;
}

/**
 * Answers "is this machine still worth keeping?" (`07`). Chain-aware: once a unit has been
 * swapped, the numbers are the whole asset's, not the current serial's (`12`, rule 4).
 */
export class MachineCostSummaryResponse {
  @ApiProperty({ nullable: true }) purchasePrice: number | null;
  @ApiProperty() totalRepairCost: number;
  @ApiProperty() repairCount: number;
  @ApiProperty({ nullable: true }) costToValueRatio: number | null;
  @ApiProperty() chargedToCompany: number;
  @ApiProperty() chargedToRepresentatives: number;
  @ApiProperty() chargedToMerchants: number;
  @ApiProperty({ description: 'What the warranty absorbed.' }) freeUnderWarranty: number;
  @ApiProperty() ageMonths: number;
  @ApiProperty({ description: 'True once the machine is part of a replacement chain.' })
  isInChain: boolean;

  @ApiProperty({ example: 3 }) chainLength: number;
  @ApiProperty({ enum: ['KEEP', 'REVIEW', 'CONSIDER_DECOMMISSION'] })
  recommendation: RecommendationValue;
}

export const TIMELINE_EVENT_TYPES = [
  'TRANSFER_PENDING',
  'TRANSFER_CONFIRMED',
  'TRANSFER_REJECTED',
  'TRANSFER_CANCELLED',
  'MAINTENANCE_OPENED',
  'MAINTENANCE_CLOSED',
  'VIOLATION_CREATED',
  'MACHINE_REPLACED',
  'DECOMMISSIONED',
  'DECOMMISSION_REVERTED',
] as const;

export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

/**
 * One line of the machine's life story. The app renders the sentence from `type`, the same way it
 * does for the merchant timeline — a title assembled in SQL could not be localized.
 */
export class MachineTimelineEventResponse {
  @ApiProperty() at: string;
  @ApiProperty({ enum: TIMELINE_EVENT_TYPES }) type: TimelineEventType;
  @ApiProperty({ format: 'uuid', description: 'The row this event came from.' }) refId: string;
  @ApiProperty({ nullable: true, example: 'TRF-2026-000141' }) refNo: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true }) details: Record<string, unknown>;
}

export class DecommissionCandidateResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() serial: string;
  @ApiProperty({ enum: MachineStatus }) status: MachineStatus;
  @ApiProperty({ nullable: true }) model: string | null;
  @ApiProperty({ nullable: true }) purchasePrice: number | null;
  @ApiProperty({ description: 'Chain total when the machine is part of a chain.' })
  cumulativeRepairCost: number;

  @ApiProperty({ nullable: true }) costRatio: number | null;
  @ApiProperty() repairCount: number;
  @ApiProperty() ageMonths: number;
  @ApiProperty() isInChain: boolean;
  @ApiProperty() chainLength: number;
  @ApiProperty({ enum: ['KEEP', 'REVIEW', 'CONSIDER_DECOMMISSION'] })
  recommendation: RecommendationValue;

  @ApiPropertyOptional({ nullable: true }) lastMaintenanceAt: string | null;
}
