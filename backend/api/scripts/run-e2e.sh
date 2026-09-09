#!/usr/bin/env bash
#
# Runs the e2e suite against a database private to this invocation.
#
# The reset step drops its database `WITH (FORCE)`, which terminates whatever is connected to
# it. On a single shared database that means a second run silently destroys a first one that is
# still going, and the victim fails with confusing `INTERNAL_ERROR` 500s from unrelated
# endpoints rather than anything pointing at the real cause. Giving each run its own database
# removes the interaction entirely.
#
# `$$` is this script's pid, so the reset step and jest agree on the name while two concurrent
# invocations cannot collide.
#
#   ./scripts/run-e2e.sh                  # whole suite
#   ./scripts/run-e2e.sh test/finance.e2e-spec.ts -t "voids"
#
set -uo pipefail

cd "$(dirname "$0")/.."

export TEST_DB_NAME="machinery_e2e_$$"

# `pdf-parse` (used only in reports.e2e-spec.ts, to verify the PDF export's own content) pulls in
# `pdfjs-dist`, which dynamically `import()`s a worker module — something Jest's CJS module
# loader refuses without this flag, regardless of Node version. Nothing in the app itself needs
# it; this only widens what Jest's VM contexts are allowed to do, so it is safe to set for the
# whole run rather than singling out one spec file.
export NODE_OPTIONS="${NODE_OPTIONS:-} --experimental-vm-modules"

# Dropped on every exit path, including a failed run or a Ctrl-C, so these do not accumulate.
cleanup() {
  npx ts-node -r tsconfig-paths/register test/setup/drop-db.ts >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

npm run e2e:db:reset || exit 1

npx jest --config ./test/jest-e2e.json --runInBand "$@"
