import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_MONEY_AMOUNT } from 'src/common/constants/money';
import { LocalizedQueryDto, toBoolean } from 'src/common/dto/query.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import {
  FINANCE_KINDS,
  FinanceKind,
  TRANSACTION_SOURCES,
  TransactionSource,
} from 'src/common/enums/finance.enum';

/** Coerces `?source=MANUAL` and `?source[]=MANUAL&source[]=AUTO_VIOLATION` to the same array. */
const toArray = ({ value }: { value: unknown }): unknown =>
  value === undefined ? undefined : Array.isArray(value) ? value : [value];

export class CreateFinanceTransactionDto {
  @ApiProperty({ enum: FINANCE_KINDS })
  @IsIn(FINANCE_KINDS)
  kind: FinanceKind;

  @ApiProperty({ example: 1250.5, description: 'EGP. There is no currency column by design.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_MONEY_AMOUNT)
  amount: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: '2026-09-01', description: 'A calendar date, never a timestamp.' })
  @IsDateString()
  transactionDate: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  paymentMethodId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Omit for company-level spend.' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  invoiceMediaId?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Offline idempotency: a replayed submit returns the row it already created.',
  })
  @IsOptional()
  @IsUUID()
  clientUuid?: string;
}

/**
 * `kind` and `source` are absent: re-typing a booked row would flip its sign in every historical
 * report, and `source` is what says who owns the row rather than something a client asserts.
 */
export class UpdateFinanceTransactionDto {
  @ApiPropertyOptional({ example: 1250.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_MONEY_AMOUNT)
  amount?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  supplierId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  invoiceMediaId?: string | null;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class VoidFinanceTransactionDto {
  @ApiProperty({ minLength: 5, maxLength: 500 })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}

export const FINANCE_TRANSACTION_SORT_FIELDS = ['transactionDate', 'amount', 'createdAt'] as const;

export type FinanceTransactionSortField = (typeof FINANCE_TRANSACTION_SORT_FIELDS)[number];

export class QueryFinanceTransactionsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: FINANCE_KINDS, description: 'Omit for both.' })
  @IsOptional()
  @IsIn(FINANCE_KINDS)
  kind?: FinanceKind;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Rolls the whole subtree up into `categoryId`, which is what people expect.',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeSubcategories?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxAmount?: number;

  @ApiPropertyOptional({ enum: TRANSACTION_SOURCES, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(TRANSACTION_SOURCES, { each: true })
  source?: TransactionSource[];

  @ApiPropertyOptional({ description: 'Partial match over notes and reference number.' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional({ description: 'Rows that do or do not carry an invoice photo.' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hasInvoice?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Voided rows stay readable behind this flag and are never in an aggregate.',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeVoided?: boolean;

  @ApiPropertyOptional({ enum: FINANCE_TRANSACTION_SORT_FIELDS, default: 'transactionDate' })
  @IsOptional()
  @IsIn(FINANCE_TRANSACTION_SORT_FIELDS)
  sortBy: FinanceTransactionSortField = 'transactionDate';
}

export class FinanceSummaryQueryDto extends LocalizedQueryDto {
  @ApiPropertyOptional({ example: '2026-08-01', description: 'Defaults to the current month.' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-08-31', description: 'Defaults to the current month.' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Adds the equally long period immediately before this one.',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  compareToPrevious?: boolean;
}

/** Depth 0 is the roots alone. */
const MAX_REPORT_DEPTH = 20;

export class FinanceByCategoryQueryDto extends LocalizedQueryDto {
  @ApiPropertyOptional({ example: '2026-06-01', description: 'Defaults to the current month.' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-08-31', description: 'Defaults to the current month.' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ enum: FINANCE_KINDS, default: FinanceKind.EXPENSE })
  @IsOptional()
  @IsIn(FINANCE_KINDS)
  kind?: FinanceKind;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Report on this subtree only.' })
  @IsOptional()
  @IsUUID()
  rootCategoryId?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_REPORT_DEPTH })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_REPORT_DEPTH)
  maxDepth?: number;
}

export const EXPORT_FORMATS = ['csv', 'xlsx'] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/**
 * The same filter set as the list, minus the page: an export is the whole selection or it is
 * useless. `EXPORT_MAX_ROWS` in the service is what keeps that from being unbounded.
 */
export class ExportFinanceTransactionsDto extends QueryFinanceTransactionsDto {
  @ApiPropertyOptional({ enum: EXPORT_FORMATS, default: 'csv' })
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format?: ExportFormat;
}
