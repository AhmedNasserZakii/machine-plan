import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { WarehouseType } from 'src/common/enums/operations.enum';

export class WarehouseResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: WarehouseType }) type: WarehouseType;
  @ApiProperty() name: string;
  @ApiProperty({ format: 'uuid', nullable: true }) branchId: string | null;
  @ApiProperty() isActive: boolean;
}

export class BranchResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'ALX' }) code: string;
  @ApiProperty({ example: 'فرع الإسكندرية' }) name: string;
  @ApiProperty({ nullable: true }) address: string | null;
  @ApiProperty({ nullable: true }) phone: string | null;
  @ApiProperty() isActive: boolean;

  @ApiPropertyOptional({ type: WarehouseResponse, nullable: true })
  warehouse?: WarehouseResponse | null;
}

class BranchRefResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
}

class BranchMachineSummary {
  @ApiProperty() total: number;
  @ApiProperty({
    description: 'Counts keyed by MachineStatus; statuses with no machines are omitted.',
    example: { IN_BRANCH_WAREHOUSE: 30, WITH_REPRESENTATIVE: 12 },
  })
  byStatus: Partial<Record<MachineStatus, number>>;
}

class BranchStaffSummary {
  @ApiProperty() supervisors: number;
  @ApiProperty() representatives: number;
}

class BranchFinanceSummary {
  @ApiProperty({ example: 42150.0 }) monthExpenses: number;
  @ApiProperty({ example: 91300.0 }) monthIncome: number;
}

export class BranchSummaryResponse {
  @ApiProperty({ type: BranchRefResponse }) branch: BranchRefResponse;
  @ApiProperty({ type: BranchMachineSummary }) machines: BranchMachineSummary;
  @ApiProperty({ type: BranchStaffSummary }) staff: BranchStaffSummary;
  @ApiProperty() openViolations: number;

  @ApiPropertyOptional({
    type: BranchFinanceSummary,
    description: 'Omitted entirely when the caller lacks `finance.read`.',
  })
  finance?: BranchFinanceSummary;
}
