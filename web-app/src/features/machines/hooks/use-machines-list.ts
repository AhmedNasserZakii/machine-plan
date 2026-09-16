'use client';

import { useQuery } from '@tanstack/react-query';

import { machinesApi } from '../api/machines.api';
import type { MachinesListParams } from '../model';
import { machineKeys } from './query-keys';

export function useMachinesQuery(params: MachinesListParams) {
  return useQuery({
    queryKey: machineKeys.list(params),
    queryFn: () => machinesApi.list(params),
  });
}
