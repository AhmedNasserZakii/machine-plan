#!/usr/bin/env bash
#
# Runs the integration suite (currently: real S3/MinIO storage round trips) against a database
# private to this invocation, same as `run-e2e.sh`.
#
# Requires a running S3-compatible server. Defaults point at a local MinIO started the same way
# the project's docker-compose does:
#
#   docker compose up -d minio minio-init
#   npm run test:integration
#
# Override S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY to point at a
# different instance (e.g. a real S3 bucket in CI).
#
#   ./scripts/run-integration.sh                  # whole integration suite
#   ./scripts/run-integration.sh -t "checksum"     # one test by name
#
set -uo pipefail

cd "$(dirname "$0")/.."

export TEST_DB_NAME="machinery_integration_$$"
export S3_ENDPOINT="${S3_ENDPOINT:-http://localhost:9000}"
export S3_REGION="${S3_REGION:-us-east-1}"
export S3_BUCKET="${S3_BUCKET:-machinery-media}"
export S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-minioadmin}"
export S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-minioadmin}"
export S3_FORCE_PATH_STYLE="${S3_FORCE_PATH_STYLE:-true}"

cleanup() {
  npx ts-node -r tsconfig-paths/register test/setup/drop-db.ts >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

npm run e2e:db:reset || exit 1

npx jest --config ./test/jest-integration.json --runInBand "$@"
