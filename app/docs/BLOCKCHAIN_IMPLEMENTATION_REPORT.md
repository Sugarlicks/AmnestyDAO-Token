# Blockchain Implementation Security Report

**Date:** 2026-04-22
**Scope:** Security review of Cardano blockchain integration — oracle wallet, Plutus smart contract, transaction building, and key management (Task 5.4)

---

## 1. Architecture Overview

```
User Registration / Contribution Completion
    │
    ▼
Express Backend (index.js)
    │
    ├──► rewardReceiverFromTreasury() (rewards.js)
    │       │
    │       ├── Load oracle wallet from ORACLE_MNEMONIC (env var)
    │       ├── Fetch treasury UTxOs via Blockfrost API
    │       ├── Build Plutus V3 script-spending transaction
    │       ├── Sign with oracle wallet private key
    │       └── Submit via Blockfrost API
    │
    └──► Treasury Plutus V3 Script (oracle_rewards.ak)
            └── Validates: oracle signature present in tx.extra_signatories
```

The system has two key entities:
- **Oracle wallet** — a standard Cardano address derived from a BIP39 mnemonic, held server-side. Signs all reward and donation transactions.
- **Treasury script** — a Plutus V3 smart contract that holds HRDT tokens. Unlocked by transactions signed by the oracle.

---

## 2. Oracle Wallet Security

### Key storage

The oracle wallet mnemonic is stored as an environment variable (`ORACLE_MNEMONIC`) and loaded at runtime:

```javascript
// backend/actions/rewards.js:23
const oracleMnemonic = process.env.ORACLE_MNEMONIC;

// backend/actions/helpers.js:23-34
function getWallet(mnemonic) {
  return new MeshWallet({
    networkId: getNetworkId(),
    fetcher: provider,
    submitter: provider,
    key: { type: 'mnemonic', words: mnemonic.split(' ') },
  });
}
```

**Observations:**
- The mnemonic is loaded into memory on every transaction (no caching of derived keys)
- No hardware security module (HSM) or key management service (KMS) is used
- The mnemonic is never logged in application code
- The `.env` file containing the mnemonic is correctly gitignored and not committed to the repository
- A `.env.dev` file with pre-configured credentials exists for development convenience — this file IS committed and contains a funded oracle mnemonic for the preprod testnet

**Risk:** If the server is compromised, the attacker has full access to the oracle wallet and can drain the treasury. This is the standard risk for any server-side hot wallet. For a testnet/MVP deployment this is acceptable; for mainnet production, a multi-sig or HSM-backed solution would be required.

### Collateral management

The oracle wallet must maintain ADA-only UTxOs for Plutus script collateral:

```javascript
// backend/actions/rewards.js:183-201
collateral = await oracleWallet.getCollateral();
```

If collateral is unavailable, the transaction fails. There is no automated collateral replenishment — the oracle wallet must be manually funded. Diagnostic logging (`getWalletCollateralDiagnostics`) helps identify when collateral is depleted.

---

## 3. Plutus Validator Analysis

### Contract source

**File:** `AmnestyDAO-Token/smart-contracts/validators/rewards/oracle_rewards.ak`

```aiken
validator oracle_rewards {
  spend(_d: Option<Datum>, _r: Data, _o: OutputReference, tx: Transaction) {
    list.has(tx.extra_signatories, oracle_pkh())
  }
  else(_) {
    fail
  }
}
```

### What the validator checks

The validator has a single check: **the transaction must be signed by the oracle's public key hash** (`oracle_pkh()`). If the oracle's signature is present in `tx.extra_signatories`, the spend is authorised.

### What the validator does NOT check

| Check | Present | Impact |
|---|---|---|
| Oracle signature required | Yes | Prevents unauthorized spending |
| Datum validation | **No** — `_d` is ignored | Datum can be anything or missing |
| Redeemer validation | **No** — `_r` is ignored | Redeemer data (recipient, amount) is not enforced on-chain |
| Output amount matches redeemer | **No** | Oracle can send any amount to any address |
| Output recipient matches redeemer | **No** | Oracle can redirect funds |
| Minimum remaining balance | **No** | Oracle can drain entire UTxO |
| Token-only spending | **No** | Oracle can take ADA as well as tokens |

