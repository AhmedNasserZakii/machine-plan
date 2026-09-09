import { ApiProperty } from '@nestjs/swagger';
import { MachineStatus } from 'src/common/enums/machine-status.enum';

export class ReplacementMachineRefResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'SN-00341' }) serial: string;
  @ApiProperty({ enum: MachineStatus }) status: MachineStatus;
}

export class ReplacementResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: ReplacementMachineRefResponse }) oldMachine: ReplacementMachineRefResponse;
  @ApiProperty({ type: ReplacementMachineRefResponse }) newMachine: ReplacementMachineRefResponse;
  @ApiProperty({ format: 'uuid', nullable: true }) maintenanceOrderId: string | null;
  @ApiProperty({ example: 'لوحة رئيسية تالفة' }) reason: string;
  @ApiProperty() replacedAt: string;
  @ApiProperty() createdAt: string;
}
