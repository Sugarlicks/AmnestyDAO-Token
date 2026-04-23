#!/usr/bin/env bash
#
# Run a specific test suite at escalating TPS levels: 1 → 10 → 25 → 50 → 100
# This helps find the exact TPS threshold where each component breaks down.
#
# Usage: ./scripts/run-ramp.sh <test-file> [BASE_URL] [HASURA_URL]
#
# Example:
#   ./scripts/run-ramp.sh tests/graphql-queries.js
#   ./scripts/run-ramp.sh tests/reward-flow.js http://staging:4000

set -euo pipefail

TEST_FILE="${1:?Usage: run-ramp.sh <test-file> [BASE_URL] [HASURA_URL]}"
BASE_URL="${2:-http://localhost:4000}"
HASURA_URL="${3:-http://localhost:8080}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEST_NAME=$(basename "$TEST_FILE" .js)
RESULTS_DIR="$(dirname "$0")/../results/ramp_${TEST_NAME}_${TIMESTAMP}"

mkdir -p "$RESULTS_DIR"

TPS_LEVELS=(1 10 25 50 100)

echo "============================================"
echo "  TPS Ramp Test: ${TEST_NAME}"
echo "  Levels: ${TPS_LEVELS[*]}"
echo "  Backend: ${BASE_URL}"
echo "  Hasura:  ${HASURA_URL}"
echo "  Results: ${RESULTS_DIR}"
echo "============================================"

for tps in "${TPS_LEVELS[@]}"; do
  echo ""
  echo ">>> TPS Level: ${tps}"
  echo "-------------------------------------------"

  k6 run \
    --env TARGET_TPS="${tps}" \
    --env BASE_URL="${BASE_URL}" \
    --env HASURA_URL="${HASURA_URL}" \
    --summary-export="${RESULTS_DIR}/${tps}tps.json" \
    --out "json=${RESULTS_DIR}/${tps}tps_raw.json" \
    "${TEST_FILE}" \
    2>&1 | tee "${RESULTS_DIR}/${tps}tps.log"

  echo ">>> ${tps} TPS complete"

  # Brief cooldown between levels to let connections drain
  if [ "$tps" -ne "${TPS_LEVELS[-1]}" ]; then
    echo ">>> Cooling down 30s before next level..."
    sleep 30
  fi
done

echo ""
echo "============================================"
echo "  Ramp test complete: ${TEST_NAME}"
echo "  Results: ${RESULTS_DIR}"
echo "============================================"

# Generate comparison table
echo ""
echo "TPS Ramp Summary for ${TEST_NAME}:"
echo "-----------------------------------"
printf "%-6s | %-12s | %-12s | %-10s\n" "TPS" "p95 (ms)" "p99 (ms)" "Fail Rate"
printf "%-6s-+-%-12s-+-%-12s-+-%-10s\n" "------" "------------" "------------" "----------"

for tps in "${TPS_LEVELS[@]}"; do
  f="${RESULTS_DIR}/${tps}tps.json"
  [ -f "$f" ] || continue
  printf "%-6s | " "$tps"
  python3 -c "
import sys, json
d = json.load(open('$f'))
m = d.get('metrics', {})
dur = m.get('http_req_duration', {}).get('values', {})
fails = m.get('http_req_failed', {}).get('values', {})
p95 = dur.get('p(95)', 'N/A')
p99 = dur.get('p(99)', 'N/A')
rate = fails.get('rate', 'N/A')
if isinstance(p95, float): p95 = f'{p95:.1f}'
if isinstance(p99, float): p99 = f'{p99:.1f}'
if isinstance(rate, float): rate = f'{rate:.4f}'
print(f'{p95:<12} | {p99:<12} | {rate}')
" 2>/dev/null || echo "N/A          | N/A          | N/A"
done
