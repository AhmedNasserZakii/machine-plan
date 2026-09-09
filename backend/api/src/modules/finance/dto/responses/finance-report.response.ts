import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BUDGET_STATUSES, BudgetStatus } from '../../budget-rules';

export class FinancePeriodResponse {
  @ApiProperty({ example: '2026-08-01' }) from: string;
  @ApiProperty({ example: '2026-08-31' }) to: string;
}

export class FinanceTotalResponse {
  @ApiProperty({ example: 152300 }) total: number;
  @ApiProperty({ example: 84 }) count: number;
}

export class FinanceComparisonResponse {
  @ApiProperty({ type: FinancePeriodResponse }) period: FinancePeriodResponse;

  @ApiProperty({
    nullable: true,
    description: 'Null when the previous period had nothing to compare against.',
  })
  incomeChangePercent: number | null;

  @ApiProperty({ nullable: true }) expenseChangePercent: number | null;
  @ApiProperty({ nullable: true }) netChangePercent: number | null;
}

export class FinanceByPaymentMethodResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'كاش' }) name: string;
  @ApiProperty() expense: number;
  @ApiProperty() income: number;
}

export class FinanceTopCategoryResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'صيانة' }) name: string;
  @ApiProperty() total: number;
  @ApiProperty() percentOfExpense: number;
}

/** The dashboard number block (`15`). */
export class FinanceSummaryResponse {
  @ApiProperty({ type: FinancePeriodResponse }) period: FinancePeriodResponse;
  @ApiProperty({ type: FinanceTotalResponse }) income: FinanceTotalResponse;
  @ApiProperty({ type: FinanceTotalResponse }) expense: FinanceTotalResponse;
  @ApiProperty({ example: 58850 }) net: number;

  @ApiProperty({
    type: FinanceComparisonResponse,
    nullable: true,
    description: 'Present only with `compareToPrevious=true`.',
  })
  comparison: FinanceComparisonResponse | null;

  @ApiProperty({ type: [FinanceByPaymentMethodResponse] })
  byPaymentMethod: FinanceByPaymentMethodResponse[];

  @ApiProperty({ type: [FinanceTopCategoryResponse] })
  topExpenseCategories: FinanceTopCategoryResponse[];
}

export class CategoryBudgetRefResponse {
  @ApiProperty({ example: 70000 }) amount: number;
  @ApiProperty({ example: 87.4 }) usedPercent: number;
  @ApiProperty({ enum: BUDGET_STATUSES }) status: BudgetStatus;
}

export class FinanceByCategoryNodeResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ nullable: true }) code: string | null;
  @ApiProperty({ example: 'مصاريف تشغيل' }) name: string;
  @ApiProperty() depth: number;

  @ApiProperty({ description: 'Booked on this exact node.' })
  directTotal: number;

  @ApiProperty({ description: 'This node and every descendant.' })
  rolledUpTotal: number;

  @ApiProperty() transactionCount: number;
  @ApiProperty({ description: 'Rolled-up count over the subtree.' }) rolledUpCount: number;
  @ApiProperty() percentOfGrandTotal: number;

  @ApiProperty({ nullable: true, description: 'Null on a root, which has no parent to divide by.' })
  percentOfParent: number | null;

  @ApiProperty({ type: CategoryBudgetRefResponse, nullable: true })
  budget: CategoryBudgetRefResponse | null;

  @ApiPropertyOptional({ type: () => [FinanceByCategoryNodeResponse] })
  children: FinanceByCategoryNodeResponse[];
}

/** "Where did every category's money go" — the exact business ask (`15`). */
export class FinanceByCategoryResponse {
  @ApiProperty({ type: FinancePeriodResponse }) period: FinancePeriodResponse;
  @ApiProperty({ example: 93450 }) grandTotal: number;

  @ApiProperty({ type: [FinanceByCategoryNodeResponse] })
  categories: FinanceByCategoryNodeResponse[];
}
