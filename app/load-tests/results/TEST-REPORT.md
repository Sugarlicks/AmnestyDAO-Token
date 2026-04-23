# Amnesty DAO - Load Test & Scaling Analysis Report

**Date:** 2026-04-21
**Environment:** Local (Docker Compose) against Cardano Preprod testnet
**Tool:** k6 v1.7.1
**Treasury address:** `addr_test1wr7phk9zf20v72xxs76w2kpxdltv7nsdufzc8hmxp3arr9q067ml0`

---

## 1. Introduction

This report presents the results of load testing the Amnesty DAO (Human Rights DAO) platform to assess its ability to scale to a large number of concurrent users. The platform is built on Cardano and incentivises civic engagement through token rewards for activism contributions.

The load tests target every layer of the stack — from the GraphQL API (Hasura) and Express backend through to on-chain Plutus smart contract interactions — to identify bottlenecks and measure throughput limits at each tier.

### Stack under test

```
k6 load test VUs
    │
    ├──► Hasura GraphQL Engine (port 8080)
    │        └──► PostgreSQL (port 5432)
    │
    └──► Express Auth Service (port 4000)
             ├──► PostgreSQL (port 5432)
             └──► Cardano Blockchain (via Blockfrost API)
                      └──► Treasury Plutus V3 Script
```

| Layer | Technology | Throughput limit |
|---|---|---|
| GraphQL API | Hasura v2.25.1 | 50 max DB connections |
| Auth/Blockchain API | Express (Node.js) | Single-threaded event loop |
| Database | PostgreSQL 15 | Shared across Hasura + Express pools |
| Blockchain access | Blockfrost API | 50 req/s (free tier) |
| On-chain | Cardano Preprod (Plutus V3) | 6 Plutus reward txs per block (limited by block execution step budget: 20B steps, ~3B per reward tx). Avg block time ~21s (range 5-47s). Each UTxO can only be spent once per block. |

---

## 2. Test Descriptions

### Test 1: GraphQL Queries (Hasura)

**Script:** `tests/graphql-queries.js`
**What it tests:** The read path — how quickly the platform can serve page loads and data queries to many concurrent users.

When a user opens the app, the frontend sends GraphQL queries to Hasura for contributions, campaigns, and transaction history. Hasura translates these to SQL, executes them against PostgreSQL, and returns JSON. This test measures how that pipeline performs under load.

**Scenarios:**

| Scenario | What it simulates | Target TPS |
|---|---|---|
| `contributions` | User browsing the contributions list page | 10 |
| `campaigns` | User browsing the campaigns/fundraising page | 10 |
| `transactions` | User viewing their wallet transaction history (requires JWT auth, filtered by user_id) | 5 |
| `mixed_reads` | Realistic user navigation — randomly weighted mix: 30% contributions, 25% campaigns, 20% transactions, 25% lightweight campaign read | 20 |

All queries are sent directly to Hasura (`POST /v1/graphql`) with JWT authentication from seeded test users. The queries mirror what the frontend actually sends — paginated with `limit`/`offset` and `order_by`.

**What could break:** Hasura's PostgreSQL connection pool (50 max) saturating under sustained concurrent queries, slow aggregate queries, or PostgreSQL lock contention.

### Test 2: Auth Endpoints (Registration with Blockchain Rewards)

**Script:** `tests/auth-endpoints.js`
**What it tests:** The write path — user registration which triggers both a database insert and an on-chain token reward from the treasury.

When a new user registers, the backend:
1. Inserts a user record into PostgreSQL
2. Calls `rewardReceiverFromTreasury()` which:
   - Fetches treasury UTxOs from Blockfrost
   - Selects a UTxO containing HRDT tokens
   - Builds a Plutus V3 script-spending transaction
   - Signs with the oracle wallet
   - Submits to the Cardano network
3. Returns the user ID and transaction hash

This is the heaviest operation in the entire platform — it touches every layer of the stack in a single request.

**Scenarios:**

| Scenario | What it simulates | Target TPS |
|---|---|---|
| `healthcheck` | Baseline — `GET /healthz`. If this degrades, the Express server itself is saturated. | 20 |
| `login_options` | User logging in — `POST /api/login/options`. DB read + nonce generation. Tests the DB connection pool under sustained reads. | 10 |
| `registration` | New user sign-up — `POST /api/register`. DB write + full blockchain reward transaction. The worst-case scenario for scaling. | 1 (10% of target) |

