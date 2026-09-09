#!/usr/bin/env bash
# Captures real merchant/violation payloads from a running dev API so the
# mobile contract tests can be pinned against the actual wire format.
set -euo pipefail

BASE=${BASE:-http://localhost:3000/api/v1}
PHONE=${PHONE:-01000000001}
PASSWORD=${PASSWORD:-Dev#12345}
OUT=${OUT:-/tmp/phase5}
mkdir -p "$OUT"

TOKEN=$(curl -sS -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"password\":\"$PASSWORD\"}" |
  python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["accessToken"])')

auth=(-H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json')

get() { curl -sS "${auth[@]}" "$BASE$1"; }
post() { curl -sS -X POST "${auth[@]}" -d "$2" "$BASE$1"; }

STAMP=$(date +%s)
NID="298010${STAMP: -8}"
PH="0101${STAMP: -7}"

post /merchants "{\"name\":\"محمد عبد الله\",\"phone\":\"$PH\",\"shopName\":\"سوبر ماركت النور\",\"address\":\"شارع الجمهورية، المنصورة\",\"nationalId\":\"$NID\",\"notes\":\"محل كبير\"}" > "$OUT/merchant-create.json"
MID=$(python3 -c 'import sys,json;print(json.load(open(sys.argv[1]))["data"]["id"])' "$OUT/merchant-create.json")

get "/merchants?limit=2" > "$OUT/merchants-list.json"
get "/merchants/$MID" > "$OUT/merchant-detail.json"
get "/merchants/$MID/timeline" > "$OUT/merchant-timeline.json"
post /merchants/check "{\"phone\":\"$PH\",\"nationalId\":\"$NID\"}" > "$OUT/merchant-check.json"
get "/payment-methods" > "$OUT/payment-methods.json"
get "/violation-types" > "$OUT/violation-types.json"

PM_ID=$(python3 -c 'import sys,json;print(json.load(open(sys.argv[1]))["data"][0]["id"])' "$OUT/payment-methods.json")
post "/merchants/$MID/subscriptions" "{\"planType\":\"MONTHLY\",\"amount\":500,\"startDate\":\"2026-09-01\"}" > "$OUT/subscription-create.json"
SUB_ID=$(python3 -c 'import sys,json;print(json.load(open(sys.argv[1]))["data"]["id"])' "$OUT/subscription-create.json")
NOW=$(python3 -c 'import datetime;print(datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00","Z"))')
post "/subscriptions/$SUB_ID/collect" "{\"amount\":500,\"collectedAt\":\"$NOW\",\"paymentMethodId\":\"$PM_ID\",\"notes\":\"تحصيل نقدي\"}" > "$OUT/subscription-collect.json"
get "/merchants/$MID/subscriptions" > "$OUT/subscriptions-list.json"
get "/merchants/$MID/timeline" > "$OUT/merchant-timeline.json"

TYPE_ID=$(python3 -c 'import sys,json;print(json.load(open(sys.argv[1]))["data"][0]["id"])' "$OUT/violation-types.json")
USER_ID=$(get /auth/me | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["id"])')

post /violations "{\"userId\":\"$USER_ID\",\"violationTypeId\":\"$TYPE_ID\",\"description\":\"تأخير في تسليم الماكينة\",\"severity\":\"MEDIUM\"}" > "$OUT/violation-create.json"
VID=$(python3 -c 'import sys,json;print(json.load(open(sys.argv[1]))["data"]["id"])' "$OUT/violation-create.json")
get "/violations?limit=2" > "$OUT/violations-list.json"
get "/violations/$VID" > "$OUT/violation-detail.json"
post "/violations/$VID/acknowledge" '{}' > "$OUT/violation-acknowledge.json"
post "/violations/$VID/charge" "{\"amount\":150,\"chargedAt\":\"$NOW\",\"paymentMethodId\":\"$PM_ID\",\"notes\":\"خصم من المستحقات\"}" > "$OUT/violation-charge.json"
get "/users/$USER_ID/violations/summary" > "$OUT/violation-summary.json"

echo "captured to $OUT"
ls -1 "$OUT"
