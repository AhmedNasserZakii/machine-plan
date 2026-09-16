import type { ReportQueryParams } from '../model';

export const reportKeys = {
  all: ['reports'] as const,
  catalogue: () => [...reportKeys.all, 'catalogue'] as const,
  runs: () => [...reportKeys.all, 'run'] as const,
  run: (slug: string, params: ReportQueryParams) =>
    [...reportKeys.runs(), slug, params] as const,
  jobs: () => [...reportKeys.all, 'jobs'] as const,
  job: (id: string) => [...reportKeys.jobs(), id] as const,
};
