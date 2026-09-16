import type { Schema } from '@/lib/api/types';

export type MerchantListItem = Schema<'MerchantListItemResponse'>;
export type Merchant = Schema<'MerchantResponse'>;
export type MerchantTimelineEntry = Schema<'MerchantTimelineEntryResponse'>;
export type Subscription = Schema<'SubscriptionResponse'>;
export type MerchantDuplicateCheck = Schema<'MerchantDuplicateCheckResponse'>;
export type CreateMerchantDto = Schema<'CreateMerchantDto'>;
export type UpdateMerchantDto = Schema<'UpdateMerchantDto'>;
export type CreateSubscriptionDto = Schema<'CreateSubscriptionDto'>;
export type UpdateSubscriptionDto = Schema<'UpdateSubscriptionDto'>;
export type CollectSubscriptionDto = Schema<'CollectSubscriptionDto'>;
export type CheckMerchantDto = Schema<'CheckMerchantDto'>;
export type MachineListItem = Schema<'MachineListItemResponse'>;

export type SubscriptionPlanType = Subscription['planType'];

export type MerchantsListParams = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  branchId?: string;
  createdByUserId?: string;
  hasMachines?: boolean;
  isActive?: boolean;
  includeInactive?: boolean;
};

export const SUBSCRIPTION_PLAN_TYPES = [
  'NONE',
  'ONE_TIME_FEE',
  'WEEKLY',
  'MONTHLY',
] as const satisfies readonly SubscriptionPlanType[];
