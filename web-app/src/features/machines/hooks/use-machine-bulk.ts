'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { newIdempotencyKey } from '@/lib/api/idempotency';
import { useIdempotentMutation } from '@/lib/query/use-idempotent-mutation';

import { machinesApi } from '../api/machines.api';
import type { BulkCreateMachinesDto, CreateMachineDto, MachinesListParams } from '../model';
import { machineKeys } from './query-keys';

export const BULK_CHUNK_SIZE = 50;

export function useBulkImportMachines() {
  const qc = useQueryClient();

  return useIdempotentMutation({
    mutationFn: async (body: BulkCreateMachinesDto, key: string) => {
      const result = await machinesApi.bulk(body, key);
      return result.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: machineKeys.all });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * Submit rows in chunks of 50. Each chunk keeps its own idempotency key across
 * retries; succeeded chunks are never resent.
 */
export async function submitBulkChunks(
  rows: CreateMachineDto[],
  options: {
    chunkKeys: Map<number, string>;
    succeededChunks: Set<number>;
    onChunkStart?: (index: number, total: number) => void;
    onChunkSuccess?: (index: number, created: number) => void;
    onChunkFailure?: (index: number, error: unknown) => void;
  },
) {
  const totalChunks = Math.ceil(rows.length / BULK_CHUNK_SIZE) || 0;
  let created = 0;
  const failures: Array<{ chunkIndex: number; error: unknown }> = [];

  for (let i = 0; i < totalChunks; i++) {
    if (options.succeededChunks.has(i)) continue;

    const start = i * BULK_CHUNK_SIZE;
    const chunk = rows.slice(start, start + BULK_CHUNK_SIZE);
    if (!options.chunkKeys.has(i)) {
      options.chunkKeys.set(i, newIdempotencyKey());
    }
    const key = options.chunkKeys.get(i)!;
    options.onChunkStart?.(i, totalChunks);

    try {
      const result = await machinesApi.bulk({ machines: chunk }, key);
      options.succeededChunks.add(i);
      created += result.data.created;
      options.onChunkSuccess?.(i, result.data.created);
    } catch (error) {
      failures.push({ chunkIndex: i, error });
      options.onChunkFailure?.(i, error);
    }
  }

  return { created, failures, totalChunks };
}

export function useExportMachinesView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: MachinesListParams) => {
      const result = await machinesApi.exportInventory({ ...params, format: 'csv' });
      return result.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports', 'jobs'] });
    },
  });
}
