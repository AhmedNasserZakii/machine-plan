import { SubscriptionPlanType } from 'src/common/enums/finance.enum';
import {
  MerchantListItemResponse,
  MerchantResponse,
  SubscriptionResponse,
} from '../dto/responses/merchant.response';
import { MerchantSubscription } from '../entities/merchant-subscription.entity';
import { Merchant } from '../entities/merchant.entity';

/** Numeric columns arrive from `pg` as strings so no precision is lost in transit. */
function toNumber(value: string | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

/** Compares the stored `DATE` against today in the same calendar terms the column is written in. */
function isOverdue(subscription: MerchantSubscription, now: Date): boolean {
  if (!subscription.isActive || !subscription.nextDueDate) return false;

  return subscription.nextDueDate < now.toISOString().slice(0, 10);
}

export function toSubscriptionResponse(
  subscription: MerchantSubscription,
  now = new Date(),
): SubscriptionResponse {
  return {
    id: subscription.id,
    planType: subscription.planType,
    machineId: subscription.machineId,
    machineSerial: subscription.machine?.serial ?? null,
    amount: toNumber(subscription.amount),
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    nextDueDate: subscription.nextDueDate,
    isOverdue: isOverdue(subscription, now),
    totalCollected: toNumber(subscription.totalCollected),
    collectionCount: subscription.collectionCount,
    lastCollectedAt: subscription.lastCollectedAt?.toISOString() ?? null,
    isActive: subscription.isActive,
    notes: subscription.notes,
  };
}

export function toMerchantListItemResponse(
  merchant: Merchant,
  machinesCount: number,
): MerchantListItemResponse {
  return {
    id: merchant.id,
    name: merchant.name,
    shopName: merchant.shopName,
    phone: merchant.phone,
    address: merchant.address,
    branch: merchant.branch ? { id: merchant.branch.id, name: merchant.branch.name } : null,
    machinesCount,
    isActive: merchant.isActive,
  };
}

/**
 * A merchant-wide plan is shown in preference to a per-machine one: it is the arrangement the
 * representative quotes when asked "what does this shop pay?", and a per-machine plan is a detail
 * of the subscriptions list rather than a headline.
 */
function pickActive(subscriptions: MerchantSubscription[]): MerchantSubscription | null {
  const live = subscriptions.filter(
    (subscription) => subscription.isActive && subscription.planType !== SubscriptionPlanType.NONE,
  );

  return live.find((subscription) => subscription.machineId === null) ?? live[0] ?? null;
}

export function toMerchantResponse(
  merchant: Merchant,
  machinesCount: number,
  now = new Date(),
): MerchantResponse {
  const subscriptions = merchant.subscriptions ?? [];
  const active = pickActive(subscriptions);

  return {
    ...toMerchantListItemResponse(merchant, machinesCount),
    nationalId: merchant.nationalId,
    registeredBy: merchant.registeredBy
      ? { id: merchant.registeredBy.id, fullName: merchant.registeredBy.fullName }
      : null,
    activeSubscription: active ? toSubscriptionResponse(active, now) : null,
    // Across every plan the merchant has ever had, live or ended — what he has actually paid.
    totalPaid: subscriptions.reduce(
      (sum, subscription) => sum + toNumber(subscription.totalCollected),
      0,
    ),
    notes: merchant.notes,
    createdAt: merchant.createdAt.toISOString(),
  };
}
