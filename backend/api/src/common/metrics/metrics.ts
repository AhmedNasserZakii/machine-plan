import { Counter, Gauge, Histogram } from 'prom-client';
import { registry } from './registry';

/**
 * Every custom metric this backend exposes (`4.4`, plan `22`'s `GET /metrics`).
 *
 * Plain module-level `prom-client` instances rather than a `MetricsService` a caller injects:
 * the metric objects themselves have no dependencies (they close over nothing but the shared
 * `registry`), so every call site — a queue's `worker.on('failed', ...)`, a sync batch loop, a
 * notification dispatcher — just imports the one it needs and calls `.inc()`/`.observe()`
 * directly, with no module wiring required to reach it. `MetricsController` is the only thing
 * that imports `registry` itself, to serialize it.
 *
 * Label sets are kept deliberately small and closed (enum values, HTTP status codes, a short
 * list of queue names) — an open-ended label such as a raw URL or a user id would let a single
 * caller blow up Prometheus's series cardinality.
 */

export const httpRequestDuration = new Histogram({
  name: 'machinery_api_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestsTotal = new Counter({
  name: 'machinery_api_http_requests_total',
  help: 'Total HTTP requests handled',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const httpRequestErrorsTotal = new Counter({
  name: 'machinery_api_http_request_errors_total',
  help: 'Total HTTP requests that answered with a 4xx or 5xx status',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

/** Sampled at scrape time from each queue's live `getJobCounts()` — see `MetricsController`. */
export const queueDepth = new Gauge({
  name: 'machinery_api_queue_depth',
  help: 'Waiting + active + delayed jobs currently on a queue (broker mode only)',
  labelNames: ['queue'],
  registers: [registry],
});

export const queueJobsFailedTotal = new Counter({
  name: 'machinery_api_queue_jobs_failed_total',
  help: 'Jobs that exhausted every retry — the closest thing this app has to a dead letter',
  labelNames: ['queue'],
  registers: [registry],
});

export const syncOperationsTotal = new Counter({
  name: 'machinery_api_sync_operations_total',
  help: 'Offline sync-batch operations processed, by type and outcome',
  labelNames: ['type', 'status'],
  registers: [registry],
});

export const pushDeliveryTotal = new Counter({
  name: 'machinery_api_push_delivery_total',
  help: 'Push notifications resolved to a final delivery status',
  labelNames: ['status'],
  registers: [registry],
});

export const reportJobsTotal = new Counter({
  name: 'machinery_api_report_jobs_total',
  help: 'Report export jobs completed, by format and outcome',
  labelNames: ['format', 'status'],
  registers: [registry],
});

export const mediaCleanupRemovedTotal = new Counter({
  name: 'machinery_api_media_cleanup_removed_total',
  help: 'Orphaned media objects removed by the hourly cleanup sweep',
  registers: [registry],
});

export const mediaCleanupFailedTotal = new Counter({
  name: 'machinery_api_media_cleanup_failed_total',
  help: 'Media cleanup rows that failed to delete from storage and were left for the next sweep',
  registers: [registry],
});
