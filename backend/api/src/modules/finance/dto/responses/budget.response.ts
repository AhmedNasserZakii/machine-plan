import { ApiProperty } from '@nestjs/swagger';
import { BUDGET_PERIOD_TYPES, BudgetPeriodType } from 'src/common/enums/finance.enum';
import { BUDGET_STATUSES, BudgetStatus } from '../../budget-rules';
import { FinanceNamedRefResponse } from './finance-transaction.response';

export class BudgetCategoryRefResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'صيانة' }) name: string;

  @ApiProperty({ example: 'مصاريف تشغيل / صيانة' })
  path: string;
}

export class BudgetResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: BudgetCategoryRefResponse }) category: BudgetCategoryRefResponse;

  @ApiProperty({ type: FinanceNamedRefResponse, nullable: true, description: 'Null = company.' })
  branch: FinanceNamedRefResponse | null;

  @ApiProperty({ enum: BUDGET_PERIOD_TYPES }) periodType: BudgetPeriodType;
  @ApiProperty({ example: '2026-09-01' }) periodStart: string;
  @ApiProperty({ example: '2026-09-30' }) periodEnd: string;
  @ApiProperty({ example: 30000 }) amount: number;
  @ApiProperty({ example: 80 }) alertThresholdPercent: number;
  @ApiProperty() includeSubcategories: boolean;
  @ApiProperty() autoRenew: boolean;
  @ApiProperty() isActive: boolean;

  @ApiProperty({
    enum: BUDGET_STATUSES,
    nullable: true,
    description: 'The highest level already announced for this period; null if none has been.',
  })
  lastAlertLevel: string | null;

  @ApiProperty({ nullable: true }) lastAlertAt: string | null;
  @ApiProperty() createdAt: string;
}

export class BudgetPeriodProgressResponse {
  @ApiProperty({ enum: BUDGET_PERIOD_TYPES }) type: BudgetPeriodType;
  @ApiProperty({ example: '2026-09-01' }) start: string;
  @ApiProperty({ example: '2026-09-30' }) end: string;
  @ApiProperty({ example: 7 }) daysElapsed: number;
  @ApiProperty({ example: 30 }) daysTotal: number;
  @ApiProperty({ example: 23.3 }) elapsedPercent: number;
}

export class BudgetPaceResponse {
  @ApiProperty({ example: 6990 }) expectedSpendByNow: number;

  @ApiProperty({ example: 20410, description: 'Negative means under pace.' })
  overPaceBy: number;

  @ApiProperty({ example: 117428 }) projectedTotal: number;
}

/**
 * One line of `GET /finance/budgets/status`. The `pace` block is what makes it actionable:
 * "91% used on day 7 of 30" is a much louder signal than "91% used" (`16`).
 */
export class BudgetStatusResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: BudgetCategoryRefResponse }) category: BudgetCategoryRefResponse;

  @ApiProperty({ type: FinanceNamedRefResponse, nullable: true })
  branch: FinanceNamedRefResponse | null;

  @ApiProperty({ type: BudgetPeriodProgressResponse }) period: BudgetPeriodProgressResponse;
  @ApiProperty({ example: 30000 }) amount: number;
  @ApiProperty({ example: 27400 }) spent: number;
  @ApiProperty({ example: 2600 }) remaining: number;
  @ApiProperty({ example: 91.3 }) usedPercent: number;
  @ApiProperty({ enum: BUDGET_STATUSES }) status: BudgetStatus;
  @ApiProperty({ type: BudgetPaceResponse }) pace: BudgetPaceResponse;
  @ApiProperty({ nullable: true }) lastAlertLevel: string | null;
}

export class BudgetStatusSummaryResponse {
  @ApiProperty() total: number;
  @ApiProperty() ok: number;
  @ApiProperty() warning: number;
  @ApiProperty() exceeded: number;
}

export class BudgetStatusListResponse {
  @ApiProperty({ example: '2026-09-07' }) asOf: string;
  @ApiProperty({ type: [BudgetStatusResponse] }) budgets: BudgetStatusResponse[];
  @ApiProperty({ type: BudgetStatusSummaryResponse }) summary: BudgetStatusSummaryResponse;
}
