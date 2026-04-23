# E2E Testing — Amnesty DAO

End-to-end test suite for the Human Rights DAO application using Playwright. Tests the complete user journey across admin and member roles, with real Cardano preprod testnet transactions.

## Prerequisites

- **Node.js 18+**
- **Docker & Docker Compose** (for backend services)

## Quick Start

The repo includes pre-configured `.env.dev` files with a funded oracle wallet, minted tokens, and a seeded treasury on the Cardano preprod testnet. No blockchain setup needed.

```bash
# 1. Set up backend
cd backend
cp .env.dev .env
docker compose up -d
cd hasura && hasura migrate apply --database-name default && hasura metadata apply
cd ../..

# 2. Set up frontend (separate terminal)
cd frontend
cp .env.dev .env
npm run dev

# 3. Run E2E tests
cd e2e
npm install
npx playwright install chromium
npx playwright test --headed
```

**Runtime: ~3.5 minutes** (blockchain confirmations take ~20-90 seconds each)

### What the tests do

| Step | Action | Blockchain |
|------|--------|------------|
| 1 | Register admin via UI | Real token reward from treasury |
| 2 | Admin creates contribution | — |
| 3 | Admin creates campaign | — |
| 4 | Admin creates chat channel | — |
| 5 | Register member via UI | Real token reward from treasury |
| 6 | Member completes contribution | Real Plutus script reward tx |
| 7 | Member donates to campaign | Real token transfer tx |
| 8 | Member sends chat message | — |

### Commands

```bash
npx playwright test                 # Headless
npx playwright test --headed        # Watch in browser
npx playwright test --debug         # Step-through debugger
npx playwright test --ui            # Playwright interactive UI
```

---

## Maintenance

The `.env.dev` credentials are for the Cardano preprod testnet (no real value). If the oracle runs out of ADA, the treasury runs out of tokens, or the Blockfrost API key stops working, follow the recovery steps below.

### Re-fund the Oracle Wallet

The oracle needs ADA for transaction fees and collateral. If tests fail with collateral errors:

