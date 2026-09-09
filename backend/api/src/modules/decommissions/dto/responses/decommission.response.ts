import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DecommissionMachineRefResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'SN-00341' }) serial: string;
  @ApiProperty({ example: 'DECOMMISSIONED' }) status: string;
}

export class DecommissionSnapshotResponse {
  @ApiProperty({ example: 4200, nullable: true }) purchasePrice: number | null;
  @ApiProperty({ example: 3400 }) cumulativeRepairCost: number;
  @ApiProperty({ example: 6 }) repairCount: number;
  @ApiProperty({ example: 0.81, nullable: true }) costToValueRatio: number | null;
  @ApiProperty({ example: 2, description: 'Serials the asset wore before it was scrapped.' })
  chainLength: number;
}

export class DecommissionResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: DecommissionMachineRefResponse }) machine: DecommissionMachineRefResponse;
  @ApiProperty({ example: 'BEYOND_ECONOMIC_REPAIR' }) reasonCode: string;
  @ApiProperty({ example: 'غير قابلة للإصلاح اقتصاديًا' }) reasonName: string;
  @ApiProperty() notes: string;
  @ApiProperty({ example: '2026-09-01T09:00:00.000Z' }) decommissionedAt: string;
  @ApiProperty({ format: 'uuid' }) decommissionedByUserId: string;

  @ApiProperty({
    type: DecommissionSnapshotResponse,
    description: 'Frozen at the decision — later cost corrections do not move these.',
  })
  snapshot: DecommissionSnapshotResponse;

  @ApiProperty({ format: 'uuid', nullable: true }) transferId: string | null;
  @ApiPropertyOptional({ nullable: true }) revertedAt: string | null;
  @ApiPropertyOptional({ nullable: true }) revertReason: string | null;
  @ApiProperty() createdAt: string;
}
