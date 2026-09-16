'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import type { Me } from '@/lib/api/types';

export const sessionKeys = {
  all: ['session'] as const,
};

export function useSession() {
  const query = useQuery({
    queryKey: sessionKeys.all,
    queryFn: async () => {
      const result = await api.get<Me>(endpoints.auth.me);
      return result.data;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  return {
    user: query.data,
    permissions: query.data?.permissions ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
