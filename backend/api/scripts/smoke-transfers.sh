#!/usr/bin/env bash
# Drives a full hand-off against the running dev API, the way the app does:
# sign in, ask what may be created, pick a recipient, dispatch, then sign for it.
#
# Exists because the e2e suite runs against its own database. This one proves
# the dev stack the emulator actually talks to is wired up.
set -euo pipefail

API="${API:-http://localhost:3000/api/v1}"
# The seed-dev director, not the bootstrap one: it has must_change_password cleared
# and a password that survives whatever the emulator did to the bootstrap account.
PHONE="${PHONE:-01000000001}"
PASSWORD="${PASSWORD:-Dev#12345}"

# Reads a path out of a JSON response on stdin, e.g. `jqr '["data"]["id"]'`.
jqr() { python3 -c "import json,sys; print(json.load(sys.stdin)$1)"; }

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }

say "sign in as the director"
LOGIN=$(curl -sS -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo "$LOGIN" | jqr '["data"]["accessToken"]')
auth=(-H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json')
echo "  token acquired"

say "which hand-offs may the director start?"
TYPES=$(curl -sS "${auth[@]}" "$API/transfers/creatable-types")
echo "$TYPES" | python3 -c "
import json,sys
for entry in json.load(sys.stdin)['data']:
    print(f\"  {entry['type']:<32} receiver={entry['receiverKind']:<10} selfAttested={entry['selfAttested']}\")
"

say "who can receive a COMPANY_TO_BRANCH?"
RECIPIENTS=$(curl -sS "${auth[@]}" "$API/transfers/recipients?type=COMPANY_TO_BRANCH")
echo "$RECIPIENTS" | python3 -c "
import json,sys
data = json.load(sys.stdin)['data']
if not data:
    sys.exit('  no supervisors provisioned — run npm run seed:dev')
for entry in data:
    print(f\"  {entry['name']}  ({entry['subtitle']})\")
"
SUPERVISOR=$(echo "$RECIPIENTS" | jqr '["data"][0]["id"]')

say "find a machine sitting in the company warehouse"
MACHINES=$(curl -sS "${auth[@]}" "$API/machines?status=IN_COMPANY_WAREHOUSE&limit=1")
MACHINE=$(echo "$MACHINES" | jqr '["data"][0]["id"]')
SERIAL=$(echo "$MACHINES" | jqr '["data"][0]["serial"]')
echo "  $SERIAL"

say "dry run before anyone signs anything"
BODY="{\"clientUuid\":\"$(uuidgen | tr 'A-Z' 'a-z')\",\"type\":\"COMPANY_TO_BRANCH\",\"toPartyId\":\"$SUPERVISOR\",\"occurredAt\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",\"items\":[{\"machineId\":\"$MACHINE\",\"hasCharger\":true,\"hasBox\":false,\"condition\":\"GOOD\"}]}"
curl -sS "${auth[@]}" -X POST "$API/transfers/validate" -d "$BODY" | jqr '["data"]["valid"]' | sed 's/^/  valid=/'

say "dispatch it"
CREATED=$(curl -sS "${auth[@]}" -X POST "$API/transfers" -d "$BODY")
REF=$(echo "$CREATED" | jqr '["data"]["referenceNo"]')
TRANSFER=$(echo "$CREATED" | jqr '["data"]["id"]')
echo "  $REF"

say "the machine is nobody's until somebody signs"
curl -sS "${auth[@]}" "$API/machines/$MACHINE" | jqr '["data"]["status"]' | sed 's/^/  /'

say "it is now in the supervisor's inbox"
curl -sS "${auth[@]}" "$API/transfers/pending/outgoing?limit=1" | jqr '["meta"]["total"]' | sed 's/^/  outgoing pending: /'

say "cancel it again so the dev data is left as it was found"
curl -sS "${auth[@]}" -X POST "$API/transfers/$TRANSFER/cancel" -d '{"reason":"smoke test"}' \
  | jqr '["data"]["status"]' | sed 's/^/  /'

curl -sS "${auth[@]}" "$API/machines/$MACHINE" | jqr '["data"]["status"]' | sed 's/^/  machine back to: /'

say "done"
