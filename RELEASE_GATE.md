# Final release gate — ops runbook

Companion to `IMPLEMENTATION_TODO.md` Final release gate. Code/docs in-repo; **execution** is ops.

## Backend (automated)

```bash
cd backend/api
npm run typecheck
npm run lint
npm test
npm run test:e2e   # needs Docker/DB as documented in scripts/run-e2e.sh
```

## Flutter (automated)

```bash
cd mobile-app
# Requires Flutter with Dart ^3.9.2
flutter analyze
flutter test
./scripts/run_flavor.sh development
./maestro/run.sh
LIVE=1 ./maestro/run.sh maestro/live/
```

## Production config

1. Edit `mobile-app/config/production.env.json` — real `API_BASE_URL` + store URLs.
2. Replace debug signing in `android/app/build.gradle.kts` with release keystore.
3. Build: `./scripts/run_flavor.sh production appbundle` and `./scripts/run_flavor.sh production ipa`.

## Observability ownership

| Concern | Doc / entrypoint | Owner (fill in) |
|---------|------------------|-----------------|
| API errors | `backend/MONITORING.md` (Sentry) | |
| Metrics / alerts | `backend/alerting-rules.yml` | |
| Uptime | `GET /health` + `/health/ready` | |
| Mobile crashes | `CrashReporter` DI — wire Sentry/Crashlytics DSN | |
| Mobile funnels | `AppAnalytics` + `AnalyticsEvents` | |
| Privacy / retention | `backend/AUDIT_RETENTION.md`, MONITORING §logging | |

## Data durability drills

| Drill | How | Last rehearsal |
|-------|-----|----------------|
| Backup | `backend/BACKUP_RECOVERY.md` + `backend/api/scripts/backup-db.sh` | |
| Restore | `backend/api/scripts/restore-db.sh` into a throwaway DB | |
| Audit immutability | `backend/AUDIT_RETENTION.md` + `npm run test:e2e -- audit-logs` | |
| Offline triple-replay | Field test §2 in `mobile-app/maestro/FIELD_TEST.md` | |

## Arabic exports on real software

Open one CSV, one XLSX, one PDF from `GET /reports/.../export` on:

- [ ] Android Files / Google Sheets / Drive PDF viewer  
- [ ] iOS Files / Numbers / Preview  

Confirm Arabic columns render correctly.
