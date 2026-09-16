'use client';

import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { useRef } from 'react';

import { ApiError } from '@/lib/api/client';
import { ErrorCode } from '@/lib/api/error-codes';
import { newIdempotencyKey } from '@/lib/api/idempotency';
import { useCanMutate } from '@/lib/network/use-online';

type Variables = Record<string, unknown> | void | undefined;

export function useIdempotentMutation<TData, TVariables extends Variables = void>(
  options: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'> & {
    mutationFn: (variables: TVariables, idempotencyKey: string) => Promise<TData>;
  },
) {
  const keyRef = useRef<string | null>(null);
  const payloadRef = useRef<string | null>(null);
  const canMutate = useCanMutate();

  return useMutation({
    ...options,
    mutationFn: async (variables: TVariables) => {
      if (!canMutate || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new ApiError(0, ErrorCode.NETWORK_ERROR, 'Offline');
      }
      const serialized = JSON.stringify(variables ?? null);
      if (keyRef.current === null || payloadRef.current !== serialized) {
        keyRef.current = newIdempotencyKey();
        payloadRef.current = serialized;
      }
      try {
        const result = await options.mutationFn(variables, keyRef.current);
        keyRef.current = null;
        payloadRef.current = null;
        return result;
      } catch (error) {
        throw error;
      }
    },
  });
}
