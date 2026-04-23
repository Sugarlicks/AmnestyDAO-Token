# Token Flow & Transaction Limitations

This document details the movement of HRDT tokens and ADA between the oracle, treasury, and members during the setup process and the full user lifecycle, including fees, minimum ADA requirements, and system limitations.

---

## Cardano Transaction Cost Components

Every Cardano transaction that involves tokens requires three cost components. Understanding these is essential to understanding the token flows below.

### Min UTxO (Minimum ADA per output)

Cardano requires every UTxO (unspent transaction output) to contain a minimum amount of ADA. You cannot create an output with only tokens — it must also include ADA. This is the "postage" cost of storing data on the blockchain.

The minimum varies by output size (~1-2 ADA for a single token type). Every output in a transaction must satisfy this rule — both the recipient's output AND the sender's change output.

**Example:** To send 5 tokens to someone, the transaction creates:
- Output to recipient: 5 tokens + ~1.5 ADA (min UTxO)
- Change back to sender: remaining tokens + ~1.5 ADA (min UTxO)

The sender needs enough ADA to cover **both** outputs.

### Transaction Fee

A fee paid to the Cardano network for processing the transaction. This ADA is burned permanently. The fee is determined by:

| Factor | Impact |
|---|---|
| Transaction size (bytes) | More inputs/outputs = higher fee |
| Plutus script execution | CPU + memory cost of running the validator |
| Base fee | Fixed minimum (~0.15 ADA) |

Simple token transfers cost ~0.17 ADA. Plutus script transactions cost ~0.81 ADA due to the script execution overhead.

### Collateral (Plutus transactions only)

When a transaction executes a Plutus smart contract, the sender must provide a **collateral UTxO** — an ADA-only UTxO (no tokens) that serves as insurance. If the script fails during execution, the network claims the collateral to compensate for wasted processing.

| | Details |
|---|---|
| When needed | Only for Plutus script transactions (rewards), not simple transfers (donations) |
| Amount | Must be an ADA-only UTxO (typically 5-10 ADA) |
| Returned? | **Yes** — always returned after successful execution |
| Lost? | Only if the script fails (should never happen in normal operation) |
| Locked during tx | Yes — the collateral UTxO cannot be used by another transaction until confirmation (~20-40 seconds) |

### Summary

| Component | Who pays | Amount | Permanent? |
|---|---|---|---|
| Min UTxO (per output) | Transaction sender | ~1-2 ADA each | No — ADA stays with the output, can be spent later |
| Transaction fee | Transaction sender | 0.17-0.81 ADA | Yes — burned by the network |
| Collateral | Oracle (for rewards) | ~5-10 ADA | No — returned after confirmation |

---

## 1. Setup: Oracle → Treasury

### 1.1 Token Minting

The oracle mints HRDT tokens using a native minting policy tied to its signing key.

```
Oracle Wallet                              Oracle Wallet
┌──────────────┐    Mint 10,000 HRDT      ┌──────────────┐
│ 10,000 ADA   │  ───────────────────►    │  9,999 ADA   │
│     0 HRDT   │    Fee: ~0.17 ADA        │ 10,000 HRDT  │
└──────────────┘                          └──────────────┘
```

| | ADA | HRDT |
|---|---|---|
| Before | 10,000.00 | 0 |
| Fee burned | -0.17 | — |
| Minted | — | +10,000 |
| After | 9,999.83 | 10,000 |

### 1.2 Treasury Seeding (Multi-UTxO)

The oracle sends tokens + ADA to the treasury script address, creating 20 separate UTxOs to prevent contention.

```
Oracle Wallet                              Treasury Script
┌──────────────┐    20 × (100 HRDT       ┌──────────────────────┐
│  9,999 ADA   │       + 25 ADA)         │ UTxO 1: 25 ADA + 100 │
│ 10,000 HRDT  │  ───────────────────►   │ UTxO 2: 25 ADA + 100 │
└──────────────┘    Fee: ~0.20 ADA        │ ...                   │
                                          │ UTxO 20: 25 ADA + 100│
Oracle After:                             └──────────────────────┘
  9,499 ADA + 8,000 HRDT                  500 ADA + 2,000 HRDT
```

| | ADA | HRDT |
|---|---|---|
| Oracle sends | -500.00 | -2,000 |
| Fee burned | -0.20 | — |
| Treasury receives | +500.00 | +2,000 |
| Per UTxO | 25.00 | 100 |

> **Note:** The number of treasury UTxOs determines the maximum number of **simultaneous reward transactions** that can be processed. Each reward consumes one UTxO; a second reward targeting the same UTxO will fail with "All inputs are spent". With 20 UTxOs, up to 20 rewards can be in-flight at once.