1. Go to **https://docs.cardano.org/cardano-testnets/tools/faucet/**
2. Select **Preprod Testnet**
3. Paste the oracle address from `backend/.env.dev` (`ORACLE_ADDRESS`)
4. Request test ADA (you'll get ~1,000 tADA)

### Re-seed the Treasury

If tests fail with "UTxO Fully Depleted" or "All inputs are spent" repeatedly:

```bash
# 1. Check if oracle has enough tokens
# (if not, mint more first)
cd e2e
npx tsx setup/mint-tokens.ts

# 2. Create 20 fresh UTxOs at the treasury
npx tsx setup/seed-treasury-multi.ts

# 3. Rebuild auth-service to pick up any .env changes
cd ../backend
docker compose build --no-cache auth-service
docker compose up -d
```

Each treasury UTxO has 100 HRDT + 25 ADA. At ~15 tokens per test run, 20 UTxOs support ~130 test runs before needing to reseed.

### Get a New Blockfrost API Key

If the Blockfrost key is rate-limited or blocked:

1. Sign up at [blockfrost.io](https://blockfrost.io) (free tier)
2. Create a new project on the **Preprod** testnet
3. Update `BLOCKFROST_KEY` in both `backend/.env.dev` and `backend/.env`
4. Rebuild: `docker compose build --no-cache auth-service && docker compose up -d`

### Re-mint Tokens

If the oracle runs out of HRDT tokens:

```bash
cd e2e
npx tsx setup/mint-tokens.ts
# Then reseed the treasury:
npx tsx setup/seed-treasury-multi.ts
```

---

## Full Blockchain Setup (From Scratch)

Only needed if you want to create your own oracle, tokens, and treasury from scratch — for example, to use a different testnet or different token.

### Architecture

```
Oracle Wallet (MeshWallet)         Treasury Script (Plutus V3)
 ├─ Signs reward transactions       ├─ Holds HRDT tokens + ADA
 ├─ Holds ADA for collateral        ├─ Validates oracle signature
 └─ Mints tokens via native policy  └─ 20 UTxOs prevent contention
```

### Setup Steps

| Step | Script | What it does | Output |
|------|--------|-------------|--------|
| 1 | `generate-oracle.ts` | Creates oracle wallet (BIP39 mnemonic) | `ORACLE_MNEMONIC`, `ORACLE_ADDRESS` |
| 2 | *Manual* | Fund oracle via [preprod faucet](https://docs.cardano.org/cardano-testnets/tools/faucet/) | ~1000 test ADA |
| 3 | `mint-tokens.ts` | Mints 10,000 HRDT tokens to oracle | `POLICY_ID`, `TOKEN_NAME` |
| 4 | `compile-contract.ts` | Compiles Aiken validator, derives addresses | `SCRIPT_CBOR`, `TREASURY_SCRIPT_ADDRESS` |
| 5 | `seed-treasury-multi.ts` | Creates 20 UTxOs at treasury (100 tokens + 25 ADA each) | Funded treasury |

Or run all steps at once:

```bash
npx tsx e2e/setup/full-blockchain-setup.ts
```

**Prerequisite for Step 4:** The [Aiken](https://aiken-lang.org) compiler and the AmnestyDAO-Token repo at `../AmnestyDAO-Token`.

```bash
curl -sSfL https://install.aiken-lang.org | bash
source ~/.aiken/bin/env
aikup install
```

---

## Project Structure

```
e2e/
├── playwright.config.ts          # Playwright config (mobile viewport, serial mode)
├── helpers/
│   ├── env.ts                    # Loads backend/.env
│   ├── wallet.ts                 # MeshWallet creation + signing
│   ├── api.ts                    # REST + GraphQL API helpers
│   └── db.ts                     # Direct DB: status changes, reward confirmation polling
├── fixtures/
│   └── test-data.ts              # Test user, contribution, campaign, chat data
├── setup/
│   ├── generate-oracle.ts        # Generate oracle wallet
│   ├── mint-tokens.ts            # Mint HRDT tokens
│   ├── compile-contract.ts       # Compile Aiken contract
│   ├── seed-treasury.ts          # Seed treasury (single UTxO)
│   ├── seed-treasury-multi.ts    # Seed treasury (20 UTxOs — recommended)
│   ├── full-blockchain-setup.ts  # All-in-one pipeline
│   └── run-e2e.sh                # Helper script to start services + run tests
└── tests/
    └── full-flow.spec.ts         # 8-step serial test
```

## Troubleshooting

### Docker auth-service keeps crashing

Check logs: `cd backend && docker compose logs auth-service`

Common causes:
- Missing `.env` file → `cp .env.dev .env`
- Firebase crash → `firebase-admin.js` skips gracefully when credentials are empty

### Tests fail with "Registration failed"

The frontend dev server must be running and pointing to `localhost:4000` (not production). Make sure you copied `frontend/.env.dev` to `frontend/.env` and ran `npm run dev` (NOT a production build).

### "All inputs are spent" or UTxO contention

Two reward transactions tried to spend the same treasury UTxO. The backend retries automatically (3 attempts, 30s delay). If it persists, reseed the treasury with more UTxOs:

```bash
cd e2e && npx tsx setup/seed-treasury-multi.ts
```

### "UTxO Fully Depleted"

The selected treasury UTxO doesn't have enough ADA. Reseed with `seed-treasury-multi.ts` (creates UTxOs with 25 ADA each).

### Oracle runs out of collateral

Send more ADA from the [preprod faucet](https://docs.cardano.org/cardano-testnets/tools/faucet/) to the oracle address.

### Blockfrost rate limited

Create a new free API key at [blockfrost.io](https://blockfrost.io) for the Preprod network and update `BLOCKFROST_KEY` in `backend/.env`.

## Cardano Protocol Changes

These tests run against the Cardano Preprod testnet and depend on MeshSDK (`@meshsdk/core`) for wallet operations and transaction building. When the Cardano network undergoes protocol parameter changes or hard forks (e.g. Conway era upgrades), the Preprod testnet is typically updated first as a testing ground.

Protocol changes can cause test failures if MeshSDK has not yet been updated to support the new parameters. Symptoms include transaction building errors, Plutus evaluation failures, or wallet initialisation issues that were not present before the protocol change.

If tests begin failing after a known protocol update:

1. Check the [Cardano updates page](https://docs.cardano.org/about-cardano/evolution/upgrades/) for recent or upcoming hard forks
2. Check the [MeshSDK releases](https://github.com/MeshJS/mesh/releases) for a compatible update
3. Update `@meshsdk/core` in both `backend/package.json` and `frontend/package.json` to the latest version
4. Re-run `npm install` and verify E2E tests pass

Tests should be considered valid at the time of execution. Future protocol changes may require MeshSDK updates before tests can pass again.