### Security implications

The validator is functionally equivalent to a simple signature check — it trusts the oracle completely. The redeemer value constructed in the backend:

```javascript
// backend/actions/rewards.js:167
const redeemerValue = mConStr(0, [
  deserializeAddress(receiverAddress).pubKeyHash,
  Number(amountToSend)
]);
```

This encodes the recipient and amount, but the on-chain validator never reads it. The redeemer serves only as metadata — it has no enforcement effect.

**This is a deliberate design choice, not a bug.** The oracle is a trusted entity (Amnesty DAO's own server), so the validator delegates all business logic to the off-chain code. This is a common pattern for centralised oracle-based Cardano dApps. However, it means:

1. **Oracle compromise = total fund loss.** If an attacker gains access to the oracle mnemonic, they can drain the entire treasury with no on-chain restriction.
2. **No on-chain audit trail of intended vs actual amounts.** The redeemer records the intent, but since it's not validated, a bug in the backend could send incorrect amounts without the validator catching it.
3. **No on-chain rate limiting.** The oracle can submit unlimited transactions per block (up to the execution budget).

### Recommendations for production

For a mainnet deployment with significant value:
- Add redeemer validation to the Plutus script (verify output amount matches redeemer amount, verify recipient matches redeemer recipient)
- Add a maximum per-transaction spend limit in the validator
- Consider multi-sig: require 2-of-3 oracle signatures from separate key holders
- Add datum validation to ensure the continuing UTxO maintains correct state

---

## 4. Transaction Building Security

### Reward transaction flow (rewards.js)

| Step | Code location | Validation | Issue |
|---|---|---|---|
| Receiver address | Line 100 | `assert(receiverAddress)` — existence only | No Bech32 format validation |
| Amount | Line 163-165 | `BigInt(amountToSend)`, checked against UTxO balance | No upper bound check |
| UTxO selection | Lines 136-157 | Round-robin across token-holding UTxOs | Correct after our fix |
| Redeemer construction | Line 167 | `deserializeAddress(receiverAddress).pubKeyHash` | Will throw on invalid address — no try-catch |
| Min ADA output | Line 185 | `Math.max(calculatedMinAda, 5_000_000)` | Correct — ensures receiver gets enough ADA |
| Collateral | Lines 183-219 | Multiple fallbacks with diagnostics | Correct |
| Signing | Line 253 | Oracle wallet signs | Correct |
| Submission | Line 254 | Blockfrost submits | Correct |

### Donation transaction flow (donate.js)

| Step | Code location | Validation | Issue |
|---|---|---|---|
| User address | Line 53 | Null check only | No format validation |
| Campaign ID | Line 46 | UUID format check | Correct |
| Amount | Line 47 | `> 0` check | No upper bound |
| UTxO fetching | Line 90 | Fetches user's UTxOs | Invalid address causes Blockfrost error |

### Input validation gaps

1. **No Cardano address format validation.** Addresses are passed directly to MeshSDK without checking Bech32 format. Invalid addresses cause exceptions deep in the MeshSDK stack rather than clean validation errors.

2. **No amount upper bounds.** While the blockchain will reject transactions that exceed available balance, there's no application-level check to prevent attempts with unreasonable amounts (e.g., `amount: 999999999999`).

3. **No transaction hash validation.** The `/api/tx/confirm` endpoint accepts any string as a transaction hash. Invalid formats are passed to `provider.onTxConfirmed()` which may behave unpredictably.

---

## 5. JWT Verification in Action Handlers

**Critical finding:** The three Hasura Action handlers use `jwt.decode()` instead of `jwt.verify()`:

| File | Line | Code |
|---|---|---|
| `actions/token.js` | 17 | `const decoded = jwt.decode(token)` |
| `actions/donate.js` | 17 | `const decoded = jwt.decode(token)` |
| `actions/admin.js` | 15 | `const decoded = jwt.decode(token)` |

`jwt.decode()` parses the JWT payload without verifying the signature. An attacker could craft a JWT with any `x-hasura-user-id` claim and it would be accepted.

**Mitigating factor:** These endpoints are called by Hasura as Action handlers. Hasura verifies the JWT before forwarding the request, so the JWT reaching these handlers has already been validated. However, if these endpoints are accessible directly (not through Hasura), the vulnerability is exploitable.

**Verification needed:** Check if the Express routes for `/actions/*` are accessible from the network or only from Hasura's internal Docker network.

**Recommendation:** Replace `jwt.decode()` with `jwt.verify(token, JWT_SECRET)` in all three files. Defense in depth — even if Hasura validates first, the action handlers should independently verify.

---

## 6. Blockfrost API Security

The Blockfrost API key is stored as an environment variable (`BLOCKFROST_KEY`) and used to initialise the MeshSDK provider:

```javascript
// backend/actions/helpers.js:14-17
const provider = new BlockfrostProvider(
  process.env.BLOCKFROST_KEY
);
```

**Observations:**
- The API key is never exposed to the frontend — all Blockfrost calls go through the backend
- The key is not logged in application code
- The free tier has a 50 req/s rate limit which acts as a natural throttle
- The `.env` file is gitignored; a `.env.dev` exists with a preprod testnet key for development

**Risk:** Low for testnet. For mainnet, use a paid Blockfrost tier or self-hosted Cardano node to avoid rate-limit DoS.

---

## 7. User Wallet Security

User wallets are **non-custodial** — the server never holds user private keys:

```javascript
// frontend/src/stores/auth.ts:186-191
const mnemonic = MeshWallet.brew(true);
await SecureStoragePlugin.set({ key: 'mnemonic', value: mnemonic });
```

- BIP39 mnemonic generated client-side via MeshSDK
- Stored in OS secure storage (Keychain on iOS, Keystore on Android, localStorage on web)
- Public key sent to backend during registration; private key stays on device
- Login uses CIP-8 signature challenge — user signs a nonce with their private key

**Web platform caveat:** On web (non-mobile), the mnemonic is stored in `localStorage` which is accessible to JavaScript. An XSS vulnerability could expose the mnemonic. Mobile platforms use hardware-backed secure storage.

---

## 8. Transaction Confirmation Race Condition

**File:** `backend/index.js:1140-1204`

The `/api/tx/confirm` endpoint has a TOCTOU (time-of-check-to-time-of-use) pattern:

```javascript
// 1. Wait for blockchain confirmation
await waitForTransaction(txHash);

// 2. Update database status (separate operation)
await db.query(
  `UPDATE token_transactions SET transaction_status = 'CONFIRMED' WHERE cardano_tx_hash = $1`,
  [txHash]
);
```

If two requests call `/api/tx/confirm` with the same `txHash` simultaneously, both could pass the blockchain check and attempt the database update. The database update is idempotent (setting CONFIRMED to CONFIRMED is harmless), so this is low risk in practice. However, the response could trigger duplicate client-side actions.

**Recommendation:** Add a database-level idempotency check: `WHERE cardano_tx_hash = $1 AND transaction_status != 'CONFIRMED'`.

---

## 9. Error Information Leakage

Several endpoints return raw error messages to clients:

| File | Line | Example |
|---|---|---|
| `actions/token.js` | 216 | `'Failed to reward user: ' + error.message` |
| `actions/donate.js` | 129, 247 | `'Failed to build transaction: ' + error.message` |
| `actions/admin.js` | 98 | `'Failed to get user transactions: ' + error.message` |

These can leak internal details about Blockfrost responses, wallet state, UTxO structures, and database errors. Clients should receive generic error messages; detailed errors should be logged server-side only.

---

## 10. Summary

| Finding | Severity | Category |
|---|---|---|
| Plutus validator ignores redeemer (oracle fully trusted) | **Design consideration** | Smart contract |
| `jwt.decode()` used instead of `jwt.verify()` in action handlers | **HIGH** | Authentication |
| No Cardano address format validation | **MEDIUM** | Input validation |
| No amount upper bound validation | **LOW** | Input validation |
| No transaction hash format validation | **LOW** | Input validation |
| Error messages leak internal details | **MEDIUM** | Information disclosure |
| Transaction confirmation race condition | **LOW** | Concurrency |
| Web mnemonic in localStorage (XSS exposure) | **MEDIUM** | Client-side key storage |
| Oracle mnemonic in server memory (no HSM) | **Design consideration** | Key management |
| `.env.dev` committed with testnet credentials | **LOW** | Credential management |
