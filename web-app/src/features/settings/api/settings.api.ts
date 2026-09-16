
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import type { Schema } from '@/lib/api/types';

export type Setting = Schema<'SettingResponse'>;
export type UpdateSettingDto = Schema<'UpdateSettingDto'>;

export const settingsApi = {
  list() {
    return api.get<Setting[]>(endpoints.settings.list);
  },
  get(key: string) {
    return api.get<Setting>(endpoints.settings.byKey(key));
  },
  update(key: string, body: UpdateSettingDto, idempotencyKey: string) {
    return api.put<Setting>(endpoints.settings.byKey(key), body, idempotencyKey);
  },
};
