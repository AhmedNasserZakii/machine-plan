import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { MAX_MONEY_AMOUNT } from 'src/common/constants/money';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { toBoolean } from 'src/common/dto/query.dto';
import { SUBSCRIPTION_PLAN_TYPES, SubscriptionPlanType } from 'src/common/enums/finance.enum';
import { IsEgyptianMobile } from 'src/common/validators/is-egyptian-mobile.validator';

export class CreateMerchantDto {
  @ApiProperty({ example: 'محمد عبد الله', maxLength: 150 })
  @IsString()
  @Length(3, 150)
  name: string;

  @ApiProperty({ example: '01012345678' })
  @IsEgyptianMobile()
  phone: string;

  @ApiProperty({ example: 'سوبر ماركت النور', maxLength: 150 })
  @IsString()
  @Length(2, 150)
  shopName: string;

  @ApiProperty({ example: 'شارع الجمهورية، المنصورة', maxLength: 500 })
  @IsString()
  @Length(5, 500)
  address: string;

  @ApiPropertyOptional({ example: '29801011234567', description: '14 digits.' })
  @IsOptional()
  @Matches(/^\d{14}$/, { message: 'nationalId must be exactly 14 digits' })
  nationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Device-generated id. Re-sending it returns the merchant already registered.',
  })
  @IsOptional()
  @IsUUID()
  clientUuid?: string;
}

/**
 * Everything a merchant record holds is correctable — a phone written down wrong in a shop is the
 * single most common fix. `branchId` and `createdByUserId` are absent on purpose: moving a merchant
 * between branches is not an edit, it is a re-registration.
 */
export class UpdateMerchantDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @Length(3, 150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEgyptianMobile()
  phone?: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @Length(2, 150)
  shopName?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(5, 500)
  address?: string;

  @ApiPropertyOptional({ description: '14 digits.' })
  @IsOptional()
  @Matches(/^\d{14}$/, { message: 'nationalId must be exactly 14 digits' })
  nationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}

export const MERCHANT_SORT_FIELDS = ['createdAt', 'name', 'shopName'] as const;

export type MerchantSortField = (typeof MERCHANT_SORT_FIELDS)[number];

export class QueryMerchantsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Matches name, shop name or phone.' })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'The representative who registered him.' })
  @IsOptional()
  @IsUUID()
  createdByUserId?: string;

  @ApiPropertyOptional({ description: 'Only merchants currently holding at least one machine.' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hasMachines?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Returns active and deactivated merchants together, overriding isActive.',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeInactive?: boolean;

  @ApiPropertyOptional({ enum: MERCHANT_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(MERCHANT_SORT_FIELDS)
  sortBy: MerchantSortField = 'createdAt';
}

/**
 * The pre-flight the app runs while the representative is still typing. Duplicate phones are a
 * warning rather than a block (`08`), so this exists to show him the existing shop before he
 * creates a second one — not to stop him if it really is a different merchant on the same line.
 */
export class CheckMerchantDto {
  @ApiProperty({ example: '01012345678' })
  @IsEgyptianMobile()
  phone: string;

  @ApiPropertyOptional({ description: '14 digits.' })
  @IsOptional()
  @Matches(/^\d{14}$/, { message: 'nationalId must be exactly 14 digits' })
  nationalId?: string;
}

export class CreateSubscriptionDto {
  @ApiProperty({ enum: SUBSCRIPTION_PLAN_TYPES })
  @IsIn(SUBSCRIPTION_PLAN_TYPES)
  planType: SubscriptionPlanType;

  @ApiPropertyOptional({ format: 'uuid', description: 'Omit for a merchant-wide plan.' })
  @IsOptional()
  @IsUUID()
  machineId?: string;

  @ApiProperty({ example: 350 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  amount: number;

  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2027-09-01' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Device-generated id. Re-sending it returns the plan already started.',
  })
  @IsOptional()
  @IsUUID()
  clientUuid?: string;
}

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({ example: 400 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Ends the plan without deleting its collection history.' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}

export class CollectSubscriptionDto {
  @ApiProperty({ example: 350 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_MONEY_AMOUNT)
  amount: number;

  @ApiProperty({ example: '2026-09-08T10:00:00.000Z' })
  @IsDateString()
  collectedAt: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  paymentMethodId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'A photographed receipt.' })
  @IsOptional()
  @IsUUID()
  invoiceMediaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}

export class QueryMerchantMachinesDto extends PaginationDto {}

export class DeactivateMerchantDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(3, 500)
  reason?: string;
}

/** Kept out of `QueryMerchantsDto` so the list endpoint's own `sortBy` default is not shadowed. */
export class MerchantTimelineQueryDto {
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  // The documented maximum was never enforced: `@IsNumber` accepts 1e9 and a fraction, and
  // the value goes straight into a `LIMIT`. `@IsInt` with a real ceiling is what the
  // annotation above was already promising.
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
}
