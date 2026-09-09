import { ApiProperty } from '@nestjs/swagger';

export class MachineReplacedResponse {
  @ApiProperty({ format: 'uuid', description: 'Now REPLACED, and read-only for ever after.' })
  oldMachineId: string;

  @ApiProperty({ format: 'uuid', description: 'Sitting in the company warehouse, awaiting issue.' })
  newMachineId: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'The order this swap concluded, when the machine was away on one.',
  })
  maintenanceOrderId: string | null;
}