### 1.3 Collateral UTxOs

The oracle needs ADA-only UTxOs (no tokens) for Plutus script execution collateral. Each reward transaction locks one collateral UTxO until it confirms (~20-40 seconds). Multiple collateral UTxOs are created by sending ADA to the oracle's own address:

```
Fee: ~0.20 ADA
Result: 20 × 10 ADA UTxOs (ADA-only) available for collateral
```

> **Note:** The number of oracle collateral UTxOs is **also a concurrency limit**. Each Plutus reward transaction locks one collateral UTxO during processing. With 1 collateral UTxO, rewards are serial (one at a time). With 20 collateral UTxOs, up to 20 rewards can process concurrently — matching the treasury UTxO capacity. **Both limits must be matched for maximum throughput.**

---

## 2. User Lifecycle: Registration → Reward → Donation

### 2.1 Registration Reward

When a user registers, the backend calls `rewardReceiverFromTreasury()` which spends a treasury UTxO via the Plutus script. The oracle signs the transaction to authorize the withdrawal.

```
Treasury                Oracle              New User
┌────────────┐     ┌────────────┐     ┌────────────┐
│ 25 ADA     │     │ Collateral │     │  0 ADA     │
│ 100 HRDT   │     │  ~9 ADA    │     │  0 HRDT    │
└─────┬──────┘     └─────┬──────┘     └────────────┘
      │                  │
      └──────┬───────────┘
             │ Plutus Script Tx
             │ Fee: 0.81 ADA
             ▼
┌────────────┐     ┌────────────┐     ┌────────────┐
│ 22.19 ADA  │     │  ~8 ADA    │     │  2.00 ADA  │
│ 90 HRDT    │     │ (returned) │     │ 10 HRDT    │
└────────────┘     └────────────┘     └────────────┘
Treasury Change     Oracle Change      User Wallet
```

| Party | ADA Change | HRDT Change | Notes |
|---|---|---|---|
| Treasury | -2.81 | -10 | Sends 2 ADA + 10 tokens to user, 0.81 to fees |
| Oracle | ~0 | 0 | Collateral returned minus small fee share |
| User | +2.00 | +10 | Receives reward |
| Network | +0.81 | 0 | Fee burned |

> **Why does a token reward include ADA?** Cardano requires every UTxO to contain a minimum amount of ADA alongside any tokens (the "min UTxO" rule). You cannot send tokens without also including ADA. The protocol-calculated minimum is ~1.5 ADA, but we enforce a 2 ADA minimum (set in `rewards.js`) so that members accumulate enough ADA across registration + contribution rewards (~4 ADA total) to cover the cost of a donation transaction (~3.4 ADA).

### 2.2 Contribution Reward

Same transaction structure as registration reward. The member completes a contribution and receives tokens from the treasury.

```
Treasury                Oracle              Member
┌────────────┐     ┌────────────┐     ┌────────────┐
│ 25 ADA     │     │ Collateral │     │  2.00 ADA  │
│ 100 HRDT   │     │  ~9 ADA    │     │ 10 HRDT    │
└─────┬──────┘     └─────┬──────┘     └────────────┘
      │                  │              (from registration)
      └──────┬───────────┘
             │ Plutus Script Tx
             │ Fee: 0.81 ADA
             ▼
┌────────────┐     ┌────────────┐     ┌────────────┐
│ 22.19 ADA  │     │  ~8 ADA    │     │  4.00 ADA  │
│ 95 HRDT    │     │ (returned) │     │ 15 HRDT    │
└────────────┘     └────────────┘     └────────────┘
Treasury Change     Oracle Change      Member Wallet
```

| Party | ADA Change | HRDT Change | Notes |
|---|---|---|---|
| Treasury | -2.81 | -5 | Sends 2 ADA + 5 tokens to member |
| Oracle | ~0 | 0 | Collateral returned |
| Member | +2.00 | +5 | Now has ~4 ADA + 15 HRDT (enough for donation) |
| Network | +0.81 | 0 | Fee burned |

> **Why does the member need ~4 ADA before donating?** A donation transaction creates two token outputs (treasury + member change), each requiring ~1.5 ADA min UTxO, plus ~0.17 ADA in fees — totalling ~3.4 ADA. The 2 ADA from registration + 2 ADA from contribution = 4 ADA provides just enough with a small buffer.

### 2.3 Campaign Donation

The member sends tokens to the treasury. This is a **simple transaction** (no Plutus script execution), so the fee is much lower.