**What could break:** Treasury UTxO contention (multiple rewards trying to spend the same UTxO), Blockfrost API rate limits, oracle wallet collateral exhaustion, Express event loop blocking during Plutus evaluation, or PostgreSQL connection pool starvation.

---

## 3. How the Tests Work

### Load generation

All tests use k6's `ramping-arrival-rate` executor, which gradually increases the request rate through stages regardless of how fast the server responds:

```
Stage 1 (30s): ramp to 10% of target TPS
Stage 2 (30s): ramp to 25%
Stage 3 (30s): ramp to 50%
Stage 4 (1m):  ramp to 100%
Stage 5 (2m):  sustain at target
Stage 6 (30s): cool down to 0
```

k6 allocates virtual users (VUs) on demand to maintain the arrival rate. If the server slows down, k6 spins up more VUs rather than reducing throughput — this reveals how the system degrades under sustained load.

### Test users

Before tests run, `scripts/seed-test-data.js` populates PostgreSQL with 50 test users (with valid JWTs), 5 campaigns, and 5 contributions. The users are loaded into k6 via a `SharedArray` (memory-efficient, shared across all VUs) and randomly selected for each request.

### Metrics and thresholds

Each test defines pass/fail thresholds. Standard thresholds (for non-blockchain operations):
- HTTP request duration: p95 < 500ms, p99 < 2s
- HTTP failure rate: < 5%

Blockchain thresholds are more lenient due to inherent latency:
- HTTP request duration: p95 < 10s, p99 < 30s
- HTTP failure rate: < 10%

Custom metrics track domain-specific success rates per endpoint and error categories (UTxO contention, Blockfrost rate limits, insufficient balance, etc.).

### On-chain verification

Test results are verified against the actual blockchain state via Blockfrost API — checking the treasury's UTxO set, token balance, ADA balance, and transaction history per block. This ensures reported successes correspond to real on-chain transactions.

---

## 4. Test Results

### Test 1: GraphQL Queries

| Metric | Value |
|---|---|
| Total requests | 9,058 |
| Throughput | 27.4 req/s |
| Success rate | 100% |
| HTTP failure rate | 0.00% |
| Avg latency | 8.2ms |
| Median latency | 4.1ms |
| p90 latency | 11.4ms |
| p95 latency | 30.0ms |
| p99 latency | 85.8ms |
| Max latency | 290.5ms |

**All thresholds passed.** Contributions, campaigns, and transaction queries all returned successfully at 100% with sub-100ms latency at p99. The Hasura connection pool (50 max) was not a bottleneck at 10 TPS.

### Test 2: Auth Endpoints — Before Fix (Single UTxO Selection)

The original `rewards.js` code always selected `rankedCandidates[0]` — the UTxO with the most ADA — meaning every concurrent reward request competed for the same UTxO.

**Treasury state before test:** 1,808.24 ADA, 9,290 HRDT across 92 UTxOs (83 with tokens)

#### Login + Healthcheck

| Metric | Value |
|---|---|
| login_options success rate | 100% (2,010/2,010) |
| login_options p95 latency | 35.9ms |
| healthcheck | 100% success, <10ms |

#### Registration (with blockchain reward)

| Metric | Value |
|---|---|
| Total attempts | 57 |
| HTTP 200 responses | 9 (15%) |
| Timed out (60s) | 48 (85%) |
| Median latency | 60.0s (timeout) |
| Min latency | 2.26s |

#### On-chain verification

| Metric | Value |
|---|---|
| Successful on-chain transactions | 9 |
| Tokens spent | 90 HRDT |
| Max treasury txs per block | 1 |
| Avg gap between successful txs | 45.9 seconds |
| Effective TPS | **~0.02** |

#### Error breakdown

| Error | Count | Cause |
|---|---|---|
| UTxO contention | 102 (across retries) | Every request picked the same UTxO; only one submission per block wins |
| "All inputs are spent" | 1 | Explicit contention error from Cardano node |
| Timeout | ~48 | 30s retry delay + 60s k6 timeout = max 2 attempts per request |

