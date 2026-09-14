import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SUBSCRIPTION_PLAN_TYPES, SubscriptionPlanType } from 'src/common/enums/finance.enum';

export class MerchantBranchRefResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
}

export class MerchantUserRefResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'أحمد سالم' }) fullName: string;
}

export class SubscriptionResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: SUBSCRIPTION_PLAN_TYPES }) planType: SubscriptionPlanType;

  @ApiProperty({ format: 'uuid', nullable: true, description: 'Null for a merchant-wide plan.' })
  machineId: string | null;

  @ApiProperty({ nullable: true }) machineSerial: string | null;
  @ApiProperty({ example: 350 }) amount: number;
  @ApiProperty({ example: '2026-09-01' }) startDate: string;
  @ApiProperty({ nullable: true }) endDate: string | null;
  @ApiProperty({ nullable: true }) nextDueDate: string | null;

  /** True once `nextDueDate` is behind today — the flag the overdue list is built from. */
  @ApiProperty() isOverdue: boolean;

  @ApiProperty() totalCollected: number;
  @ApiProperty() collectionCount: number;
  @ApiProperty({ nullable: true }) lastCollectedAt: string | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ nullable: true }) notes: string | null;
}

/** The row shape for `GET /merchants`. */
export class MerchantListItemResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() shopName: string;
  @ApiProperty() phone: string;
  @ApiProperty({ nullable: true }) address: string | null;

  @ApiProperty({ type: MerchantBranchRefResponse, nullable: true })
  branch: MerchantBranchRefResponse | null;

  @ApiProperty({ description: 'Machines this merchant is holding right now.' })
  machinesCount: number;

  @ApiProperty() isActive: boolean;
}

export class MerchantResponse extends MerchantListItemResponse {
  @ApiProperty({ nullable: true }) nationalId: string | null;

  @ApiProperty({ type: MerchantUserRefResponse, nullable: true })
  registeredBy: MerchantUserRefResponse | null;

  @ApiProperty({
    type: SubscriptionResponse,
    nullable: true,
    description: 'The live plan, merchant-wide first. Null when nothing is arranged.',
  })
  activeSubscription: SubscriptionResponse | null;

  @ApiProperty({ description: 'Every collection ever taken from this merchant.' })
  totalPaid: number;

  @ApiProperty({ nullable: true }) notes: string | null;
  @ApiProperty() createdAt: string;
}

/** What `POST /merchants/check` answers while the representative is still typing. */
export class MerchantDuplicateCheckResponse {
  @ApiProperty({
    enum: ['DUPLICATE_PHONE', 'DUPLICATE_NATIONAL_ID'],
    isArray: true,
    description: 'Empty when nothing matched. A phone match never blocks creation.',
  })
  warnings: string[];

  @ApiPropertyOptional({ type: [MerchantListItemResponse] })
  existing: MerchantListItemResponse[];
}

export class MerchantTimelineEntryResponse {
  @ApiProperty({ enum: ['TRANSFER', 'SUBSCRIPTION_STARTED', 'COLLECTION'] })
  kind: string;

  @ApiProperty() occurredAt: string;
  @ApiProperty({ description: 'Stable id of this feed row; used as the keyset tiebreaker.' })
  refId: string;
  @ApiProperty({ nullable: true }) referenceNo: string | null;
  @ApiProperty({ nullable: true }) machineSerial: string | null;
  @ApiProperty({ nullable: true }) amount: number | null;

  @ApiProperty({
    description: 'A stable code the client localizes, e.g. RECEIVED_MACHINES.',
  })
  code: string;
}
