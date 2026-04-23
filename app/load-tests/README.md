# Amnesty DAO - Load Testing Suite

Load testing infrastructure for scaling analysis, targeting 10 transactions per second (TPS).

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) installed (`brew install k6`)
- Node.js 18+ (for seeding scripts)
- Backend services running (`cd backend && docker compose up -d`)
- Database migrated (`cd backend/hasura && hasura migrate apply --database-name default && hasura metadata apply`)

## Blockchain Prerequisites

The auth test's registration scenario sends blockchain rewards from the treasury. This requires a funded oracle wallet and seeded treasury. See [`e2e/README.md`](../e2e/README.md) for the full blockchain setup guide, or use the all-in-one script:

```bash
cd e2e && npx ts-node setup/full-blockchain-setup.ts
```

### Oracle wallet

The oracle wallet signs reward transactions and provides collateral for Plutus script evaluation.

| Requirement | Minimum | Notes |
|---|---|---|
| ADA balance | ~50 ADA | Covers transaction fees + collateral across many rewards |
| ADA-only UTxOs | At least 1 | Required for Plutus collateral (no tokens, just ADA) |
| Collateral UTxO size | >= 5 ADA | 150% of max tx fee |

Configured via `ORACLE_MNEMONIC` and `ORACLE_ADDRESS` in `backend/.env`. Generate with [`e2e/setup/generate-oracle.ts`](../e2e/setup/generate-oracle.ts), then fund via the [Cardano testnet faucet](https://docs.cardano.org/cardano-testnets/tools/faucet/).

### Treasury

The treasury is a Plutus V3 script address that holds HRDT tokens for rewards. Each reward consumes one UTxO, so **the number of UTxOs determines how many concurrent rewards can process per block**.

| Requirement | Minimum | Recommended for load testing |
|---|---|---|
| UTxOs | 1 | 20+ (each can be spent independently per block) |
| ADA per UTxO | >= 10 ADA | >= 25 ADA (covers 5 ADA receiver output + fees + change) |
| HRDT per UTxO | >= 10 | >= 100 (supports 10 rewards before depletion) |
| Total HRDT | Depends on test | 2,000+ for a full load test run |

Seed options:
- **Single UTxO:** [`e2e/setup/seed-treasury.ts`](../e2e/setup/seed-treasury.ts) — creates 1 UTxO with 5,000 tokens + 50 ADA
- **Multi UTxO (recommended):** [`e2e/setup/seed-treasury-multi.ts`](../e2e/setup/seed-treasury-multi.ts) — creates 20 UTxOs, each with 100 tokens + 25 ADA

For load testing, use the multi-UTxO seeder to avoid contention. After a test run depletes UTxOs (tokens spent or ADA drained), re-run the seeder to replenish.

## Quick Start

```bash
# 1. Install seeding dependencies
npm install

# 2. Configure environment
cp ../backend/.env .env
# Or set manually: DATABASE_URL, JWT_SECRET

# 3. Seed test data (creates 50 users, 5 campaigns, 5 contributions)
npm run seed

# 4. Run all tests at 10 TPS
npm run test:all
# Or directly:
./scripts/run-all.sh 10
```

## Test Suites

| Suite | File | What it tests | Key bottleneck measured |
|-------|------|---------------|------------------------|
| Auth Endpoints | `tests/auth-endpoints.js` | `/api/login/options`, `/api/register`, `/healthz` | DB connection pool, blockchain reward on register, treasury UTxO contention |
| GraphQL Queries | `tests/graphql-queries.js` | Contributions, campaigns, transactions via Hasura | Hasura connection pool (50 max), query complexity |

## Running Individual Tests

```bash
# Run a single suite at a specific TPS
k6 run --env TARGET_TPS=25 tests/graphql-queries.js

# Run against a remote server
k6 run --env TARGET_TPS=10 --env BASE_URL=https://hrdao.matou.nz:4000 --env HASURA_URL=https://hrdao.matou.nz:8080 tests/graphql-queries.js
```

## TPS Ramp Test

Runs a single test suite at escalating TPS levels (1 → 10 → 25 → 50 → 100) to find the exact breakdown threshold:

```bash
# Ramp GraphQL reads from 1 to 100 TPS
./scripts/run-ramp.sh tests/graphql-queries.js

# Ramp auth endpoints
./scripts/run-ramp.sh tests/auth-endpoints.js
```

Output includes a comparison table showing p95/p99 latency and failure rate at each level.

## Test Data Seeding

```bash
# Default: 50 users, 5 campaigns, 5 contributions
npm run seed

# Custom amounts
node scripts/seed-test-data.js --users 200 --campaigns 10 --contributions 50

# Clean up load test data
npm run seed:cleanup
```

Seeded data is written to `results/test-users.json`. JWT tokens expire after 24 hours — re-run the seed script to refresh them.

## Results

All test results are saved to `results/` with timestamps:

```
results/
  test-users.json              # Seeded test user credentials
  TEST-REPORT.md               # Full test results and analysis
  20260417_143000_10tps/       # Full suite run at 10 TPS
    01_healthcheck.json        # k6 summary export
    01_healthcheck.log         # Full console output
    01_healthcheck_raw.json    # Raw k6 metrics (for graphing)
    ...
  ramp_graphql-queries_20260417/  # TPS ramp results
    1tps.json
    10tps.json
    25tps.json
    ...
```

## Custom Metrics

Beyond standard k6 HTTP metrics, each suite tracks domain-specific metrics:

### Auth Endpoints
- `login_options_success` / `login_options_duration` — Login endpoint success rate and latency
- `register_success` / `register_duration` — Registration success rate and latency (includes blockchain reward)
- `db_query_errors` — 5xx responses indicating DB issues

### GraphQL Queries
- `graphql_query_duration` — Hasura query latency
- `contributions_query_success` / `campaigns_query_success` / `transactions_query_success` — Per-query success rates
- `hasura_errors` — 5xx responses from Hasura

## Architecture Notes

The tests are designed to measure these specific scaling constraints:

1. **Hasura DB pool** (50 max connections) — saturates at ~10 TPS sustained
2. **Blockfrost API** (50 req/sec free tier) — hard ceiling for blockchain operations
3. **Treasury UTxO contention** — multiple concurrent rewards competing for the same UTxOs
4. **Connection pool fragmentation** — 3+ separate pg.Pool instances in backend

## Cardano Protocol Changes

The auth endpoint tests (registration rewards) interact with the Cardano Preprod testnet via MeshSDK (`@meshsdk/core`). When Cardano undergoes protocol parameter changes or hard forks, the Preprod testnet is updated first as a testing ground. These changes can cause blockchain-related test failures (transaction building errors, Plutus evaluation failures) if MeshSDK has not yet been updated to support the new parameters.

If blockchain tests begin failing after a known protocol update:

1. Check the [Cardano updates page](https://docs.cardano.org/about-cardano/evolution/upgrades/) for recent hard forks
2. Check the [MeshSDK releases](https://github.com/MeshJS/mesh/releases) for a compatible update
3. Update `@meshsdk/core` in `backend/package.json` and re-run `npm install`
4. Re-seed the treasury if needed (`e2e/setup/seed-treasury-multi.ts`)

GraphQL query tests are unaffected by protocol changes as they do not interact with the blockchain.

Test results should be considered valid at the time of execution. Future protocol changes may require MeshSDK updates before blockchain tests can pass again.