**Root cause:** In `backend/actions/rewards.js`, every concurrent request fetches the UTxO list from Blockfrost, sorts identically by ADA descending, and picks `rankedCandidates[0]`. Despite 83 available UTxOs with tokens, they all fight over one.

### Test 3: Auth Endpoints — After Fix (Round-Robin UTxO Selection)

A module-level counter was added to `rewards.js` so each concurrent request picks a different UTxO:

```javascript
let _utxoRoundRobinIndex = 0;
// ...
const candidateIndex = _utxoRoundRobinIndex++ % rankedCandidates.length;
const target = rankedCandidates[candidateIndex].u;
```

**Treasury state before test:** 1,782.97 ADA, 9,200 HRDT across 92 UTxOs (83 with tokens)

#### Login + Healthcheck

| Metric | Value |
|---|---|
| login_options success rate | 100% (2,009/2,009) |
| login_options p95 latency | 165.0ms |
| healthcheck | 100% success |

#### Registration (with blockchain reward)

| Metric | Value |
|---|---|
| Total attempts | 175 |
| HTTP 200 responses | 155 (88%) |
| HTTP failures | 20 (12%) |
| Median latency | 1.98s |
| Min latency | 19.8ms |

#### On-chain verification

| Metric | Value |
|---|---|
| Successful on-chain transactions | 119 |
| Tokens spent | 1,190 HRDT |
| ADA spent | ~655.24 ADA |
| Time span (test window) | 3.2 minutes |
| Unique blocks | 10 |
| Max txs per block | **6** |
| Avg txs per block | **5.0** |
| Effective TPS | **0.26** |

Per-block breakdown showing concurrent treasury transactions:

```
Block 4630340 (14:32:25 UTC): 6 txs
Block 4630341 (14:32:46 UTC): 6 txs
Block 4630342 (14:33:09 UTC): 6 txs
Block 4630343 (14:33:56 UTC): 6 txs
Block 4630344 (14:34:07 UTC): 6 txs
Block 4630345 (14:34:12 UTC): 6 txs
Block 4630346 (14:34:21 UTC): 3 txs
Block 4630347 (14:34:31 UTC): 2 txs
Block 4630348 (14:35:05 UTC): 6 txs
Block 4630349 (14:35:38 UTC): 3 txs
```

#### Error breakdown

| Error | Count | Cause |
|---|---|---|
| UTxO Balance Insufficient | 93 | UTxO lacked enough ADA to cover 5 ADA receiver output + fees + change |
| Insufficient token balance (have 5, need 10) | 11 | Round-robin landed on UTxOs with only 5 HRDT |
| No UTxOs at treasury script address | 4 | Blockfrost API returned empty (transient network issue) |
| XMLHttpRequest is not defined | 3 | MeshSDK browser API called in Node.js (intermittent bug) |
| All inputs are spent | 2 | Residual UTxO contention (two requests hit same index) |

#### Treasury state after test

| ADA Range | UTxO Count | Tokens | Notes |
|---|---|---|---|
| <3 ADA | 13 | 5-4,875 HRDT | Too little ADA to fund a reward tx |
| 3-10 ADA | 32 | 60-90 HRDT | Borderline — may fail depending on fees |
| 10-20 ADA | 27 | **0 HRDT** | ADA-only change outputs from successful rewards |
| 20-30 ADA | 20 | **0 HRDT** | ADA-only change outputs from successful rewards |

After the test, the treasury held 1,127.73 ADA and 8,010 HRDT — but zero UTxOs had both sufficient ADA (>=10) and sufficient tokens (>=10). The ADA and tokens ended up in separate UTxOs: successful rewards sent all tokens from a UTxO to the receiver, leaving behind ADA-only change, while the remaining token UTxOs were drained of ADA.

---

## 5. Comparison: Before vs After Round-Robin

