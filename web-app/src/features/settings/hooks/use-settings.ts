
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useIdempotentMutation } from '@/lib/query/use-idempotent-mutation';

import { settingsApi, type UpdateSettingDto } from '../api/settings.api';

export const settingsKeys = {
  all: ['settings'] as const,
  list: () => [...settingsKeys.all, 'list'] as const,
};

export function useSystemSettings() {
  return useQuery({
    queryKey: settingsKeys.list(),
    queryFn: async () => (await settingsApi.list()).data ?? [],
  });
}

export function useUpdateSettingMutation() {
  const qc = useQueryClient();
  return useIdempotentMutation({
    mutationFn: async (vars: { key: string; body: UpdateSettingDto }, key: string) =>
      (await settingsApi.update(vars.key, vars.body, key)).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}
