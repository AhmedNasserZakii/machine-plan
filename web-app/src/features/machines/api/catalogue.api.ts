import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import type { ListMeta } from '@/lib/api/pagination';

import type { MachineModel, MachineType } from '../model';

export const catalogueApi = {
  types(params?: { search?: string; limit?: number; isActive?: boolean }) {
    return api.get<MachineType[], ListMeta>(endpoints.machineTypes.list, {
      search: params?.search,
      limit: params?.limit ?? 100,
      isActive: params?.isActive,
    });
  },

  models(params?: {
    search?: string;
    limit?: number;
    machineTypeId?: string;
    isActive?: boolean;
  }) {
    return api.get<MachineModel[], ListMeta>(endpoints.machineModels.list, {
      search: params?.search,
      limit: params?.limit ?? 100,
      machineTypeId: params?.machineTypeId,
      isActive: params?.isActive,
    });
  },
};
