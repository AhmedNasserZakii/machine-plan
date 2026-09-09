import { collectDefaultMetrics, Registry } from 'prom-client';

/**
 * One process-wide registry (`4.4`). Every custom metric in `metrics.ts` registers itself here,
 * and `MetricsController` serializes exactly this registry — nothing reaches for the
 * library-global default registry, so a second `Registry` instantiated by a test or a future
 * module can never silently double-count or go unscraped.
 */
export const registry = new Registry();

/** Node/process metrics (CPU, event loop lag, heap, GC, open handles) — free from prom-client. */
collectDefaultMetrics({ register: registry, prefix: 'machinery_api_' });
