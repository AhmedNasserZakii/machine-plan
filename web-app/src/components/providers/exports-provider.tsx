'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type TrackedExportJob = {
  id: string;
  startedAt: number;
  reportKey?: string;
  format?: string;
};

const STORAGE_KEY = 'reports.trackedExports';

function loadJobs(): TrackedExportJob[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (j): j is TrackedExportJob =>
        !!j && typeof j === 'object' && typeof (j as TrackedExportJob).id === 'string',
    );
  } catch {
    return [];
  }
}

function persistJobs(jobs: TrackedExportJob[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(-40)));
}

type ExportsContextValue = {
  jobs: TrackedExportJob[];
  trackJob: (id: string, meta?: { reportKey?: string; format?: string }) => void;
  dismissJob: (id: string) => void;
};

const ExportsContext = createContext<ExportsContextValue | null>(null);

export function ExportsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<TrackedExportJob[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setJobs(loadJobs());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistJobs(jobs);
  }, [jobs, hydrated]);

  const trackJob = useCallback((id: string, meta?: { reportKey?: string; format?: string }) => {
    setJobs((prev) => {
      if (prev.some((job) => job.id === id)) return prev;
      return [...prev, { id, startedAt: Date.now(), ...meta }];
    });
  }, []);

  const dismissJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((job) => job.id !== id));
  }, []);

  const value = useMemo(
    () => ({ jobs, trackJob, dismissJob }),
    [dismissJob, jobs, trackJob],
  );

  return <ExportsContext.Provider value={value}>{children}</ExportsContext.Provider>;
}

export function useExports() {
  const ctx = useContext(ExportsContext);
  if (!ctx) {
    throw new Error('useExports must be used within ExportsProvider');
  }
  return ctx;
}
