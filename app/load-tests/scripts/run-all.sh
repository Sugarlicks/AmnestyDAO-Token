#!/usr/bin/env bash
#
# Run all load test suites sequentially at a given TPS level.
# Usage: ./scripts/run-all.sh [TPS] [BASE_URL] [HASURA_URL]
#
# Example:
#   ./scripts/run-all.sh 10
#   ./scripts/run-all.sh 50 http://staging:4000 http://staging:8080

set -euo pipefail

TPS="${1:-10}"
BASE_URL="${2:-http://localhost:4000}"
HASURA_URL="${3:-http://localhost:8080}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_DIR="$(dirname "$0")/../results/${TIMESTAMP}_${TPS}tps"

mkdir -p "$RESULTS_DIR"

echo "============================================"
echo "  Amnesty DAO Load Test Suite"
echo "  Target TPS: ${TPS}"
echo "  Backend:    ${BASE_URL}"
echo "  Hasura:     ${HASURA_URL}"
echo "  Results:    ${RESULTS_DIR}"
echo "============================================"

export BASE_URL HASURA_URL

run_test() {
  local name="$1"
  local file="$2"
  local tps="${3:-$TPS}"

  echo ""
  echo ">>> Running: ${name} (target ${tps} TPS)"
  echo "-------------------------------------------"

  k6 run \
    --env TARGET_TPS="${tps}" \
    --env BASE_URL="${BASE_URL}" \
    --env HASURA_URL="${HASURA_URL}" \
    --summary-export="${RESULTS_DIR}/${name}.json" \
    --out "json=${RESULTS_DIR}/${name}_raw.json" \
    "${file}" \
    2>&1 | tee "${RESULTS_DIR}/${name}.log"

  echo ">>> ${name} complete"
  echo ""
}

# 1. Health check baseline
run_test "01_healthcheck" "tests/auth-endpoints.js" "$TPS"

# 2. GraphQL read queries
run_test "02_graphql_reads" "tests/graphql-queries.js" "$TPS"

# 3. Auth endpoints
run_test "03_auth" "tests/auth-endpoints.js" "$TPS"

echo ""
echo "============================================"
echo "  All tests complete"
echo "  Results in: ${RESULTS_DIR}"
echo "============================================"

# Generate summary
echo ""
echo "Test Summary:"
echo "-------------"
for f in "${RESULTS_DIR}"/*.json; do
  [ -f "$f" ] || continue
  name=$(basename "$f" .json)
  [[ "$name" == *_raw ]] && continue
  echo "  ${name}: $(cat "$f" | python3 -c "
import sys, json
d = json.load(sys.stdin)
metrics = d.get('metrics', {})
dur = metrics.get('http_req_duration', {})
fails = metrics.get('http_req_failed', {})
p95 = dur.get('values', {}).get('p(95)', 'N/A')
rate = fails.get('values', {}).get('rate', 'N/A')
print(f'p95={p95}ms, fail_rate={rate}')
" 2>/dev/null || echo "parsing failed")"
done
