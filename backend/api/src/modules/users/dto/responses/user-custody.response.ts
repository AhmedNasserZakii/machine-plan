import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMeta } from 'src/common/dto/paginated-result';
import { MachineStatus } from 'src/common/enums/machine-status.enum';

export class UserCustodySubjectResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() fullName: string;
  @ApiProperty() role: string;
}

export class UserCustodySummaryResponse {
  @ApiProperty() totalMachines: number;
  @ApiProperty() withMerchants: number;
  @ApiProperty() inHand: number;
  @ApiProperty() openViolations: number;
}

export class UserCustodyMerchantResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() shopName: string;
}

export class UserCustodyMachineResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() serial: string;
  @ApiProperty() model: string;
  @ApiProperty({ enum: MachineStatus }) status: MachineStatus;
  @ApiPropertyOptional({ type: UserCustodyMerchantResponse, nullable: true })
  merchant: UserCustodyMerchantResponse | null;
  @ApiProperty({ format: 'date-time' }) heldSince: string;
}

export class UserCustodyResponse {
  @ApiProperty({ type: UserCustodySubjectResponse }) user: UserCustodySubjectResponse;
  @ApiProperty({ type: UserCustodySummaryResponse }) summary: UserCustodySummaryResponse;
  @ApiProperty({ type: [UserCustodyMachineResponse] }) machines: UserCustodyMachineResponse[];
  @ApiProperty({ type: PaginationMeta }) machinesMeta: PaginationMeta;
}