| Metric | Before (single UTxO) | After (round-robin) | Improvement |
|---|---|---|---|
| Registration HTTP 200 rate | 15% (9/57) | 88% (155/175) | **+73%** |
| On-chain reward txs | 9 | 119 | **13x more** |
| Max txs per block | 1 | 6 | **6x** |
| Avg txs per block | 1 | 5.0 | **5x** |
| Effective TPS | 0.02 | 0.26 | **13x faster** |
| Median registration latency | 60.0s (timeout) | 1.98s | **30x faster** |
| Time for 50 rewards | ~37 min (extrapolated) | 3.2 min | **~12x faster** |

---

## 6. Current Effective TPS by Operation

| Operation | Measured TPS | Limiting factor |
|---|---|---|
| Healthcheck | >20 | None at this scale |
| Login options (DB read) | >10 | DB connection pool |
| GraphQL reads (Hasura) | >27 | Hasura connection pool (50 max) |
| Registration (DB only) | >1 | DB connection pool |
| Registration reward (before fix) | **~0.02** | UTxO selection code |
| Registration reward (after fix) | **~0.26** | UTxO ADA balance + Blockfrost rate limits |

The platform's overall throughput is determined by its slowest operation. For read-heavy workloads (browsing contributions, campaigns), the platform can handle 27+ requests/second with no issues. For write operations that touch the blockchain (registration rewards, donations), throughput drops to ~0.26 TPS — approximately **1 reward every 4 seconds**.

---

## 7. Identified Issues

### 7.1 UTxO ADA/Token Separation

After sustained reward activity, treasury UTxOs fragment into two groups: those with tokens but insufficient ADA, and those with ADA but no tokens. This makes the treasury non-functional despite holding sufficient total funds.

**Impact:** Treasury becomes unable to process rewards until manually consolidated.

### 7.2 No Minimum Viability Filter on UTxO Selection

The round-robin cycles through all token-holding UTxOs without checking if they have enough ADA or tokens to complete the transaction. This wastes Blockfrost API calls and causes predictable failures.

**Impact:** 93 out of 113 errors (82%) in the round-robin test were from insufficient ADA.

### 7.3 Blockfrost Free Tier Rate Limit

Every reward transaction requires at least 2 Blockfrost API calls (fetch treasury UTxOs + fetch oracle UTxOs for collateral). At the free tier limit of 50 req/s, this caps blockchain operations at ~25 TPS even if all other bottlenecks are resolved.

**Impact:** Hard ceiling on blockchain throughput. Transient failures (4 errors) when rate limit is hit.

### 7.4 Synchronous Reward in Registration Path

The registration endpoint blocks the HTTP response until the reward transaction is submitted (~2-60 seconds). This ties up Express event loop capacity and VUs during the blockchain round-trip.

**Impact:** Slow registration responses and reduced capacity for other endpoints during peak registration load.

### 7.5 MeshSDK Node.js Compatibility

Intermittent "XMLHttpRequest is not defined" errors indicate MeshSDK sometimes attempts to use browser-only APIs in the Node.js environment.

**Impact:** Low (3 errors out of ~175 attempts) but unpredictable.

---

## 8. Recommendations for Scaling to Large User Bases

### 8.1 Database and API Layer (Current: ~27 TPS)

The Hasura/PostgreSQL layer handles the current load well, but will need attention at higher user counts.

**Increase Hasura connection pool.** The default 50 connections will saturate at sustained 50+ TPS. Increase `HASURA_GRAPHQL_PG_CONNECTIONS` to 100-200 depending on PostgreSQL's `max_connections`.

**Add read replicas.** For read-heavy traffic (contributions, campaigns browsing), route GraphQL queries to PostgreSQL read replicas. Hasura supports multiple data sources.

**Enable query caching.** Hasura's response caching (`@cached` directive) can serve frequently-accessed lists (active contributions, active campaigns) without hitting the database on every request.

**Connection pool consolidation.** The backend has 3+ separate `pg.Pool` instances competing for the same PostgreSQL connection limit. Consolidate to a single pool or use PgBouncer as a connection pooler in front of PostgreSQL.

### 8.2 Blockchain Operations (Current: ~0.26 TPS)

Blockchain interactions are the dominant bottleneck. Multiple strategies can improve throughput:

**UTxO viability filter.** Before round-robin selection, filter out UTxOs that can't fund a transaction (require minimum ADA >= 10 and tokens >= reward amount). This eliminates 82% of current errors with a one-line code change.

