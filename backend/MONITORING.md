# Monitoring, alerting, and logging (`5.3`)

Three mechanisms, each doing what it is naturally suited for — none of them substitutes for
either of the others.

## 1. Error reporting (Sentry)

`@sentry/node`, wired in `src/common/observability/sentry.ts`. Off by default — set `SENTRY_DSN`
to turn it on (`SENTRY_ENVIRONMENT` and `SENTRY_TRACES_SAMPLE_RATE` are optional; tracing defaults
to `0`, since this integration is error reporting, not APM). Reports:

- Every genuine `5xx` an HTTP request produces (`AllExceptionsFilter`) — never a `4xx`, which is
  expected client traffic (validation, permission, not-found), not an incident.
- Every job a BullMQ queue (audit-log, media-optimize, report-exports) exhausted all 5 retries on.
- The hourly media-cleanup sweep's own failure, and a notification dispatch's swallowed failure
  (both already logged via `pino`; this makes them visible without grepping logs for them).
- Process-level `uncaughtException` (reported, then the process exits — the same thing Node
  already does by default, just with a report filed first) and `unhandledRejection` (reported and
  logged, without forcing an exit).

## 2. Metrics and alerting (Prometheus)

`GET /metrics` (`4.4`), bearer-protected by `METRICS_TOKEN` in production. Point a Prometheus
`scrape_configs` entry at it and load `backend/alerting-rules.yml` via `rule_files:`. Validated
for real in this session: a local Prometheus (`brew install prometheus`) scraping a real running
instance of this API, with the rule file loaded, evaluated all four rules with `health: ok` and no
PromQL errors (`promtool check rules backend/alerting-rules.yml` also passes standalone).

Alert rules and what they mean:

| Alert | Fires when | Why |
|---|---|---|
| `MachineryQueueJobsFailing` | Any queue job exhausts all 5 retries | Automatic recovery already failed once for real by the time this counter moves |
| `MachinerySyncOperationsFailing` | >10% of sync-batch operations fail over 15 min | A ratio, not a raw count — filters out one user's isolated mistake |
| `MachineryHighApiErrorRate` | >5% of HTTP responses are 5xx over 5 min | 5xx only; 4xx is expected traffic |
| `MachineryMediaCleanupFailing` | The hourly sweep leaves an object undeleted | Storage-cost risk, not data loss (the row is untouched, retried next sweep) |

**Deliberately not here**: storage/database/cache health. Those are readiness concerns — see
below — not counters to alert on a rate of.

## 3. Uptime monitoring (external service — not run by this repo)

Point any uptime monitor (UptimeRobot, Better Uptime, Pingdom, a cloud provider's own health
check, …) at:

- `GET /health` — liveness. Returns `200` as long as the process is up; never touches a
  dependency. Poll every 30–60s; alert after 2–3 consecutive failures (a single missed poll is
  noise, not an incident).
- `GET /health/ready` — readiness. Runs a real Postgres `pingCheck`, a real Redis/cache `PING`,
  and a real storage write-read-delete round trip (`StorageHealthIndicator`) — this is what
  answers "storage failure" from `5.2`'s checklist, not a `/metrics` counter. Poll every 30–60s;
  alert immediately on failure (a readiness failure means the API cannot actually serve requests
  correctly even though the process is alive).

Neither endpoint requires authentication (`@Public()`) or is subject to rate limiting
(`@SkipThrottle()`) or the forced-upgrade check (`@SkipVersionCheck()`) — an uptime monitor has no
session, no app version, and must never be the thing that gets throttled.

Setting this up is an external-account action outside this repo (no uptime-monitoring account
credentials exist here to provision one on the user's behalf) — this section is the complete spec
for whoever does.

## Structured logging: what is captured, retention, and redaction

**What is logged.** `nestjs-pino` (`app.module.ts`), one JSON line per request: method, URL,
matched route, status code, response time, request id, and (redacted) headers. **Request and
response bodies are never logged at all** — pino-http's default serializer does not include them,
and nothing in this app adds a custom one that would. A password, national ID, or signature
payload showing up in a log line is therefore not a redaction problem to solve; it is a body that
was never captured to begin with.

**What is redacted.** `Authorization` and `Cookie` headers are replaced with `[redacted]` before
a log line is ever written (`pinoHttp.redact`) — verified in this session by running a real login
+ authenticated request through the app with `LOG_LEVEL=debug` and reading the actual JSON log
output: the bearer token never appears, in any form.

**Retention.** This app writes structured JSON to `stdout` only — it does not manage log files or
rotation itself, by design: that is the hosting platform's job (a container platform's log
driver, a managed Postgres/App Platform's log retention setting, or a shipped-to log aggregator).
Recommended retention: **30 days hot** (searchable, for incident response) and, if the platform
supports cheap cold storage, **1 year archived** (for the rare "what happened three months ago"
question) — well short of the audit log's 5-year, tamper-resistant retention
(`backend/AUDIT_RETENTION.md`), because these are operational logs, not the legal/compliance
record. Nothing in this repo enforces that retention; it is host/platform configuration, recorded
here as the number to set.

## What is genuinely NOT done here

- The actual uptime-monitor account/dashboard — external, no credentials available to this repo.
- Prometheus/Alertmanager themselves are not run continuously by this repo (a local instance was
  started only to validate `alerting-rules.yml` for real, then stopped) — running one in
  production is a hosting decision (self-hosted, a managed Prometheus, or a SaaS that speaks the
  same rule-file format), not something this backend provisions for itself.
