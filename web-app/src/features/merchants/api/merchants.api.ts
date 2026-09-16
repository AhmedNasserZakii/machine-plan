import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import type { ListMeta } from '@/lib/api/pagination';
import type { QueryParams } from '@/lib/api/query';

import type {
  CheckMerchantDto,
  CollectSubscriptionDto,
  CreateMerchantDto,
  CreateSubscriptionDto,
  MachineListItem,
  Merchant,
  MerchantDuplicateCheck,
  MerchantListItem,
  MerchantsListParams,
  MerchantTimelineEntry,
  Subscription,
  UpdateMerchantDto,
  UpdateSubscriptionDto,
} from '../model';

function listQuery(params: MerchantsListParams): QueryParams {
  return {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    search: params.search,
    branchId: params.branchId,
    createdByUserId: params.createdByUserId,
    hasMachines: params.hasMachines,
    isActive: params.isActive,
    includeInactive: params.includeInactive,
  };
}

export const merchantsApi = {
  list(params: MerchantsListParams = {}) {
    return api.get<MerchantListItem[], ListMeta>(endpoints.merchants.list, listQuery(params));
  },

  get(id: string) {
    return api.get<Merchant>(endpoints.merchants.byId(id));
  },

  check(body: CheckMerchantDto) {
    return api.post<MerchantDuplicateCheck>(endpoints.merchants.check, body);
  },

  create(body: CreateMerchantDto, idempotencyKey: string) {
    return api.post<Merchant>(endpoints.merchants.list, body, idempotencyKey);
  },

  update(id: string, body: UpdateMerchantDto, idempotencyKey: string) {
    return api.patch<Merchant>(endpoints.merchants.byId(id), body, idempotencyKey);
  },

  deactivate(id: string, idempotencyKey: string) {
    return api.patch<Merchant>(endpoints.merchants.deactivate(id), {}, idempotencyKey);
  },

  machines(id: string, params?: { page?: number; limit?: number }) {
    return api.get<MachineListItem[], ListMeta>(endpoints.merchants.machines(id), params);
  },

  timeline(id: string, params?: { limit?: number; cursor?: string | null }) {
    return api.get<MerchantTimelineEntry[], ListMeta>(endpoints.merchants.timeline(id), {
      limit: params?.limit,
      cursor: params?.cursor ?? undefined,
    });
  },

  subscriptions(id: string) {
    return api.get<Subscription[]>(endpoints.merchants.subscriptions(id));
  },

  createSubscription(merchantId: string, body: CreateSubscriptionDto, idempotencyKey: string) {
    return api.post<Subscription>(
      endpoints.merchants.subscriptions(merchantId),
      body,
      idempotencyKey,
    );
  },

  updateSubscription(id: string, body: UpdateSubscriptionDto, idempotencyKey: string) {
    return api.patch<Subscription>(endpoints.subscriptions.byId(id), body, idempotencyKey);
  },

  collectSubscription(id: string, body: CollectSubscriptionDto, idempotencyKey: string) {
    return api.post<Subscription>(endpoints.subscriptions.collect(id), body, idempotencyKey);
  },
};
