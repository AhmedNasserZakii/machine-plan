#!/usr/bin/env bash
#
# Probes every registered GET route against a running API and reports the
# status code for each.
#
# Only GETs are probed: a POST/PATCH sweep would either write junk or fail
# validation, and neither tells you whether the route is wired. A GET that
# answers 200 proves the controller, guard, service and query all work.
#
# Path parameters are filled from real rows fetched up front, so `/machines/:id`
# is probed with an id that actually exists rather than a fake uuid that would
# return a misleading 404.
#
#   ./scripts/probe-all-endpoints.sh
#
set -uo pipefail

BASE=${BASE:-http://localhost:3000/api/v1}
# Health sits outside the versioned prefix so a probe can reach it without
# knowing which API version is current.
ROOT=${ROOT:-http://localhost:3000}
PHONE=${PHONE:-01000000001}
PASSWORD=${PASSWORD:-Dev#12345}

TOKEN=$(curl -sS -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"password\":\"$PASSWORD\"}" |
  python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["accessToken"])')

auth=(-H "Authorization: Bearer $TOKEN")

# Pull one real id per collection so the :id routes get something valid.
first_id() {
  curl -sS "${auth[@]}" "$BASE/$1" |
    python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)["data"]
    rows = d if isinstance(d, list) else d.get("items", [])
    print(rows[0]["id"] if rows else "")
except Exception:
    print("")
'
}

MACHINE=$(first_id machines)
MERCHANT=$(first_id merchants)
VIOLATION=$(first_id violations)
TRANSFER=$(first_id transfers)
USER=$(first_id users)
BRANCH=$(first_id branches)
ROLE=$(first_id roles)
WAREHOUSE=$(first_id warehouses)

SERIAL=$(curl -sS "${auth[@]}" "$BASE/machines" |
  python3 -c 'import sys,json;print(json.load(sys.stdin)["data"][0]["serial"])')

pass=0; fail=0

probe() {
  local path="$1"
  local prefix="${2:-$BASE}"
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' "${auth[@]}" "$prefix$path")

  if [ "$code" = "200" ]; then
    printf '  \033[32mok  %s\033[0m %s\n' "$code" "$path"
    pass=$((pass + 1))
  else
    printf '  \033[31mFAIL %s\033[0m %s\n' "$code" "$path"
    fail=$((fail + 1))
  fi
}

echo "── auth ─────────────────────────────────────────────"
probe /auth/me

echo "── organization & lookups ───────────────────────────"
probe /branches
probe "/branches/$BRANCH"
probe "/branches/$BRANCH/summary"
probe /warehouses
probe "/warehouses/$WAREHOUSE"
probe /machine-types
probe /machine-models
probe /payment-methods
probe /violation-types
probe /maintenance-locations
probe /decommission-reasons

echo "── users & roles ────────────────────────────────────"
probe /users
probe "/users/$USER"
probe "/users/$USER/permissions"
probe "/users/$USER/violations/summary"
probe /roles
probe "/roles/$ROLE"
probe /permissions

echo "── machines ─────────────────────────────────────────"
probe /machines
probe "/machines/$MACHINE"
probe "/machines/$MACHINE/replacement-chain"
probe "/machines/by-serial/$SERIAL"
probe "/machines/lookup?code=$SERIAL"

echo "── merchants ────────────────────────────────────────"
probe /merchants
probe /merchants/pickable
probe "/merchants/$MERCHANT"
probe "/merchants/$MERCHANT/machines"
probe "/merchants/$MERCHANT/timeline"
probe "/merchants/$MERCHANT/subscriptions"

echo "── violations ───────────────────────────────────────"
probe /violations
probe "/violations/$VIOLATION"

echo "── transfers ────────────────────────────────────────"
probe /transfers
probe /transfers/pending/incoming
probe /transfers/pending/outgoing
probe /transfers/creatable-types
probe "/transfers/$TRANSFER"

echo "── health ───────────────────────────────────────────"
probe /health "$ROOT"
probe /health/ready "$ROOT"

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
