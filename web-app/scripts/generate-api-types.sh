#!/usr/bin/env bash
# generate-api-types.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
npx openapi-typescript "$ROOT/../backend/api/openapi.json" -o "$ROOT/src/lib/api/generated/schema.d.ts"
