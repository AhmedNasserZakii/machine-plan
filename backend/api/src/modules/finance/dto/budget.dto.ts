import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { MAX_MONEY_AMOUNT } from 'src/common/constants/money';
import { LocalizedQueryDto, toBoolean } from 'src/common/dto/query.dto';
import { BUDGET_PERIOD_TYPES, BudgetPeriodType } from 'src/common/enums/finance.enum';
import { DEFAULT_ALERT_THRESHOLD_PERCENT } from '../budget-rules';

export class CreateBudgetDto {
  @ApiProperty({ format: 'uuid', description: 'Must be an EXPENSE category.' })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Omit for a company-wide budget.' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ enum: BUDGET_PERIOD_TYPES })
  @IsIn(BUDGET_PERIOD_TYPES)
  periodType: BudgetPeriodType;

  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ example: '2026-09-30' })
  @IsDateString()
  periodEnd: string;

  @ApiProperty({ example: 30000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_MONEY_AMOUNT)
  amount: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: DEFAULT_ALERT_THRESHOLD_PERCENT })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  alertThresholdPercent?: number;

  @ApiPropertyOptional({
    default: true,
    description: 'True measures the budget against the rolled-up subtree.',
  })
  @IsOptional()
  @IsBoolean()
  includeSubcategories?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}

/**
 * The category, branch and period are fixed once a budget exists: changing any of them makes the
 * recorded alert level a statement about a different budget, so the new shape is a new row.
 */
export class UpdateBudgetDto {
  @ApiPropertyOptional({ example: 35000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_MONEY_AMOUNT)
  amount?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  alertThresholdPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeSubcategories?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryBudgetsDto extends LocalizedQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Budgets whose period contains this date.' })
  @IsOptional()
  @IsDateString()
  activeOn?: string;

  @ApiPropertyOptional({ default: false, description: 'Include budgets that were switched off.' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeInactive?: boolean;
}

export class BudgetStatusQueryDto extends LocalizedQueryDto {
  @ApiPropertyOptional({
    example: '2026-09-07',
    description: 'The day the pace is measured against. Defaults to today.',
  })
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