```
Member Wallet                             Treasury
┌────────────┐                           ┌────────────┐
│  4.00 ADA  │     5 HRDT + 1.02 ADA    │ +1.02 ADA  │
│ 15 HRDT    │  ──────────────────────►  │ +5 HRDT    │
└─────┬──────┘     Fee: 0.17 ADA         └────────────┘
      │          (from 2.1 + 2.2)
      ▼
┌────────────┐
│  2.81 ADA  │
│ 10 HRDT    │
└────────────┘
Member Wallet
  (final)
```

| Party | ADA Change | HRDT Change | Wallet Total After |
|---|---|---|---|
| Member | -1.19 | -5 | **2.81 ADA + 10 HRDT** |
| Treasury | +1.02 | +5 | — |
| Network | +0.17 | 0 | — |

> The member started with 4.00 ADA + 15 HRDT (accumulated from registration + contribution rewards). After donating 5 HRDT, the member retains 2.81 ADA + 10 HRDT.
>
> **Precise ADA requirement for a donation of 5 HRDT:**
>
> | Component | Amount |
> |---|---|
> | Treasury output (5 HRDT + min UTxO) | 1.017 ADA |
> | Member change output (10 HRDT + min UTxO) | 1.500 ADA |
> | Transaction fee | 0.172 ADA |
> | **Total minimum** | **2.689 ADA** |
>
> The protocol minimum is ~2.69 ADA, but MeshSDK's coin selection failed at 3.0 ADA (1.5 + 1.5 from two rewards). It works reliably at 4.0 ADA (2.0 + 2.0). The extra ~1.31 ADA surplus goes into the member's change output.

---

## 3. Full E2E Test Run — Net Token Flow

### Per Test Run (8 steps)

| Step | Treasury ADA | Treasury HRDT | Notes |
|---|---|---|---|
| 1. Admin registration | -2.81 | -10 | Reward to admin |
| 5. Member registration | -2.81 | -10 | Reward to member |
| 6. Contribution reward | -2.81 | -5 | Reward to member |
| 7. Donation | +1.02 | +5 | Member donates back |
| **Net per run** | **-7.41** | **-20** | |

### Fee Breakdown Per Run

| Transaction | Fee | Paid by |
|---|---|---|
| Admin registration reward | 0.81 ADA | Treasury (Plutus script) |
| Member registration reward | 0.81 ADA | Treasury (Plutus script) |
| Contribution reward | 0.81 ADA | Treasury (Plutus script) |
| Donation | 0.17 ADA | Member (simple tx) |
| **Total fees burned** | **2.60 ADA** | |

### ADA Breakdown Per Run

| Where ADA goes | Amount | Recoverable? |
|---|---|---|
| Admin wallet (min UTxO with tokens) | 2.00 ADA | Stays with admin |
| Member wallet (registration reward) | 2.00 ADA | Stays with member |
| Member wallet (contribution reward) | 2.00 ADA | Partially used for donation |
| Donation output (min UTxO) | 1.02 ADA | Returns to treasury |
| Network fees | 2.60 ADA | Burned permanently |
| **Total leaving treasury** | **7.41 ADA** | |
| **Permanently lost (fees)** | **2.60 ADA** | |

---

## 4. System Limitations

The limits below are based on the **setup parameters** — the amounts configured in the seeding scripts. Actual capacity depends on how the setup was performed.

### 4.1 Setup Parameters

| Setup Step | Parameter | Default Value |
|---|---|---|
| Minting (`mint-tokens.ts`) | Tokens minted | 10,000 HRDT |
| Treasury seeding (`seed-treasury-multi.ts`) | Number of UTxOs | 20 |
| Treasury seeding | Tokens per UTxO | 100 HRDT |
| Treasury seeding | ADA per UTxO | 25 ADA |
| Treasury seeding | Total tokens seeded | 2,000 HRDT |
| Treasury seeding | Total ADA seeded | 500 ADA |
| Collateral creation | Number of ADA-only UTxOs | 20 |
| Collateral creation | ADA per collateral UTxO | 10 ADA |
| Reward config (`rewards.js`) | Minimum ADA per reward | 2 ADA |
| Registration config (`index.js`) | Tokens per registration | 10 HRDT |
| Contribution config (admin-created) | Tokens per contribution reward | 5 HRDT |

### 4.2 Capacity Per Seeding

Based on the default setup of 20 treasury UTxOs (25 ADA + 100 HRDT each):

| Constraint | Limit | Calculation |
|---|---|---|
| **Total treasury ADA** | **500 ADA** | 20 UTxOs × 25 ADA |
| **Total treasury HRDT** | **2,000 HRDT** | 20 UTxOs × 100 HRDT |
| **E2E test runs (by ADA)** | **~67 runs** | 500 ADA ÷ 7.41 ADA per run |
| **E2E test runs (by tokens)** | **~100 runs** | 2,000 HRDT ÷ 20 HRDT per run |
| **Bottleneck** | **Tokens** | Tokens run out first at default seeding |
| Registration rewards (total) | 200 | 2,000 ÷ 10 tokens each |
| Contribution rewards (total) | 400 | 2,000 ÷ 5 tokens each |

