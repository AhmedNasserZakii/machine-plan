import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api/client';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) =>
          error instanceof ApiError && (error.status >= 500 || error.status === 0)
            ? failureCount < 2
            : false,
      },
      mutations: { retry: false },
    },
  });
}
