import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import type { ListMeta } from '@/lib/api/pagination';
import type { QueryParams } from '@/lib/api/query';

import type {
  CancelTransferBody,
  ConfirmTransferBody,
  CreatableTransferType,
  CreateTransferBody,
  RejectTransferBody,
  Transfer,
  TransferListItem,
  TransferRecipient,
  TransferSignatureMedia,
  TransfersView,
  TransferValidation,
} from '../model/types';

export type TransfersListParams = QueryParams & {
  page?: number;
  limit?: number;
  sortDir?: 'asc' | 'desc';
  type?: string | string[];
  status?: string | string[];
  branchId?: string;
  machineId?: string;
  fromPartyId?: string;
  toPartyId?: string;
  dateFrom?: string;
  dateTo?: string;
  hasViolations?: boolean;
};

function listPath(view: TransfersView): string {
  if (view === 'incoming') return endpoints.transfers.incoming;
  if (view === 'outgoing') return endpoints.transfers.outgoing;
  return endpoints.transfers.list;
}

export const transfersApi = {
  list(view: TransfersView, params?: TransfersListParams) {
    return api.get<TransferListItem[], ListMeta>(listPath(view), params);
  },

  pendingIncoming(limit = 5) {
    return api.get<TransferListItem[], ListMeta>(endpoints.transfers.incoming, { limit });
  },

  pendingOutgoing(limit = 5) {
    return api.get<TransferListItem[], ListMeta>(endpoints.transfers.outgoing, { limit });
  },

  detail(id: string) {
    return api.get<Transfer>(endpoints.transfers.byId(id));
  },

  creatableTypes() {
    return api.get<CreatableTransferType[]>(endpoints.transfers.creatableTypes);
  },

  recipients(params: { type: string; search?: string; page?: number; limit?: number }) {
    return api.get<TransferRecipient[], ListMeta>(endpoints.transfers.recipients, params);
  },

  /** Dry-run; exempt from idempotency so the wizard can call it freely. */
  validate(body: CreateTransferBody) {
    return api.post<TransferValidation>(endpoints.transfers.validate, body);
  },

  create(body: CreateTransferBody, idempotencyKey: string) {
    return api.post<Transfer>(endpoints.transfers.list, body, idempotencyKey);
  },

  confirm(id: string, body: ConfirmTransferBody, idempotencyKey: string) {
    return api.post<Transfer>(endpoints.transfers.confirm(id), body, idempotencyKey);
  },

  reject(id: string, body: RejectTransferBody, idempotencyKey: string) {
    return api.post<Transfer>(endpoints.transfers.reject(id), body, idempotencyKey);
  },

  cancel(id: string, body: CancelTransferBody | undefined, idempotencyKey: string) {
    return api.post<Transfer>(endpoints.transfers.cancel(id), body ?? {}, idempotencyKey);
  },

  signatureMedia(transferId: string, signatureId: string) {
    return api.get<TransferSignatureMedia>(
      endpoints.transfers.signatureMedia(transferId, signatureId),
    );
  },
};
