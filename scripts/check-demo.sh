#!/usr/bin/env bash
# Checks a running FalconEye hosted demo from the outside, the way a browser and the
# dashboard would use it. Read-only: it sends GET requests and one rejected POST, nothing else.
#
#   scripts/check-demo.sh <backend-url> [dashboard-origin]
#
#   scripts/check-demo.sh https://falconeye-demo.onrender.com https://falconeye.vercel.app
#   scripts/check-demo.sh http://localhost:10000 http://localhost:5173
#
# With a dashboard origin it also checks CORS for that exact origin. WAIT_SECONDS (default
# 120) is how long to wait for a cold start (a sleeping free-tier service takes a while).
# Needs curl. Exits non-zero if any check fails.

set -uo pipefail

BASE="${1:?usage: check-demo.sh <backend-url> [dashboard-origin]}"
BASE="${BASE%/}"
ORIGIN="${2:-}"
ORIGIN="${ORIGIN%/}"
WAIT="${WAIT_SECONDS:-120}"

passed=0
failed=0
ok()  { echo "PASS  $1"; passed=$((passed + 1)); }
bad() { echo "FAIL  $1${2:+  ($2)}"; failed=$((failed + 1)); }
check() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "got '$2', expected '$3'"; fi; }
http() { curl -s -m 10 -o /dev/null -w '%{http_code}' "$@" 2>/dev/null || echo 000; }
# The server pretty-prints its JSON, so squash whitespace before picking the number out.
count() { curl -s -m 10 "$BASE/api/metrics" | tr -d ' \n\r' | sed -n 's/.*"requestCount":\([0-9]*\).*/\1/p'; }

# 1. The service answers (waiting out a cold start).
up=0
end=$((SECONDS + WAIT))
while [ "$SECONDS" -lt "$end" ]; do
    [ "$(http "$BASE/healthz")" = "200" ] && { up=1; break; }
    sleep 2
done
if [ "$up" != 1 ]; then
    bad "service answers /healthz within ${WAIT}s" "is the URL right, and is the service running?"
    echo; echo "RESULT: $passed passed, $failed failed"; exit 1
fi
ok "service answers /healthz"

# 2. The backend is up behind the front door.
check "/api/health reaches the server" "$(http "$BASE/api/health")" "200"

# 3. Metrics are real and keep growing (the traffic generator is running).
first=""
end=$((SECONDS + 60))
while [ "$SECONDS" -lt "$end" ] && [ -z "$first" ]; do
    first="$(count)"
    [ -z "$first" ] && sleep 2
done
if [ -z "$first" ]; then
    bad "/api/metrics returns a requestCount"
else
    ok "/api/metrics returns a requestCount ($first)"
    sleep 4
    second="$(count)"
    if [ -n "$second" ] && [ "$second" -gt "$first" ]; then
        ok "requestCount keeps growing ($first -> $second)"
    else
        bad "requestCount keeps growing" "went from $first to ${second:-nothing}"
    fi
fi

body="$(curl -s -m 10 "$BASE/api/metrics")"
for field in route method status totalMs timestamp breakdown; do
    case "$body" in
        *"\"$field\""*) ok "recent requests carry \"$field\"" ;;
        *) bad "recent requests carry \"$field\"" ;;
    esac
done

# 4. Only the allowlisted routes get through.
check "/api/todos/1 is not exposed" "$(http "$BASE/api/todos/1")" "404"
check "POST /api/metrics is refused" "$(http -X POST "$BASE/api/metrics")" "404"

# 5. CORS for the dashboard origin, and only for it.
if [ -n "$ORIGIN" ]; then
    allow="$(curl -s -m 10 -o /dev/null -D - -H "Origin: $ORIGIN" "$BASE/api/metrics" \
        | tr -d '\r' | sed -n 's/^[Aa]ccess-[Cc]ontrol-[Aa]llow-[Oo]rigin: //p')"
    check "CORS allows $ORIGIN" "$allow" "$ORIGIN"

    other="$(curl -s -m 10 -o /dev/null -D - -H "Origin: https://not-allowed.example" "$BASE/api/metrics" \
        | tr -d '\r' | sed -n 's/^[Aa]ccess-[Cc]ontrol-[Aa]llow-[Oo]rigin: //p')"
    check "CORS refuses another origin" "$other" ""
fi

echo
echo "RESULT: $passed passed, $failed failed"
[ "$failed" -eq 0 ]