> **Note:** Reseeding adds more UTxOs alongside existing ones. Multiple seedings are cumulative.

### 4.3 Concurrency Limits

Each reward transaction requires **two resources**: a treasury UTxO (for tokens) and an oracle collateral UTxO (for Plutus execution). Both are locked for ~20-40 seconds during confirmation. The maximum concurrent rewards is the **lower** of the two.

| Resource | Default Setup | Limits |
|---|---|---|
| Treasury UTxOs | 20 | Max 20 concurrent token withdrawals |
| Oracle collateral UTxOs | 20 | Max 20 concurrent Plutus executions |
| **Effective concurrent capacity** | | **20 rewards** |

If two rewards try to use the same UTxO within the settlement window (~20-40 seconds), the second fails with "All inputs are spent". The backend retries automatically (3 attempts, 30s delay).

| Parameter | Value |
|---|---|
| UTxO settlement time | ~20-40 seconds |
| Retry attempts | 3 |
| Retry delay | 30 seconds |
| Max wait for contention | 90 seconds |

> **To increase concurrency:** Run `seed-treasury-multi.ts` again (adds 20 more UTxOs) and create more collateral UTxOs. Both must be matched for maximum throughput.

### 4.4 UTxO Fragmentation

As rewards are processed, treasury UTxOs get smaller. Each reward takes ~2.81 ADA + tokens from the UTxO:

| State | ADA | HRDT | Can reward? |
|---|---|---|---|
| Original | 25.00 | 100 | Yes |
| After 1 reward | 22.19 | 90 | Yes |
| After 2 rewards | 19.38 | 80 | Yes |
| After 3 rewards | 16.57 | 70 | Yes |
| After 7 rewards | 5.33 | 30 | Marginal |
| After 8 rewards | 2.52 | 20 | No — "UTxO Fully Depleted" |

**Each UTxO supports ~7-8 rewards before it becomes too small.** With 20 UTxOs from one seeding, that's ~140-160 total rewards before reseeding is needed.

### 4.5 Member Wallet Constraints

Members accumulate ADA from registration + contribution rewards. To make a donation, they need:

| Requirement | Amount |
|---|---|
| Donation output (tokens + min UTxO) | 1.017 ADA |
| Change output (remaining tokens + min UTxO) | 1.500 ADA |
| Transaction fee | 0.172 ADA |
| **Protocol minimum** | **2.689 ADA** |
| **MeshSDK practical minimum** | **~4.00 ADA** |

| Source of member's ADA | Amount |
|---|---|
| Registration reward | 2.00 ADA |
| Contribution reward | 2.00 ADA |
| **Total available** | **4.00 ADA** |

> **Warning:** MeshSDK's coin selection fails at 3.0 ADA despite the protocol minimum being 2.69 ADA. The 2 ADA minimum per reward (totalling 4 ADA from two rewards) provides the minimum working amount. Reducing below 2 ADA per reward will break donations.

### 4.6 Oracle Constraints

| Requirement | Details |
|---|---|
| ADA-only UTxOs | Required for Plutus collateral (~10 ADA each) |
| Number needed | Matches desired concurrency (default: 20) |
| ADA consumed | None — collateral is always returned after confirmation |
| HRDT tokens | Only needed when minting more tokens |
| Ongoing cost | Zero — oracle provides collateral but doesn't spend ADA |

The oracle does not pay for rewards — the treasury pays all fees and min UTxO costs. The oracle only provides its signature and temporary collateral.

---

## 5. Recovery Procedures

### Treasury runs low on ADA
```bash
# 1. Fund oracle from faucet (https://docs.cardano.org/cardano-testnets/tools/faucet/)
# 2. Reseed treasury
cd e2e && npx tsx setup/seed-treasury-multi.ts
```

### Treasury runs low on tokens
```bash
# 1. Mint more tokens
cd e2e && npx tsx setup/mint-tokens.ts
# 2. Reseed treasury
npx tsx setup/seed-treasury-multi.ts
```

### Oracle runs out of collateral
```bash
# Fund oracle from faucet — the ADA arrives as an ADA-only UTxO
# which automatically serves as collateral
```

### UTxOs too fragmented (many small UTxOs)
```bash
# Reseed creates fresh 25 ADA + 100 HRDT UTxOs alongside existing ones
cd e2e && npx tsx setup/seed-treasury-multi.ts
```
