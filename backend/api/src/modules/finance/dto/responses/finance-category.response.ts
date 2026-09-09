import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FINANCE_KINDS, FinanceKind } from 'src/common/enums/finance.enum';

export class FinanceCategoryResponse {
  @ApiProperty({ format: 'uuid' }) id: string;

  @ApiProperty({ nullable: true, example: 'MAINTENANCE', description: 'System categories only.' })
  code: string | null;

  @ApiProperty({ example: 'صيانة' }) name: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) parentId: string | null;
  @ApiProperty({ enum: FINANCE_KINDS }) kind: FinanceKind;
  @ApiProperty({ description: 'Roots sit at 0.' }) depth: number;

  @ApiProperty({ description: 'Seeded and protected; its code and existence are not editable.' })
  isSystem: boolean;

  @ApiProperty() isActive: boolean;
  @ApiProperty() sortOrder: number;

  @ApiProperty({ description: 'Transactions booked on this exact node.' })
  transactionCount: number;

  @ApiProperty({ description: 'Total of transactions booked on this exact node.' })
  totalAmount: number;

  @ApiProperty({ description: 'Total of this node and every descendant — the roll-up (`14`).' })
  rolledUpTotal: number;

  @ApiPropertyOptional({ type: () => [FinanceCategoryResponse] })
  children?: FinanceCategoryResponse[];
}

export class FinanceCategoryBreadcrumbResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ nullable: true }) code: string | null;
  @ApiProperty({ example: 'مصاريف تشغيل' }) name: string;
  @ApiProperty() depth: number;
}