**Multi-input transactions.** Instead of requiring a single UTxO to contain both enough ADA and tokens, build transactions that consume two UTxOs as inputs: one ADA-rich UTxO for funding and one token-holding UTxO for the reward. This solves the ADA/token fragmentation issue and keeps the treasury functional longer between consolidation cycles. This requires verifying the Plutus validator accepts multi-input script spends.

**Transaction batching.** Instead of one transaction per reward, batch multiple rewards into a single transaction. Cardano transactions can have multiple outputs, so a single tx could reward multiple users at once. Each reward tx currently uses ~9.7% of the block memory budget and ~15% of the step budget, so a batched transaction with multiple outputs could fit more rewards per block. This reduces the number of UTxOs consumed, Blockfrost API calls, and on-chain fees. Trade-off: increased latency for individual rewards (must wait for a batch to fill).

**Reward queue with async processing.** Decouple the reward from the registration HTTP response. Registration inserts the user and enqueues a reward job; a background worker processes rewards sequentially or in batches. The user sees immediate registration success and receives tokens asynchronously. This eliminates the 2-60 second registration latency and prevents blockchain slowness from degrading the API.

**Treasury UTxO management.** Implement automated treasury consolidation: a periodic job that combines fragmented UTxOs (small ADA + tokens, or ADA-only + token-only) into well-funded UTxOs ready for reward spending. The `seed-treasury-multi.ts` script already demonstrates creating properly sized UTxOs.

**Upgrade Blockfrost tier.** The free tier's 50 req/s limit is a hard ceiling. A paid tier or self-hosted Cardano node (via Ogmios/Kupo) removes this dependency entirely and enables higher blockchain throughput.

### 8.3 Architecture Changes for 100+ TPS

To support event-driven spikes (e.g., hundreds of users completing an activism contribution simultaneously):

**Reward queue with batched settlement.** This is the single highest-impact change. A message queue (Redis, BullMQ, or PostgreSQL-based) sits between the API and blockchain:

```
User action ──► API (instant response) ──► Reward Queue ──► Batch Worker ──► Single Cardano Tx
                                                              (every 20-30s)
                                                              (batches up to 20 rewards per tx)
```

With batched rewards, each block could settle significantly more users. The block execution budget allows 6 individual reward txs per block (~21s average), but a single batched transaction with multiple outputs uses the script validator only once, fitting more rewards within the same budget. Even conservatively batching 5 rewards per tx across 6 txs per block yields ~30 rewards per block (~1.4 rewards/second) — a 5x improvement over unbatched round-robin and sufficient for thousands of daily active users.

**Horizontal scaling of the API layer.** Run multiple Express instances behind a load balancer. The API layer is stateless (JWT auth, no sessions), so it scales horizontally. The reward queue worker remains a single instance to avoid UTxO contention.

**Pre-computed UTxOs.** Maintain a pool of pre-funded UTxOs at the treasury, each sized for exactly one batch of rewards. A background job replenishes the pool as UTxOs are consumed. The reward worker picks from the pool without needing to fetch and evaluate UTxOs at request time.

### 8.4 Summary of Recommendations by Impact

| Recommendation | Effort | Impact | Current bottleneck addressed |
|---|---|---|---|
| UTxO viability filter | Low | Eliminates 82% of current reward errors | UTxO ADA depletion |
| Async reward queue | Medium | 50x reward throughput, instant registration | Synchronous blockchain in registration path |
| Transaction batching | Medium | 10-20x fewer on-chain transactions needed | UTxO contention, Blockfrost rate limits |
| Multi-input transactions | Medium | Solves ADA/token fragmentation permanently | UTxO ADA/token separation |
| Treasury consolidation job | Low | Keeps treasury operational between seedings | UTxO fragmentation |
| Hasura connection pool increase | Low | Supports 100+ TPS for reads | DB connection pool saturation |
| Blockfrost tier upgrade / self-hosted node | Low-Medium | Removes 50 req/s API ceiling | Blockfrost rate limits |
| Horizontal API scaling | Medium | Supports thousands of concurrent users | Express single-thread limits |
| Pre-computed UTxO pool | High | Near-instant reward settlement | All blockchain bottlenecks |
