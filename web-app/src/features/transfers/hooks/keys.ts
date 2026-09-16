import type { TransfersListParams } from '../api/transfers-api';
import type { TransfersView } from '../model/types';

export const transferKeys = {
  all: ['transfers'] as const,
  lists: () => [...transferKeys.all, 'list'] as const,
  list: (view: TransfersView, params: TransfersListParams) =>
    [...transferKeys.lists(), view, params] as const,
  pendings: () => [...transferKeys.all, 'pending'] as const,
  pendingIncoming: () => [...transferKeys.pendings(), 'incoming'] as const,
  pendingOutgoing: () => [...transferKeys.pendings(), 'outgoing'] as const,
  details: () => [...transferKeys.all, 'detail'] as const,
  detail: (id: string) => [...transferKeys.details(), id] as const,
  creatableTypes: () => [...transferKeys.all, 'creatable-types'] as const,
  recipients: (type: string, search: string) =>
    [...transferKeys.all, 'recipients', type, search] as const,
  signatureMedia: (transferId: string, signatureId: string) =>
    [...transferKeys.all, 'signature-media', transferId, signatureId] as const,
};

export const machineKeys = {
  all: ['machines'] as const,
};

export const dashboardKeys = {
  all: ['dashboard'] as const,
};

export const notificationKeys = {
  all: ['notifications'] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};
